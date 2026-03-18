import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QuickBooksService } from './quickbooks.service';

@Injectable()
export class QuickBooksSyncService {
  private readonly logger = new Logger(QuickBooksSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qbService: QuickBooksService,
  ) {}

  async syncClients(
    organizationId: string,
  ): Promise<{ pulled: number; pushed: number; errors: number }> {
    let pulled = 0,
      pushed = 0,
      errors = 0;
    try {
      pulled = await this.pullQbCustomers(organizationId);
    } catch (e: any) {
      this.logger.error('QB pull failed', e?.message);
      errors++;
    }
    try {
      pushed = await this.pushCrmClients(organizationId);
    } catch (e: any) {
      this.logger.error('CRM push failed', e?.message);
      errors++;
    }
    return { pulled, pushed, errors };
  }

  private async pullQbCustomers(organizationId: string): Promise<number> {
    const { client: qbClient, realmId } = await this.qbService.getApiClient(organizationId);
    const res = await qbClient.get(
      `/query?query=${encodeURIComponent('SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000')}`,
    );
    const customers: any[] = res?.QueryResponse?.Customer ?? [];
    let count = 0;

    for (const customer of customers) {
      try {
        const email = customer.PrimaryEmailAddr?.Address ?? null;
        const qbId = customer.Id;
        const existing = await this.prisma.client.findFirst({
          where: {
            organizationId,
            OR: [{ qbCustomerId: qbId }, ...(email ? [{ email }] : [])],
          } as any,
        });
        if (existing) {
          if (!(existing as any).qbCustomerId) {
            await this.prisma.client.update({
              where: { id: existing.id },
              data: { qbCustomerId: qbId } as any,
            });
          }
        } else {
          await this.prisma.client.create({
            data: {
              organizationId,
              name: customer.DisplayName ?? customer.CompanyName ?? 'Unknown',
              email: email ?? null,
              phone: customer.PrimaryPhone?.FreeFormNumber ?? null,
              qbCustomerId: qbId,
              segment: 'SMB',
              industry: 'General',
            } as any,
          });
        }
        await this.prisma.quickBooksSync.create({
          data: {
            organizationId,
            realmId,
            direction: 'QB_TO_CRM',
            entityType: 'Customer',
            externalId: qbId,
            internalId: existing?.id ?? null,
            status: 'success',
          },
        });
        count++;
      } catch (e: any) {
        await this.prisma.quickBooksSync.create({
          data: {
            organizationId,
            realmId,
            direction: 'QB_TO_CRM',
            entityType: 'Customer',
            externalId: customer.Id,
            status: 'error',
            errorMessage: e?.message ?? 'Unknown',
          },
        });
      }
    }
    return count;
  }

  private async pushCrmClients(organizationId: string): Promise<number> {
    const { client: qbClient, realmId } = await this.qbService.getApiClient(organizationId);
    const unsynced = await this.prisma.client.findMany({
      where: { organizationId, qbCustomerId: null } as any,
      take: 100,
    });
    let count = 0;

    for (const crmClient of unsynced) {
      try {
        const res = await qbClient.post('/customer', {
          DisplayName: crmClient.name,
          ...(crmClient.email && { PrimaryEmailAddr: { Address: crmClient.email } }),
          ...(crmClient.phone && { PrimaryPhone: { FreeFormNumber: crmClient.phone } }),
        });
        const qbId = res?.Customer?.Id;
        if (!qbId) continue;

        await this.prisma.client.update({
          where: { id: crmClient.id },
          data: { qbCustomerId: qbId } as any,
        });
        await this.prisma.quickBooksSync.create({
          data: {
            organizationId,
            realmId,
            direction: 'CRM_TO_QB',
            entityType: 'Customer',
            externalId: qbId,
            internalId: crmClient.id,
            status: 'success',
          },
        });
        count++;
      } catch (e: any) {
        await this.prisma.quickBooksSync
          .create({
            data: {
              organizationId,
              realmId,
              direction: 'CRM_TO_QB',
              entityType: 'Customer',
              internalId: crmClient.id,
              status: 'error',
              errorMessage: e?.message ?? 'Unknown',
            },
          })
          .catch(() => {});
      }
    }
    return count;
  }

  async syncExpenses(
    organizationId: string,
    userId: string,
  ): Promise<{ created: number; skipped: number; errors: number }> {
    let created = 0,
      skipped = 0,
      errors = 0;
    const { client: qbClient, realmId } = await this.qbService.getApiClient(organizationId);
    const res = await qbClient.get(
      `/query?query=${encodeURIComponent('SELECT * FROM Bill MAXRESULTS 100')}`,
    );
    const bills: any[] = res?.QueryResponse?.Bill ?? [];

    for (const bill of bills) {
      for (const line of bill.Line ?? []) {
        if (line.DetailType !== 'AccountBasedExpenseLineDetail') continue;
        const customerRef = line.AccountBasedExpenseLineDetail?.CustomerRef?.value;
        if (!customerRef) continue;

        const billLineId = `${bill.Id}-${line.Id}`;
        try {
          const existing = await this.prisma.quickBooksSync.findFirst({
            where: { organizationId, entityType: 'Expense', externalId: billLineId },
          });
          if (existing) {
            skipped++;
            continue;
          }

          const crmClient = await this.prisma.client.findFirst({
            where: { organizationId, qbCustomerId: customerRef } as any,
          });
          if (!crmClient) {
            skipped++;
            continue;
          }

          const project = await this.prisma.project.findFirst({
            where: {
              organizationId,
              clientId: crmClient.id,
              status: { notIn: ['Completed', 'Cancelled', 'Closed'] },
            },
            orderBy: { updatedAt: 'desc' },
          });
          if (!project) {
            skipped++;
            continue;
          }

          const costLog = await this.prisma.costLog.create({
            data: {
              projectId: project.id,
              organizationId,
              date: bill.TxnDate ? new Date(bill.TxnDate) : new Date(),
              category:
                line.AccountBasedExpenseLineDetail?.AccountRef?.name ?? 'QB Import',
              description: line.Description ?? `QB Bill ${bill.Id}`,
              amount: line.Amount ?? 0,
              createdBy: userId,
            },
          });
          await this.prisma.quickBooksSync.create({
            data: {
              organizationId,
              realmId,
              direction: 'QB_TO_CRM',
              entityType: 'Expense',
              externalId: billLineId,
              internalId: costLog.id,
              status: 'success',
            },
          });
          created++;
        } catch (e: any) {
          await this.prisma.quickBooksSync
            .create({
              data: {
                organizationId,
                realmId,
                direction: 'QB_TO_CRM',
                entityType: 'Expense',
                externalId: billLineId,
                status: 'error',
                errorMessage: e?.message ?? 'Unknown',
              },
            })
            .catch(() => {});
          errors++;
        }
      }
    }
    return { created, skipped, errors };
  }

  async syncServiceItems(
    organizationId: string,
  ): Promise<{ synced: number; skipped: number; errors: number }> {
    let synced = 0,
      skipped = 0,
      errors = 0;
    const { client: qbClient, realmId } = await this.qbService.getApiClient(organizationId);
    const items = await this.prisma.serviceItem.findMany({
      where: { organizationId, isActive: true, qbItemId: null } as any,
    });

    for (const item of items) {
      try {
        const res = await qbClient.post('/item', {
          Name: item.name,
          Type: 'Service',
          ...(item.description && { Description: item.description }),
          ...(item.defaultPrice != null && { UnitPrice: Number(item.defaultPrice) }),
          IncomeAccountRef: { value: '1', name: 'Services' },
        });
        const qbId = res?.Item?.Id;
        if (!qbId) {
          skipped++;
          continue;
        }
        await this.prisma.serviceItem.update({
          where: { id: item.id },
          data: { qbItemId: qbId } as any,
        });
        await this.prisma.quickBooksSync.create({
          data: {
            organizationId,
            realmId,
            direction: 'CRM_TO_QB',
            entityType: 'Item',
            externalId: qbId,
            internalId: item.id,
            status: 'success',
          },
        });
        synced++;
      } catch (e: any) {
        await this.prisma.quickBooksSync
          .create({
            data: {
              organizationId,
              realmId,
              direction: 'CRM_TO_QB',
              entityType: 'Item',
              internalId: item.id,
              status: 'error',
              errorMessage: e?.message ?? 'Unknown',
            },
          })
          .catch(() => {});
        errors++;
      }
    }
    return { synced, skipped, errors };
  }

  async updateLastSyncAt(organizationId: string): Promise<void> {
    await this.prisma.quickBooksConnection.updateMany({
      where: { organizationId, isActive: true },
      data: { lastSyncAt: new Date() },
    });
  }
}
