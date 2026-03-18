import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { CreateDropdownOptionDto, UpdateDropdownOptionDto } from './dto/dropdown-option.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // ── Service Types ──────────────────────────────────────────────────────────

  async findAllServiceTypes(organizationId: string) {
    return this.prisma.serviceType.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async createServiceType(dto: CreateServiceTypeDto, organizationId: string) {
    return this.prisma.serviceType.create({ data: { ...dto, organizationId } });
  }

  async updateServiceType(id: string, dto: Partial<CreateServiceTypeDto>, organizationId: string) {
    const existing = await this.prisma.serviceType.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException(`Service type with ID ${id} not found`);
    }
    return this.prisma.serviceType.update({ where: { id }, data: dto });
  }

  async deleteServiceType(id: string, organizationId: string) {
    const existing = await this.prisma.serviceType.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException(`Service type with ID ${id} not found`);
    }
    const inUseCount = await this.prisma.lead.count({ where: { serviceTypeId: id, organizationId } });
    if (inUseCount > 0) {
      throw new BadRequestException(
        `Cannot delete service type "${existing.name}" because it is assigned to ${inUseCount} lead(s).`
      );
    }
    return this.prisma.serviceType.delete({ where: { id } });
  }

  // ── Dropdown Options ───────────────────────────────────────────────────────

  async findDropdownOptions(organizationId: string, category?: string) {
    return this.prisma.dropdownOption.findMany({
      where: {
        organizationId,
        ...(category ? { category } : {}),
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async findAllDropdownOptions(organizationId: string) {
    return this.prisma.dropdownOption.findMany({
      where: { organizationId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createDropdownOption(dto: CreateDropdownOptionDto, organizationId: string) {
    const existing = await this.prisma.dropdownOption.findUnique({
      where: {
        organizationId_category_value: {
          organizationId,
          category: dto.category,
          value: dto.value,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `A dropdown option with value "${dto.value}" already exists in category "${dto.category}".`
      );
    }
    return this.prisma.dropdownOption.create({ data: { ...dto, organizationId } });
  }

  async updateDropdownOption(id: string, dto: UpdateDropdownOptionDto, organizationId: string) {
    const existing = await this.prisma.dropdownOption.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException(`Dropdown option with ID ${id} not found`);
    }
    return this.prisma.dropdownOption.update({ where: { id }, data: dto });
  }

  async deleteDropdownOption(id: string, organizationId: string) {
    const existing = await this.prisma.dropdownOption.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException(`Dropdown option with ID ${id} not found`);
    }
    if (existing.isSystem) {
      throw new BadRequestException(
        `Cannot delete system option "${existing.label}". You can disable it instead.`
      );
    }
    return this.prisma.dropdownOption.delete({ where: { id } });
  }

  async reorderDropdownOptions(category: string, orderedIds: string[], organizationId: string) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.dropdownOption.update({
        where: { id },
        data: { sortOrder: index },
      })
    );
    return this.prisma.$transaction(updates);
  }
}
