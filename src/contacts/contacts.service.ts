import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByClient(clientId: string, organizationId: string) {
    // Verify client belongs to org
    const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.contact.findMany({
      where: { clientId, organizationId },
      include: {
        leads: {
          include: {
            lead: { select: { id: true, company: true, contactName: true, stage: true } },
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
    });
  }

  async findByLead(leadId: string, organizationId: string) {
    // Verify lead belongs to org
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const leadContacts = await this.prisma.leadContact.findMany({
      where: { leadId },
      include: {
        contact: {
          include: {
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ contact: { isPrimary: 'desc' } }, { contact: { lastName: 'asc' } }],
    });
    return leadContacts.map((lc) => lc.contact);
  }

  async findOne(id: string, organizationId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId },
      include: {
        client: { select: { id: true, name: true } },
        leads: {
          include: {
            lead: { select: { id: true, company: true, contactName: true, stage: true } },
          },
        },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(clientId: string, dto: CreateContactDto, organizationId: string) {
    // Verify client belongs to org
    const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contact.updateMany({
          where: { clientId, organizationId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.contact.create({
        data: { ...dto, clientId, organizationId },
        include: { client: { select: { id: true, name: true } } },
      });
    });
  }

  async update(id: string, dto: UpdateContactDto, organizationId: string) {
    const existing = await this.prisma.contact.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Contact not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contact.updateMany({
          where: { clientId: existing.clientId, organizationId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }
      return tx.contact.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          jobTitle: dto.jobTitle,
          department: dto.department,
          linkedInUrl: dto.linkedInUrl,
          isPrimary: dto.isPrimary,
          isDecisionMaker: dto.isDecisionMaker,
          notes: dto.notes,
        },
        include: { client: { select: { id: true, name: true } } },
      });
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.contact.delete({ where: { id } });
  }

  async linkToLead(leadId: string, contactId: string, organizationId: string) {
    // Verify both belong to the same org
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, organizationId } });
    if (!contact) throw new NotFoundException('Contact not found');

    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.leadContact.upsert({
      where: { leadId_contactId: { leadId, contactId } },
      create: { leadId, contactId },
      update: {},
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, company: true, contactName: true } },
      },
    });
  }

  async unlinkFromLead(leadId: string, contactId: string, organizationId: string) {
    // Verify both belong to org
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, organizationId } });
    if (!contact) throw new NotFoundException('Contact not found');

    const record = await this.prisma.leadContact.findUnique({
      where: { leadId_contactId: { leadId, contactId } },
    });
    if (!record) throw new NotFoundException('Link between lead and contact not found');

    return this.prisma.leadContact.delete({
      where: { leadId_contactId: { leadId, contactId } },
    });
  }
}
