import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quotes.dto';

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  private calculateTotals(
    lineItems: Array<{
      quantity: number;
      unitPrice: number;
      taxable?: boolean;
    }>,
    taxRate: number,
    discount: number,
  ) {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const taxableAmount = lineItems
      .filter((item) => item.taxable !== false)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = taxableAmount * (taxRate / 100);
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
  }

  private readonly quoteInclude = {
    lead: {
      select: { id: true, contactName: true, company: true, stage: true },
    },
    client: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    lineItems: { orderBy: { sortOrder: 'asc' as const } },
  } as const;

  async findAll(
    organizationId: string,
    filters: {
      leadId?: string;
      clientId?: string;
      projectId?: string;
      status?: string;
    },
  ) {
    const where: Record<string, unknown> = { organizationId };
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;

    return this.prisma.quote.findMany({
      where,
      include: this.quoteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, organizationId },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            company: true,
            email: true,
            stage: true,
          },
        },
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async create(dto: CreateQuoteDto, userId: string, organizationId: string) {
    // Cross-entity ownership validation
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, organizationId },
      });
      if (!lead)
        throw new BadRequestException('Lead not found in this organization');
    }
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, organizationId },
      });
      if (!client)
        throw new BadRequestException('Client not found in this organization');
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId },
      });
      if (!project)
        throw new BadRequestException('Project not found in this organization');
    }

    const lineItemsData = (dto.lineItems || []).map((item, index) => ({
      description: item.description,
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 0,
      taxable: item.taxable ?? true,
      lineTotal: (item.quantity ?? 1) * (item.unitPrice ?? 0),
      sortOrder: item.sortOrder ?? index,
      serviceItemId: item.serviceItemId ?? null,
    }));

    const taxRate = dto.taxRate ?? 0;
    const discount = dto.discount ?? 0;
    const { subtotal, taxAmount, total } = this.calculateTotals(
      lineItemsData,
      taxRate,
      discount,
    );

    // Atomically get-and-increment quote number per org
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.quoteSettings.upsert({
        where: { organizationId },
        update: { nextQuoteNumber: { increment: 1 } },
        create: { organizationId, nextQuoteNumber: 2 },
      });

      const quoteNumber = settings.nextQuoteNumber - 1;

      return tx.quote.create({
        data: {
          organizationId,
          quoteNumber,
          settingsId: settings.id,
          leadId: dto.leadId,
          clientId: dto.clientId,
          projectId: dto.projectId,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          notes: dto.notes,
          termsAndConditions: dto.termsAndConditions,
          taxRate,
          discount,
          subtotal,
          taxAmount,
          total,
          currency: dto.currency || 'USD',
          createdById: userId,
          lineItems: {
            create: lineItemsData,
          },
        },
        include: this.quoteInclude,
      });
    });
  }

  async update(id: string, dto: UpdateQuoteDto, organizationId: string) {
    const existing = await this.findOne(id, organizationId);

    // Content edits require DRAFT status.
    const isContentEdit =
      dto.leadId !== undefined ||
      dto.clientId !== undefined ||
      dto.projectId !== undefined ||
      dto.validUntil !== undefined ||
      dto.notes !== undefined ||
      dto.termsAndConditions !== undefined ||
      dto.currency !== undefined ||
      dto.taxRate !== undefined ||
      dto.discount !== undefined ||
      dto.lineItems !== undefined;

    if (isContentEdit && existing.status !== 'DRAFT') {
      throw new BadRequestException('Only draft quotes can be edited');
    }

    // Cross-entity ownership validation on referenced entities
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, organizationId },
      });
      if (!lead)
        throw new BadRequestException('Lead not found in this organization');
    }
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, organizationId },
      });
      if (!client)
        throw new BadRequestException('Client not found in this organization');
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId },
      });
      if (!project)
        throw new BadRequestException('Project not found in this organization');
    }

    const data: Record<string, unknown> = {};
    if (dto.leadId !== undefined) data.leadId = dto.leadId;
    if (dto.clientId !== undefined) data.clientId = dto.clientId;
    if (dto.projectId !== undefined) data.projectId = dto.projectId;
    if (dto.validUntil) data.validUntil = new Date(dto.validUntil);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.termsAndConditions !== undefined)
      data.termsAndConditions = dto.termsAndConditions;
    if (dto.currency) data.currency = dto.currency;
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'SENT') data.sentAt = new Date();
      if (dto.status === 'ACCEPTED') data.acceptedAt = new Date();
      if (dto.status === 'REJECTED') data.rejectedAt = new Date();
    }

    const include = this.quoteInclude;

    // Handle line items update (replace all) — wrapped in a transaction
    if (dto.lineItems) {
      const taxRate =
        dto.taxRate !== undefined ? dto.taxRate : Number(existing.taxRate);
      const discount =
        dto.discount !== undefined ? dto.discount : Number(existing.discount);

      const lineItemsData = dto.lineItems.map((item, index) => ({
        description: item.description,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? 0,
        taxable: item.taxable ?? true,
        lineTotal: (item.quantity ?? 1) * (item.unitPrice ?? 0),
        sortOrder: item.sortOrder ?? index,
        serviceItemId: item.serviceItemId ?? null,
      }));

      const { subtotal, taxAmount, total } = this.calculateTotals(
        lineItemsData,
        taxRate,
        discount,
      );
      data.taxRate = taxRate;
      data.discount = discount;
      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = total;

      return this.prisma.$transaction(async (tx) => {
        await tx.quoteLineItem.deleteMany({ where: { quoteId: id } });
        await tx.quoteLineItem.createMany({
          data: lineItemsData.map((item) => ({ ...item, quoteId: id })),
        });
        return tx.quote.update({ where: { id }, data, include });
      });
    }

    if (dto.taxRate !== undefined || dto.discount !== undefined) {
      // Recalculate with existing line items
      const lineItems = await this.prisma.quoteLineItem.findMany({
        where: { quoteId: id },
      });
      const taxRate =
        dto.taxRate !== undefined ? dto.taxRate : Number(existing.taxRate);
      const discount =
        dto.discount !== undefined ? dto.discount : Number(existing.discount);
      const { subtotal, taxAmount, total } = this.calculateTotals(
        lineItems.map((li) => ({
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          taxable: li.taxable,
        })),
        taxRate,
        discount,
      );
      data.taxRate = taxRate;
      data.discount = discount;
      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = total;
    }

    return this.prisma.quote.update({ where: { id }, data, include });
  }

  async delete(id: string, organizationId: string) {
    const quote = await this.findOne(id, organizationId);
    if (quote.status !== 'DRAFT') {
      throw new BadRequestException('Only draft quotes can be deleted');
    }
    return this.prisma.quote.delete({ where: { id } });
  }

  async send(id: string, organizationId: string) {
    return this.update(id, { status: 'SENT' }, organizationId);
  }

  async accept(id: string, organizationId: string) {
    return this.update(id, { status: 'ACCEPTED' }, organizationId);
  }

  async reject(id: string, organizationId: string) {
    return this.update(id, { status: 'REJECTED' }, organizationId);
  }
}
