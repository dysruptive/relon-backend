import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QbCallbackDto } from './dto/qb-callback.dto';

export class QbApiClient {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`QB API ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  async get(path: string): Promise<any> {
    return this.request(path);
  }

  async post(path: string, body: unknown): Promise<any> {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }
}

@Injectable()
export class QuickBooksService {
  private readonly logger = new Logger(QuickBooksService.name);

  private get clientId() {
    return process.env.QB_CLIENT_ID ?? '';
  }
  private get clientSecret() {
    return process.env.QB_CLIENT_SECRET ?? '';
  }
  private get redirectUri() {
    return process.env.QB_REDIRECT_URI ?? '';
  }
  private get environment() {
    return process.env.QB_ENVIRONMENT ?? 'sandbox';
  }
  private get qbBaseUrl() {
    return this.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }
  private get basicAuth() {
    return `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
  }

  constructor(private readonly prisma: PrismaService) {}

  getAuthorizationUrl(organizationId: string): string {
    const state = Buffer.from(JSON.stringify({ organizationId, ts: Date.now() })).toString('base64');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    });
    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  }

  async handleCallback(dto: QbCallbackDto, organizationId: string): Promise<{ companyName: string }> {
    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.basicAuth,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: dto.code,
        redirect_uri: this.redirectUri,
      }).toString(),
    });
    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    let companyName = 'Unknown';
    try {
      const infoRes = await fetch(
        `${this.qbBaseUrl}/v3/company/${dto.realmId}/companyinfo/${dto.realmId}`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: 'application/json',
          },
        },
      );
      const infoData = await infoRes.json();
      companyName = infoData?.CompanyInfo?.CompanyName ?? 'Unknown';
    } catch (e: any) {
      this.logger.warn('Could not fetch QB company info', e?.message);
    }

    await this.prisma.quickBooksConnection.upsert({
      where: { organizationId_realmId: { organizationId, realmId: dto.realmId } },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        companyName,
        isActive: true,
        lastSyncAt: null,
      },
      create: {
        organizationId,
        realmId: dto.realmId,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        companyName,
        isActive: true,
      },
    });

    this.logger.log(`QB connected: ${companyName} (org: ${organizationId})`);
    return { companyName };
  }

  async disconnect(organizationId: string): Promise<void> {
    await this.prisma.quickBooksConnection.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });
  }

  async getStatus(
    organizationId: string,
  ): Promise<{ connected: boolean; companyName?: string; lastSyncAt?: Date; realmId?: string }> {
    const conn = await this.prisma.quickBooksConnection.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { connectedAt: 'desc' },
    });
    if (!conn) return { connected: false };
    return {
      connected: true,
      companyName: conn.companyName ?? undefined,
      lastSyncAt: conn.lastSyncAt ?? undefined,
      realmId: conn.realmId,
    };
  }

  async getActiveConnection(organizationId: string) {
    const conn = await this.prisma.quickBooksConnection.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { connectedAt: 'desc' },
    });
    if (!conn) throw new BadRequestException('QuickBooks is not connected');
    return conn;
  }

  async getValidAccessToken(
    organizationId: string,
  ): Promise<{ token: string; realmId: string }> {
    const conn = await this.getActiveConnection(organizationId);
    if (conn.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
      return this.refreshToken(conn);
    }
    return { token: conn.accessToken, realmId: conn.realmId };
  }

  private async refreshToken(conn: {
    id: string;
    realmId: string;
    refreshToken: string;
  }): Promise<{ token: string; realmId: string }> {
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.basicAuth,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: conn.refreshToken,
      }).toString(),
    });
    const data = await res.json();
    const { access_token, refresh_token, expires_in } = data;
    await this.prisma.quickBooksConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry: new Date(Date.now() + expires_in * 1000),
      },
    });
    return { token: access_token, realmId: conn.realmId };
  }

  async getApiClient(
    organizationId: string,
  ): Promise<{ client: QbApiClient; realmId: string }> {
    const { token, realmId } = await this.getValidAccessToken(organizationId);
    return {
      client: new QbApiClient(`${this.qbBaseUrl}/v3/company/${realmId}`, token),
      realmId,
    };
  }

  async createInvoiceFromQuote(
    quoteId: string,
    organizationId: string,
  ): Promise<{ qbInvoiceId: string }> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { lineItems: true, client: true },
    });
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found`);
    if (!quote.clientId) throw new BadRequestException('Quote has no client');
    if (!(quote.client as any)?.qbCustomerId) {
      throw new BadRequestException(
        'Client is not synced to QuickBooks. Run client sync first.',
      );
    }

    const { client: qbClient } = await this.getApiClient(organizationId);
    const lineItems = await Promise.all(
      quote.lineItems.map(async (item, idx) => {
        const qbItem = await this.findOrCreateQbItem(
          qbClient,
          item.description,
          Number(item.unitPrice),
        );
        return {
          LineNum: idx + 1,
          Amount: Number(item.lineTotal),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: qbItem.Id, name: qbItem.Name },
            Qty: Number(item.quantity),
            UnitPrice: Number(item.unitPrice),
          },
        };
      }),
    );

    const res = await qbClient.post('/invoice', {
      Line: lineItems,
      CustomerRef: { value: (quote.client as any).qbCustomerId },
      ...(quote.validUntil && {
        DueDate: quote.validUntil.toISOString().split('T')[0],
      }),
    });

    const qbInvoiceId = res?.Invoice?.Id;
    if (!qbInvoiceId) throw new BadRequestException('QB did not return an Invoice ID');

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { qbInvoiceId, qbPaymentStatus: 'unpaid' } as any,
    });
    await this.prisma.quickBooksSync.create({
      data: {
        organizationId,
        direction: 'CRM_TO_QB',
        entityType: 'Invoice',
        externalId: qbInvoiceId,
        internalId: quoteId,
        status: 'success',
      },
    });
    return { qbInvoiceId };
  }

  private async findOrCreateQbItem(
    qbClient: QbApiClient,
    name: string,
    unitPrice: number,
  ): Promise<{ Id: string; Name: string }> {
    const query = `SELECT * FROM Item WHERE Name = '${name.replace(/'/g, "\\'")}'`;
    const res = await qbClient.get(`/query?query=${encodeURIComponent(query)}`);
    const existing = res?.QueryResponse?.Item?.[0];
    if (existing) return { Id: existing.Id, Name: existing.Name };

    const createRes = await qbClient.post('/item', {
      Name: name.slice(0, 100),
      Type: 'Service',
      UnitPrice: unitPrice,
      IncomeAccountRef: { value: '1', name: 'Services' },
    });
    const item = createRes?.Item;
    return { Id: item.Id, Name: item.Name };
  }

  async syncPayments(organizationId: string): Promise<{ updated: number }> {
    const { client: qbClient, realmId } = await this.getApiClient(organizationId);
    const query = 'SELECT * FROM Payment MAXRESULTS 100';
    const res = await qbClient.get(`/query?query=${encodeURIComponent(query)}`);
    const payments: any[] = res?.QueryResponse?.Payment ?? [];
    let updated = 0;

    for (const payment of payments) {
      const invoiceId = payment.Line?.[0]?.LinkedTxn?.[0]?.TxnId;
      if (!invoiceId) continue;

      const quote = await this.prisma.quote.findFirst({
        where: { qbInvoiceId: invoiceId } as any,
      });
      if (!quote || (quote as any).qbPaymentStatus === 'paid') continue;

      await this.prisma.quote.update({
        where: { id: quote.id },
        data: { qbPaymentStatus: 'paid' } as any,
      });
      await this.prisma.quickBooksSync.create({
        data: {
          organizationId,
          realmId,
          direction: 'QB_TO_CRM',
          entityType: 'Payment',
          externalId: payment.Id,
          internalId: quote.id,
          status: 'success',
        },
      });
      if (quote.clientId) await this.recalculateClientRevenue(quote.clientId);
      updated++;
    }
    return { updated };
  }

  private async recalculateClientRevenue(clientId: string): Promise<void> {
    const agg = await this.prisma.quote.aggregate({
      where: { clientId, qbPaymentStatus: 'paid' } as any,
      _sum: { total: true },
    });
    await this.prisma.client.update({
      where: { id: clientId },
      data: { lifetimeRevenue: Number(agg._sum.total ?? 0) },
    });
  }

  async getSyncHistory(organizationId: string, limit = 50) {
    return this.prisma.quickBooksSync.findMany({
      where: { organizationId },
      orderBy: { syncedAt: 'desc' },
      take: limit,
    });
  }
}
