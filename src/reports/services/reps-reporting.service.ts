import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportFiltersDto } from '../dto/report-filters.dto';

export interface RepsOverview {
  totalReps: number;
  avgConversionRate: number;
  totalContractedValue: number;
  avgSalesCycle: number;
}

export interface RepPerformance {
  repId: string;
  repName: string;
  role: string;
  leadsHandled: number;      // Won + Lost closed within period
  closedProjects: number;    // Won leads with dealClosedAt in period
  lostLeads: number;
  conversionRate: number;    // closedProjects / (closedProjects + lostLeads)
  totalContractedValue: number; // sum of contractedValue (fallback: expectedValue) for Won leads
  activitiesLogged: number;
  avgSalesCycle: number;
}

export interface RepStageTime {
  repId: string;
  repName: string;
  stageData: { stage: string; avgDays: number }[];
}

@Injectable()
export class RepsReportingService {
  constructor(private prisma: PrismaService) {}

  async getOverview(filters: ReportFiltersDto, user: any): Promise<RepsOverview> {
    const performance = await this.getPerformanceData(filters, user);

    const totalReps = performance.length;
    const avgConversionRate = totalReps > 0
      ? Math.round(
          performance.reduce((sum, r) => sum + r.conversionRate, 0) / totalReps
        )
      : 0;

    const totalContractedValue = performance.reduce(
      (sum, r) => sum + r.totalContractedValue, 0
    );

    const repsWithCycle = performance.filter((r) => r.avgSalesCycle > 0);
    const avgSalesCycle = repsWithCycle.length > 0
      ? Math.round(
          repsWithCycle.reduce((sum, r) => sum + r.avgSalesCycle, 0) / repsWithCycle.length
        )
      : 0;

    return {
      totalReps,
      avgConversionRate,
      totalContractedValue,
      avgSalesCycle,
    };
  }

  async getPerformanceData(filters: ReportFiltersDto, user: any): Promise<RepPerformance[]> {
    // Build the closed-date filter for leads:
    // A lead counts only when its dealClosedAt falls within the selected period.
    const dateRange = this.getDateRange(filters);
    const closedDateFilter = dateRange ?? { not: null }; // no filter = all-time closed deals

    const reps = await this.prisma.user.findMany({
      where: this.buildWhereClause(filters, user),
      include: {
        assignedLeads: {
          where: {
            stage: { in: ['Won', 'Lost'] },
            dealClosedAt: closedDateFilter,
          },
        },
        activities: {
          where: filters.period ? {
            createdAt: { gte: this.getPeriodStart(filters.period) },
          } : undefined,
        },
      },
    });

    const performance: RepPerformance[] = [];

    for (const rep of reps) {
      const leads = rep.assignedLeads;

      const wonLeads = leads.filter((l) => l.stage === 'Won');
      const closedProjects = wonLeads.length;
      const lostLeads = leads.filter((l) => l.stage === 'Lost').length;
      const closedTotal = closedProjects + lostLeads;
      const conversionRate = closedTotal > 0
        ? Math.round((closedProjects / closedTotal) * 100)
        : 0;

      // Use contractedValue when available, fall back to expectedValue
      const totalContractedValue = wonLeads.reduce(
        (sum, l) => sum + Number(l.contractedValue ?? l.expectedValue), 0
      );

      // Sales cycle: days from lead created to dealClosedAt, for all closed deals in period
      const avgSalesCycle = leads.length > 0
        ? Math.round(
            leads.reduce((sum, l) => {
              const days =
                (new Date(l.dealClosedAt!).getTime() - new Date(l.createdAt).getTime()) /
                (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / leads.length
          )
        : 0;

      performance.push({
        repId: rep.id,
        repName: rep.name,
        role: rep.role,
        leadsHandled: leads.length,
        closedProjects,
        lostLeads,
        conversionRate,
        totalContractedValue,
        activitiesLogged: rep.activities.length,
        avgSalesCycle,
      });
    }

    return performance.sort((a, b) => b.totalContractedValue - a.totalContractedValue);
  }

  async getStageTimeByRep(filters: ReportFiltersDto, user: any): Promise<RepStageTime[]> {
    const dateRange = this.getDateRange(filters);
    const closedDateFilter = dateRange ?? { not: null };

    const reps = await this.prisma.user.findMany({
      where: this.buildWhereClause(filters, user),
      include: {
        assignedLeads: {
          where: {
            stage: { in: ['Won', 'Lost'] },
            dealClosedAt: closedDateFilter,
          },
        },
      },
    });

    const result: RepStageTime[] = [];

    for (const rep of reps) {
      const leadIds = rep.assignedLeads.map(l => l.id);

      if (leadIds.length === 0) continue;

      // Get stage history for this rep's leads
      const stageHistory = await this.prisma.stageHistory.findMany({
        where: { leadId: { in: leadIds } },
        orderBy: { createdAt: 'asc' },
      });

      // Calculate avg time per stage
      const stageStats = new Map<string, { totalDays: number; count: number }>();

      leadIds.forEach((leadId) => {
        const leadStageHistory = stageHistory.filter((h) => h.leadId === leadId);

        leadStageHistory.forEach((entry, idx) => {
          const nextEntry = leadStageHistory[idx + 1];
          const exitTime = nextEntry ? nextEntry.createdAt.getTime() : new Date().getTime();
          const daysInStage = (exitTime - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);

          const existing = stageStats.get(entry.toStage) || { totalDays: 0, count: 0 };
          existing.totalDays += daysInStage;
          existing.count += 1;
          stageStats.set(entry.toStage, existing);
        });
      });

      const stageData = Array.from(stageStats.entries()).map(([stage, stats]) => ({
        stage,
        avgDays: Math.round(stats.totalDays / stats.count),
      }));

      result.push({
        repId: rep.id,
        repName: rep.name,
        stageData,
      });
    }

    return result;
  }

  private buildWhereClause(filters: ReportFiltersDto, user: any) {
    const where: any = {
      organizationId: user.organizationId,
      role: { in: ['SALES', 'BDM', 'CEO', 'ADMIN'] },
      status: 'Active',
    };

    // Role-based filtering
    if (user.role === 'BDM' && user.teamId) {
      where.teamId = user.teamId;
    } else if (user.role === 'SALES') {
      where.id = user.id;
    }

    // Additional filters
    if (filters.assignedToId) {
      where.id = filters.assignedToId;
    }

    return where;
  }

  private getDateRange(filters: ReportFiltersDto): { gte?: Date; lte?: Date } | null {
    if (filters.startDate || filters.endDate) {
      return {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate + 'T23:59:59.999Z') } : {}),
      };
    }
    if (filters.period) {
      return { gte: this.getPeriodStart(filters.period) };
    }
    return null;
  }

  private getPeriodStart(period: 'week' | 'month' | 'quarter' | 'year'): Date {
    const now = new Date();
    const date = new Date(now);

    switch (period) {
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'quarter':
        date.setMonth(date.getMonth() - 3);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }

    return date;
  }
}
