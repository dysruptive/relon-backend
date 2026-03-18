import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { QuickBooksSyncService } from './quickbooks-sync.service';
import { QuickBooksService } from './quickbooks.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class QuickBooksWebhookService {
  private readonly logger = new Logger(QuickBooksWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qbService: QuickBooksService,
    private readonly syncService: QuickBooksSyncService,
  ) {}

  verifySignature(payload: string, signature: string): boolean {
    const verifierToken = process.env.QB_WEBHOOK_VERIFIER_TOKEN ?? '';
    if (!verifierToken) return true; // skip in dev
    const computed = crypto
      .createHmac('sha256', verifierToken)
      .update(payload)
      .digest('base64');
    return computed === signature;
  }

  async handleWebhook(payload: any, signature: string, rawBody: string): Promise<void> {
    if (!this.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid QB webhook signature');
    }
    const notifications: any[] = payload?.eventNotifications ?? [];
    for (const notification of notifications) {
      const realmId = notification?.realmId;
      const conn = realmId
        ? await this.prisma.quickBooksConnection.findFirst({
            where: { realmId, isActive: true },
          })
        : null;
      if (!conn) continue;

      const entities: any[] = notification?.dataChangeEvent?.entities ?? [];
      for (const entity of entities) {
        await this.handleEntityChange(entity, conn.organizationId).catch((e) =>
          this.logger.error(
            `QB webhook error for ${entity.name} ${entity.id}`,
            e?.message,
          ),
        );
      }
    }
  }

  private async handleEntityChange(
    entity: { name: string; id: string; operation: string },
    organizationId: string,
  ): Promise<void> {
    this.logger.log(`QB webhook: ${entity.operation} ${entity.name} ${entity.id}`);
    switch (entity.name) {
      case 'Customer':
        await this.handleCustomerChange(entity.id, entity.operation, organizationId);
        break;
      case 'Invoice':
        await this.handleInvoiceChange(entity.id, entity.operation);
        break;
      case 'Payment':
        await this.qbService.syncPayments(organizationId);
        break;
    }
  }

  private async handleCustomerChange(
    qbCustomerId: string,
    operation: string,
    organizationId: string,
  ): Promise<void> {
    if (operation === 'Delete') {
      await this.prisma.client.updateMany({
        where: { organizationId, qbCustomerId } as any,
        data: { qbCustomerId: null } as any,
      });
      return;
    }

    const { client: qbClient } = await this.qbService.getApiClient(organizationId);
    const res = await qbClient.get(`/customer/${qbCustomerId}`);
    const customer = res?.Customer;
    if (!customer) return;

    const existing = await this.prisma.client.findFirst({
      where: { organizationId, qbCustomerId } as any,
    });
    if (existing) {
      await this.prisma.client.update({
        where: { id: existing.id },
        data: {
          ...(customer.PrimaryEmailAddr?.Address && {
            email: customer.PrimaryEmailAddr.Address,
          }),
          ...(customer.PrimaryPhone?.FreeFormNumber && {
            phone: customer.PrimaryPhone.FreeFormNumber,
          }),
        },
      });
    }
    await this.prisma.quickBooksSync.create({
      data: {
        organizationId,
        direction: 'QB_TO_CRM',
        entityType: 'Customer',
        externalId: qbCustomerId,
        internalId: existing?.id ?? null,
        status: 'success',
      },
    });
  }

  private async handleInvoiceChange(
    qbInvoiceId: string,
    operation: string,
  ): Promise<void> {
    if (operation === 'Delete') {
      await this.prisma.quote.updateMany({
        where: { qbInvoiceId } as any,
        data: { qbInvoiceId: null, qbPaymentStatus: 'voided' } as any,
      });
      return;
    }

    const conn = await this.prisma.quickBooksConnection.findFirst({
      where: { isActive: true },
    });
    if (!conn) return;

    const { client: qbClient } = await this.qbService.getApiClient(conn.organizationId);
    const res = await qbClient.get(`/invoice/${qbInvoiceId}`);
    const invoice = res?.Invoice;
    if (!invoice) return;

    const balance = invoice.Balance ?? 0;
    const total = invoice.TotalAmt ?? 0;
    let paymentStatus = 'unpaid';
    if (balance === 0 && total > 0) paymentStatus = 'paid';
    else if (balance < total && balance > 0) paymentStatus = 'partial';

    await this.prisma.quote.updateMany({
      where: { qbInvoiceId } as any,
      data: { qbPaymentStatus: paymentStatus } as any,
    });
  }
}
