import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportFiltersDto } from '../dto/report-filters.dto';

export interface LeadsOverview {
  totalLeads: number;
  conversionRate: number;
  pipelineValue: number;
  weightedForecast: number;
  avgCloseTime: number;
  leadsByStage: { stage: string; count: number; value: number }[];
  wonLeads: number;
  lostLeads: number;
  overdueLeads: number;
}

export interface StageAnalysis {
  stage: string;
  count: number;
  avgDaysInStage: number;
  totalValue: number;
  avgValue: number;
}

export interface ConversionFunnel {
  stage: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
}

export interface RevenueByRep {
  repId: string;
  repName: string;
  leadsHandled: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  totalRevenue: number;
  avgDealSize: number;
}

export interface OverdueLead {
  leadId: string;
  company: string;
  contactName: string;
  stage: string;
  value: number;
  likelyStartDate: Date;
  daysOverdue: number;
  assignedToName: string | null;
}

@Injectable()
export class LeadsReportingService {
  constructor(private prisma: PrismaService) {}

  async getOverview(filters: ReportFiltersDto, user: any): Promise<LeadsOverview> {
    const roleFilter = this.buildRoleFilter(filters, user);
    const dateRange = this.getDateRange(filters);

    // Active leads (no date filter) — pipeline value, forecast, overdue are always "current state"
    const activeLeads = await this.prisma.lead.findMany({
      where: { ...roleFilter, stage: { notIn: ['Won', 'Lost'] } },
      include: { assignedTo: true },
    });

    // Closed leads filtered by dealClosedAt — won/lost counts, conversion, avgCloseTime
    const closedLeads = await this.prisma.lead.findMany({
      where: {
        ...roleFilter,
        stage: { in: ['Won', 'Lost'] },
        ...(dateRange ? { dealClosedAt: dateRange } : {}),
      },
    });

    const wonLeads = closedLeads.filter((l) => l.stage === 'Won').length;
    const lostLeads = closedLeads.filter((l) => l.stage === 'Lost').length;
    const closedCount = wonLeads + lostLeads;
    const conversionRate = closedCount > 0 ? Math.round((wonLeads / closedCount) * 100) : 0;

    const pipelineValue = activeLeads.reduce((sum, l) => sum + Number(l.expectedValue), 0);

    // Weighted forecast using live stage probabilities from the database
    const pipelineStages = await this.prisma.pipelineStage.findMany({
      where: { organizationId: user.organizationId },
      select: { name: true, probability: true },
    });
    const stageProbabilityMap = new Map(pipelineStages.map((s) => [s.name, s.probability]));
    const weightedForecast = Math.round(
      activeLeads.reduce((sum, l) => {
        const probability = stageProbabilityMap.get(l.stage) ?? 0;
        return sum + (Number(l.expectedValue) * probability) / 100;
      }, 0),
    );

    const now = new Date();
    const overdueLeads = activeLeads.filter((l) => {
      if (!l.likelyStartDate) return false;
      return new Date(l.likelyStartDate) < now;
    }).length;

    const avgCloseTime =
      closedLeads.length > 0
        ? Math.round(
            closedLeads.reduce((sum, l) => {
              const days =
                (new Date(l.dealClosedAt!).getTime() - new Date(l.createdAt).getTime()) /
                (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / closedLeads.length,
          )
        : 0;

    // Stage breakdown across all leads
    const allLeads = [...activeLeads, ...closedLeads];
    const stageMap = new Map<string, { count: number; value: number }>();
    allLeads.forEach((lead) => {
      const existing = stageMap.get(lead.stage) || { count: 0, value: 0 };
      stageMap.set(lead.stage, {
        count: existing.count + 1,
        value: existing.value + Number(lead.expectedValue),
      });
    });
    const leadsByStage = Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value,
    }));

    return {
      totalLeads: allLeads.length,
      conversionRate,
      pipelineValue,
      weightedForecast,
      avgCloseTime,
      leadsByStage,
      wonLeads,
      lostLeads,
      overdueLeads,
    };
  }

  async getStageAnalysis(filters: ReportFiltersDto, user: any): Promise<StageAnalysis[]> {
    const leads = await this.getFilteredLeads(filters, user);
    const leadIds = leads.map((l) => l.id);

    const stageHistory = await this.prisma.stageHistory.findMany({
      where: { leadId: { in: leadIds } },
      orderBy: { createdAt: 'asc' },
    });

    const stageStats = new Map<string, { totalDays: number; count: number; leads: Set<string>; value: number }>();

    leadIds.forEach((leadId) => {
      const leadStageHistory = stageHistory.filter((h) => h.leadId === leadId);
      const lead = leads.find((l) => l.id === leadId)!;

      leadStageHistory.forEach((entry, idx) => {
        const nextEntry = leadStageHistory[idx + 1];
        const exitTime = nextEntry ? nextEntry.createdAt.getTime() : new Date().getTime();
        const daysInStage = (exitTime - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);

        const existing = stageStats.get(entry.toStage) || { totalDays: 0, count: 0, leads: new Set(), value: 0 };
        existing.totalDays += daysInStage;
        existing.count += 1;
        existing.leads.add(leadId);
        existing.value += Number(lead.expectedValue);
        stageStats.set(entry.toStage, existing);
      });
    });

    return Array.from(stageStats.entries()).map(([stage, stats]) => ({
      stage,
      count: stats.leads.size,
      avgDaysInStage: Math.round(stats.totalDays / stats.count),
      totalValue: stats.value,
      avgValue: Math.round(stats.value / stats.leads.size),
    }));
  }

  async getConversionFunnel(filters: ReportFiltersDto, user: any): Promise<ConversionFunnel[]> {
    const leads = await this.getFilteredLeads(filters, user);
    const stages = ['New', 'Contacted', 'Quoted', 'Negotiation', 'Won'];

    const stageCounts: { [key: string]: number } = {};
    stages.forEach((stage) => {
      stageCounts[stage] = leads.filter((l) => l.stage === stage).length;
    });

    const result: ConversionFunnel[] = [];
    let previousCount = stageCounts['New'];

    stages.forEach((stage, idx) => {
      const count = stageCounts[stage];
      let conversionRate = 0;
      let dropOffRate = 0;

      if (idx > 0 && previousCount > 0) {
        conversionRate = Math.round((count / previousCount) * 100);
        dropOffRate = Math.round(((previousCount - count) / previousCount) * 100);
      }

      result.push({ stage, count, conversionRate, dropOffRate });
      previousCount = count;
    });

    return result;
  }

  async getOverdueLeads(filters: ReportFiltersDto, user: any): Promise<OverdueLead[]> {
    // Overdue is always current state — no date filter
    const leads = await this.prisma.lead.findMany({
      where: this.buildRoleFilter(filters, user),
      include: { assignedTo: true },
    });

    const now = new Date();
    return leads
      .filter((l) => {
        if (l.stage === 'Won' || l.stage === 'Lost' || !l.likelyStartDate) return false;
        return new Date(l.likelyStartDate) < now;
      })
      .map((l) => {
        const expectedDate = new Date(l.likelyStartDate!);
        const daysOverdue = Math.floor((now.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          leadId: l.id,
          company: l.company,
          contactName: l.contactName,
          stage: l.stage,
          value: Number(l.expectedValue),
          likelyStartDate: l.likelyStartDate!,
          daysOverdue,
          assignedToName: l.assignedTo?.name || null,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  async getRevenueByRep(filters: ReportFiltersDto, user: any): Promise<RevenueByRep[]> {
    const roleFilter = this.buildRoleFilter(filters, user);
    const dateRange = this.getDateRange(filters);

    // Filter by dealClosedAt so revenue reflects deals closed in the selected period
    const leads = await this.prisma.lead.findMany({
      where: {
        ...roleFilter,
        ...(dateRange ? { dealClosedAt: dateRange } : {}),
      },
      include: { assignedTo: true },
    });

    const repMap = new Map<string, { repName: string; leads: any[] }>();
    leads.forEach((lead) => {
      if (lead.assignedTo) {
        const existing = repMap.get(lead.assignedToId!) || { repName: lead.assignedTo.name, leads: [] };
        existing.leads.push(lead);
        repMap.set(lead.assignedToId!, existing);
      }
    });

    return Array.from(repMap.entries())
      .map(([repId, data]) => {
        const wonLeads = data.leads.filter((l) => l.stage === 'Won').length;
        const lostLeads = data.leads.filter((l) => l.stage === 'Lost').length;
        const closedLeads = wonLeads + lostLeads;
        const conversionRate = closedLeads > 0 ? Math.round((wonLeads / closedLeads) * 100) : 0;
        const totalRevenue = data.leads
          .filter((l: any) => l.stage === 'Won')
          .reduce((sum: number, l: any) => sum + (l.contractedValue ?? l.expectedValue), 0);
        const avgDealSize = wonLeads > 0 ? Math.round(totalRevenue / wonLeads) : 0;

        return {
          repId,
          repName: data.repName,
          leadsHandled: data.leads.length,
          wonLeads,
          lostLeads,
          conversionRate,
          totalRevenue,
          avgDealSize,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  private async getFilteredLeads(filters: ReportFiltersDto, user: any) {
    return this.prisma.lead.findMany({
      where: this.buildWhereClause(filters, user),
      include: { assignedTo: true },
    });
  }

  // Role + additional field filters (no date) — used for current-state queries
  private buildRoleFilter(filters: ReportFiltersDto, user: any) {
    const where: any = {};
    where.organizationId = user.organizationId;

    if (user.role === 'SALES') {
      where.assignedToId = user.id;
    } else if (user.role === 'BDM' && user.teamId) {
      where.assignedTo = { teamId: user.teamId };
    }

    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.stage) where.stage = filters.stage;

    return where;
  }

  // Full filter with createdAt date anchor — used for stage analysis / funnel
  private buildWhereClause(filters: ReportFiltersDto, user: any) {
    const where: any = this.buildRoleFilter(filters, user);
    const dateRange = this.getDateRange(filters);
    if (dateRange) where.createdAt = dateRange;
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
