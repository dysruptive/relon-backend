import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCustomFieldDefinitionDto, UpdateCustomFieldDefinitionDto, BulkSaveCustomFieldValuesDto } from './dto/custom-fields.dto';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefinitions(organizationId: string, entityType?: string) {
    return this.prisma.customFieldDefinition.findMany({
      where: { organizationId, ...(entityType ? { entityType } : {}) },
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createDefinition(dto: CreateCustomFieldDefinitionDto, organizationId: string) {
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { organizationId, entityType: dto.entityType, fieldKey: dto.fieldKey },
    });
    if (existing) throw new BadRequestException(`Field key '${dto.fieldKey}' already exists for ${dto.entityType}`);

    return this.prisma.customFieldDefinition.create({
      data: { ...dto, organizationId, options: dto.options ? dto.options : undefined },
    });
  }

  async updateDefinition(id: string, dto: UpdateCustomFieldDefinitionDto, organizationId: string) {
    const def = await this.prisma.customFieldDefinition.findFirst({ where: { id, organizationId } });
    if (!def) throw new NotFoundException('Custom field not found');

    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: { ...dto, options: dto.options ? dto.options : undefined },
    });
  }

  async deleteDefinition(id: string, organizationId: string) {
    const def = await this.prisma.customFieldDefinition.findFirst({ where: { id, organizationId } });
    if (!def) throw new NotFoundException('Custom field not found');

    await this.prisma.customFieldValue.deleteMany({ where: { definitionId: id } });
    await this.prisma.customFieldDefinition.delete({ where: { id } });
  }

  async getValues(organizationId: string, entityType: string, entityId: string) {
    return this.prisma.customFieldValue.findMany({
      where: { organizationId, entityType, entityId },
      include: { definition: true },
    });
  }

  async saveValues(dto: BulkSaveCustomFieldValuesDto, organizationId: string) {
    const { entityType, entityId, values } = dto;

    const defs = await this.prisma.customFieldDefinition.findMany({
      where: { organizationId, entityType },
    });

    const upserts = Object.entries(values).map(([fieldKey, value]) => {
      const def = defs.find((d) => d.fieldKey === fieldKey);
      if (!def) return null;
      return this.prisma.customFieldValue.upsert({
        where: {
          organizationId_definitionId_entityType_entityId: {
            organizationId, definitionId: def.id, entityType, entityId,
          },
        },
        create: { organizationId, definitionId: def.id, entityType, entityId, value: value as any },
        update: { value: value as any },
      });
    }).filter(Boolean);

    return Promise.all(upserts);
  }
}
