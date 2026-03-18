import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceItemDto } from './dto/update-service-item.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';

@Injectable()
export class ServiceItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly itemInclude = {
    serviceType: { select: { id: true, name: true } },
    subtasks: {
      orderBy: { sortOrder: 'asc' as const },
      include: {
        roleEstimates: { orderBy: { role: 'asc' as const } },
      },
    },
    _count: { select: { quoteLineItems: true, timeEntries: true } },
  };

  async findAll(organizationId: string, serviceTypeId?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (serviceTypeId) where.serviceTypeId = serviceTypeId;

    return this.prisma.serviceItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: this.itemInclude,
    });
  }

  async findOne(id: string, organizationId: string) {
    const item = await this.prisma.serviceItem.findFirst({
      where: { id, organizationId },
      include: this.itemInclude,
    });
    if (!item) throw new NotFoundException(`Service item ${id} not found`);
    return item;
  }

  async create(dto: CreateServiceItemDto, organizationId: string) {
    return this.prisma.serviceItem.create({
      data: { ...dto, organizationId },
      include: this.itemInclude,
    });
  }

  async update(id: string, dto: UpdateServiceItemDto, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.serviceItem.update({
      where: { id },
      data: dto,
      include: this.itemInclude,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.serviceItem.delete({ where: { id } });
  }

  // ── Subtasks ──────────────────────────────────────────────────────────────

  async getSubtasks(serviceItemId: string, organizationId: string) {
    await this.findOne(serviceItemId, organizationId);
    return this.prisma.serviceItemSubtask.findMany({
      where: { serviceItemId },
      orderBy: { sortOrder: 'asc' },
      include: { roleEstimates: { orderBy: { role: 'asc' } } },
    });
  }

  async createSubtask(
    serviceItemId: string,
    dto: CreateSubtaskDto,
    organizationId: string,
  ) {
    await this.findOne(serviceItemId, organizationId);
    return this.prisma.serviceItemSubtask.create({
      data: { ...dto, serviceItemId },
      include: { roleEstimates: true },
    });
  }

  async updateSubtask(
    serviceItemId: string,
    subtaskId: string,
    dto: Partial<CreateSubtaskDto>,
    organizationId: string,
  ) {
    await this.findOne(serviceItemId, organizationId);
    const subtask = await this.prisma.serviceItemSubtask.findFirst({
      where: { id: subtaskId, serviceItemId },
    });
    if (!subtask) throw new NotFoundException(`Subtask ${subtaskId} not found`);
    return this.prisma.serviceItemSubtask.update({
      where: { id: subtaskId },
      data: dto,
      include: { roleEstimates: true },
    });
  }

  async deleteSubtask(
    serviceItemId: string,
    subtaskId: string,
    organizationId: string,
  ) {
    await this.findOne(serviceItemId, organizationId);
    const subtask = await this.prisma.serviceItemSubtask.findFirst({
      where: { id: subtaskId, serviceItemId },
    });
    if (!subtask) throw new NotFoundException(`Subtask ${subtaskId} not found`);
    return this.prisma.serviceItemSubtask.delete({ where: { id: subtaskId } });
  }

  async reorderSubtasks(
    serviceItemId: string,
    orderedIds: string[],
    organizationId: string,
  ) {
    await this.findOne(serviceItemId, organizationId);
    const updates = orderedIds.map((id, index) =>
      this.prisma.serviceItemSubtask.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  // ── Role Estimates ────────────────────────────────────────────────────────

  async upsertRoleEstimate(
    serviceItemId: string,
    subtaskId: string,
    role: string,
    estimatedHours: number,
    organizationId: string,
  ) {
    await this.findOne(serviceItemId, organizationId);
    const subtask = await this.prisma.serviceItemSubtask.findFirst({
      where: { id: subtaskId, serviceItemId },
    });
    if (!subtask) throw new NotFoundException(`Subtask ${subtaskId} not found`);
    return this.prisma.serviceItemRoleEstimate.upsert({
      where: { subtaskId_role: { subtaskId, role } },
      create: { subtaskId, role, estimatedHours },
      update: { estimatedHours },
    });
  }

  async deleteRoleEstimate(
    serviceItemId: string,
    subtaskId: string,
    role: string,
    organizationId: string,
  ) {
    await this.findOne(serviceItemId, organizationId);
    const subtask = await this.prisma.serviceItemSubtask.findFirst({
      where: { id: subtaskId, serviceItemId },
    });
    if (!subtask) throw new NotFoundException(`Subtask ${subtaskId} not found`);
    const estimate = await this.prisma.serviceItemRoleEstimate.findUnique({
      where: { subtaskId_role: { subtaskId, role } },
    });
    if (!estimate)
      throw new NotFoundException(
        `Role estimate for role "${role}" not found`,
      );
    return this.prisma.serviceItemRoleEstimate.delete({
      where: { subtaskId_role: { subtaskId, role } },
    });
  }
}
