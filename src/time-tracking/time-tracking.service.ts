import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { CreateUserRateDto } from './dto/create-user-rate.dto';
import { CreateProjectBudgetDto } from './dto/create-project-budget.dto';

@Injectable()
export class TimeTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Time Entries ─────────────────────────────────────────────────────────

  async createEntry(dto: CreateTimeEntryDto, userId: string, organizationId: string) {
    const rate = await this.getActiveRate(userId, organizationId);
    const hourlyRate = dto.hourlyRate ?? (rate ? Number(rate.rate) : 0);
    const totalCost = dto.hours * hourlyRate;

    return this.prisma.timeEntry.create({
      data: {
        userId,
        organizationId,
        projectId: dto.projectId,
        date: new Date(dto.date),
        hours: dto.hours,
        description: dto.description,
        billable: dto.billable ?? true,
        hourlyRate,
        totalCost,
        source: dto.source ?? 'manual',
        serviceItemId: dto.serviceItemId,
        serviceItemSubtaskId: dto.serviceItemSubtaskId,
      },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        serviceItem: { select: { id: true, name: true } },
        serviceItemSubtask: { select: { id: true, name: true } },
      },
    });
  }

  async getEntries(
    filters: {
      userId?: string;
      projectId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
    organizationId: string,
  ) {
    const where: any = { organizationId };
    if (filters.userId) where.userId = filters.userId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    return this.prisma.timeEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      take: filters.limit ?? 100,
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        serviceItem: { select: { id: true, name: true } },
        serviceItemSubtask: { select: { id: true, name: true } },
      },
    });
  }

  async updateEntry(
    id: string,
    dto: UpdateTimeEntryDto,
    userId: string,
    organizationId: string,
    isAdmin = false,
  ) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, organizationId },
    });
    if (!entry) throw new NotFoundException(`Time entry ${id} not found`);

    if (!isAdmin && entry.userId !== userId) {
      throw new ForbiddenException('You can only edit your own time entries');
    }

    const hours = dto.hours ?? Number(entry.hours);
    const hourlyRate = dto.hourlyRate ?? (entry.hourlyRate ? Number(entry.hourlyRate) : 0);

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.hours !== undefined && { hours: dto.hours }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.billable !== undefined && { billable: dto.billable }),
        ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.serviceItemId !== undefined && { serviceItemId: dto.serviceItemId }),
        ...(dto.serviceItemSubtaskId !== undefined && { serviceItemSubtaskId: dto.serviceItemSubtaskId }),
        totalCost: hours * hourlyRate,
      },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  async deleteEntry(id: string, userId: string, organizationId: string, isAdmin = false) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, organizationId },
    });
    if (!entry) throw new NotFoundException(`Time entry ${id} not found`);

    if (!isAdmin && entry.userId !== userId) {
      throw new ForbiddenException('You can only delete your own time entries');
    }

    await this.prisma.timeEntry.delete({ where: { id } });
  }

  // ─── User Rates ───────────────────────────────────────────────────────────

  async createRate(dto: CreateUserRateDto, organizationId: string) {
    return this.prisma.userRate.create({
      data: {
        userId: dto.userId,
        organizationId,
        rate: dto.rate,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        type: dto.type ?? 'internal',
      },
    });
  }

  async getRatesForOrg(organizationId: string) {
    return this.prisma.userRate.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getRatesForUser(userId: string, organizationId: string) {
    return this.prisma.userRate.findMany({
      where: { userId, organizationId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async getActiveRate(userId: string, organizationId: string) {
    return this.prisma.userRate.findFirst({
      where: {
        userId,
        organizationId,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        type: 'internal',
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  // ─── Project Budget ───────────────────────────────────────────────────────

  async upsertBudget(dto: CreateProjectBudgetDto, organizationId: string) {
    // Verify project belongs to org
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, organizationId },
    });
    if (!project) throw new NotFoundException(`Project ${dto.projectId} not found`);

    return this.prisma.projectBudget.upsert({
      where: { projectId: dto.projectId },
      update: {
        budgetedHours: dto.budgetedHours,
        budgetedCost: dto.budgetedCost,
      },
      create: {
        projectId: dto.projectId,
        organizationId,
        budgetedHours: dto.budgetedHours ?? 0,
        budgetedCost: dto.budgetedCost ?? 0,
      },
    });
  }

  async getBudget(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return this.prisma.projectBudget.findUnique({ where: { projectId } });
  }

  // ─── Summary Endpoints ────────────────────────────────────────────────────

  async getProjectSummary(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const budget = await this.prisma.projectBudget.findUnique({ where: { projectId } });
    const entries = await this.prisma.timeEntry.findMany({
      where: { projectId, organizationId },
    });

    const actualHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
    const actualCost = entries.reduce((sum, e) => sum + Number(e.totalCost ?? 0), 0);
    const billableHours = entries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + Number(e.hours), 0);

    const budgetedHours = budget?.budgetedHours ? Number(budget.budgetedHours) : 0;
    const budgetedCost = budget?.budgetedCost ? Number(budget.budgetedCost) : 0;

    return {
      projectId,
      budgetedHours,
      budgetedCost,
      actualHours,
      actualCost,
      billableHours,
      hoursVariance: budgetedHours - actualHours,
      costVariance: budgetedCost - actualCost,
      hoursUtilization: budgetedHours
        ? Math.round((actualHours / budgetedHours) * 100)
        : null,
    };
  }

  async getWeeklyTimesheet(startDate: string, organizationId: string, userId?: string) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const where: any = {
      organizationId,
      date: { gte: start, lte: end },
    };
    if (userId) where.userId = userId;

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ userId: 'asc' }, { date: 'asc' }],
    });

    // Group by userId → day
    const byUser: Record<string, any> = {};
    for (const entry of entries) {
      const uid = entry.userId;
      const day = entry.date.toISOString().split('T')[0];
      if (!byUser[uid]) {
        byUser[uid] = { user: entry.user, days: {}, totalHours: 0 };
      }
      if (!byUser[uid].days[day]) byUser[uid].days[day] = 0;
      byUser[uid].days[day] += Number(entry.hours);
      byUser[uid].totalHours += Number(entry.hours);
    }

    return {
      startDate,
      endDate: end.toISOString().split('T')[0],
      rows: Object.values(byUser),
    };
  }
}
