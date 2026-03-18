import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface DashboardMetrics {
  // Revenue metrics
  totalRevenue: number;
  monthlyRevenue: number;
  quarterlyRevenue: number;
  revenueByClient: {
    clientId: string;
    clientName: string;
    revenue: number;
  }[];
  revenueByProject: {
    projectId: string;
    projectName: string;
    revenue: number;
  }[];

  // Conversion metrics
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  winRate: number;
  avgDealSize: number;

  // Funnel metrics
  funnelDropOff: {
    stage: string;
    count: number;
    dropOffRate: number;
  }[];

  // Time metrics
  avgTimeToQuote: number;
  avgTimeToClose: number;

  // Project metrics
  totalProjects: number;
  activeProjects: number;
  projectsByStatus: { status: string; count: number }[];
  projectsAtRisk: {
    projectId: string;
    projectName: string;
    reason: string;
  }[];

  // Pipeline health
  pipelineValue: number;
  highValueDeals: {
    leadId: string;
    company: string;
    value: number;
    stage: string;
  }[];
  stalledLeads: {
    leadId: string;
    company: string;
    daysStalled: number;
    stage: string;
  }[];

  // Client metrics
  activeClients: number;
  topClients: {
    clientId: string;
    clientName: string;
    revenue: number;
  }[];

  // Risk indicators
  revenueConcentration: {
    topClientPercentage: number;
    top5ClientsPercentage: number;
    isHighRisk: boolean;
  };
}

@Injectable()
export class DashboardMetricsService {
  constructor(private prisma: PrismaService) {}

  async getMetrics(
    organizationId: string,
    period: 'week' | 'month' | 'quarter' = 'month',
    executingCompany?: string,
  ): Promise<DashboardMetrics> {
    const now = new Date();
    const periodStart = this.getPeriodStart(period, now);
    void periodStart; // used for future period-scoped filtering
    const monthStart = this.getPeriodStart('month', now);
    const quarterStart = this.getPeriodStart('quarter', now);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);

    const lf: any = { organizationId, ...(executingCompany ? { executingCompany } : {}) };
    const pf: any = { organizationId, ...(executingCompany ? { executingCompany } : {}) };

    const [
      stageCounts,
      pipelineAgg,
      projectStatusCounts,
      highValueDeals,
      stalledLeads,
      monthlyRevenueAgg,
      quarterlyRevenueAgg,
      projectsAtRisk,
      timeMetricLeads,
      leanProjects,
    ] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['stage'],
        where: lf,
        _count: { id: true },
      }),
      this.prisma.lead.aggregate({
        where: { stage: { notIn: ['Won', 'Lost'] }, ...lf },
        _sum: { expectedValue: true },
        _avg: { expectedValue: true },
        _count: { id: true },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        where: pf,
        _count: { id: true },
      }),
      this.prisma.lead.findMany({
        where: { stage: { notIn: ['Won', 'Lost'] }, ...lf },
        select: { id: true, company: true, expectedValue: true, stage: true },
        orderBy: { expectedValue: 'desc' },
        take: 5,
      }),
      this.prisma.lead.findMany({
        where: {
          stage: { notIn: ['Won', 'Lost'] },
          updatedAt: { lt: thirtyDaysAgo },
          ...lf,
        },
        select: { id: true, company: true, updatedAt: true, stage: true },
        orderBy: { updatedAt: 'asc' },
        take: 20,
      }),
      this.prisma.project.aggregate({
        where: {
          status: 'Completed',
          completedDate: { gte: monthStart, lte: now },
          ...pf,
        },
        _sum: { contractedValue: true },
      }),
      this.prisma.project.aggregate({
        where: {
          status: 'Completed',
          completedDate: { gte: quarterStart, lte: now },
          ...pf,
        },
        _sum: { contractedValue: true },
      }),
      this.prisma.project.findMany({
        where: {
          OR: [
            { status: 'On Hold' },
            { status: 'Active', startDate: null },
            { status: 'Active', startDate: { lt: sixMonthsAgo } },
          ],
          ...pf,
        },
        select: { id: true, name: true, status: true, startDate: true },
      }),
      this.prisma.lead.findMany({
        select: { createdAt: true, quoteSentAt: true, dealClosedAt: true },
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000),
          },
          OR: [{ quoteSentAt: { not: null } }, { dealClosedAt: { not: null } }],
          ...lf,
        },
      }),
      this.prisma.project.findMany({
        select: { id: true, name: true, contractedValue: true },
        where: pf,
        orderBy: { contractedValue: 'desc' },
        take: 10,
      }),
    ]);

    // Client revenue
    let totalRevenue: number;
    let revenueByClient: { clientId: string; clientName: string; revenue: number }[];
    let activeClients: number;

    if (executingCompany) {
      const projectsWithClients = await this.prisma.project.findMany({
        where: { organizationId, executingCompany, status: 'Completed' },
        select: {
          contractedValue: true,
          client: { select: { id: true, name: true, status: true } },
        },
      });
      const clientMap = new Map<string, { name: string; status: string; revenue: number }>();
      for (const proj of projectsWithClients) {
        if (!proj.client) continue;
        const entry = clientMap.get(proj.client.id);
        if (entry) {
          entry.revenue += Number(proj.contractedValue ?? 0);
        } else {
          clientMap.set(proj.client.id, {
            name: proj.client.name,
            status: proj.client.status,
            revenue: Number(proj.contractedValue ?? 0),
          });
        }
      }
      const sorted = [...clientMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
      totalRevenue = sorted.reduce((sum, [, c]) => sum + c.revenue, 0);
      revenueByClient = sorted.map(([id, c]) => ({
        clientId: id,
        clientName: c.name,
        revenue: c.revenue,
      }));
      activeClients = sorted.filter(([, c]) => c.status === 'Active').length;
    } else {
      const [clientRevAgg, leanClients] = await Promise.all([
        this.prisma.client.aggregate({
          where: { organizationId },
          _sum: { lifetimeRevenue: true },
        }),
        this.prisma.client.findMany({
          where: { organizationId },
          select: { id: true, name: true, lifetimeRevenue: true, status: true },
          orderBy: { lifetimeRevenue: 'desc' },
        }),
      ]);
      totalRevenue = Number(clientRevAgg._sum.lifetimeRevenue ?? 0);
      revenueByClient = leanClients.map((c) => ({
        clientId: c.id,
        clientName: c.name,
        revenue: Number(c.lifetimeRevenue ?? 0),
      }));
      activeClients = leanClients.filter((c) => c.status === 'Active').length;
    }

    const stageCountMap = Object.fromEntries(
      stageCounts.map((s) => [s.stage, s._count.id]),
    );
    const totalLeads = Object.values(stageCountMap).reduce((a, b) => a + b, 0);
    const wonLeads = stageCountMap['Won'] ?? 0;
    const lostLeads = stageCountMap['Lost'] ?? 0;
    const closedLeads = wonLeads + lostLeads;
    const winRate = closedLeads > 0 ? Math.round((wonLeads / closedLeads) * 100) : 0;

    const pipelineValue = Number(pipelineAgg._sum.expectedValue ?? 0);
    const avgDealSize = Math.round(Number(pipelineAgg._avg.expectedValue ?? 0));

    const monthlyRevenue = Number(monthlyRevenueAgg._sum.contractedValue ?? 0);
    const quarterlyRevenue = Number(quarterlyRevenueAgg._sum.contractedValue ?? 0);

    const topClients = revenueByClient.slice(0, 5);
    const revenueConcentration = this.calculateRevenueConcentration(revenueByClient, totalRevenue);

    const statusCountMap = Object.fromEntries(
      projectStatusCounts.map((s) => [s.status, s._count.id]),
    );
    const totalProjects = Object.values(statusCountMap).reduce((a, b) => a + b, 0);
    const activeProjects = statusCountMap['Active'] ?? 0;

    const allStatuses = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];
    const projectsByStatus = allStatuses.map((status) => ({
      status,
      count: statusCountMap[status] ?? 0,
    }));

    const computedProjectsAtRisk = projectsAtRisk.map((project) => {
      const reasons: string[] = [];
      if (project.status === 'On Hold') reasons.push('Project on hold');
      if (project.status === 'Active' && !project.startDate)
        reasons.push('Active but no start date');
      if (project.status === 'Active' && project.startDate) {
        const monthsActive =
          (now.getTime() - project.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsActive > 6) reasons.push(`Active for ${Math.round(monthsActive)} months`);
      }
      return { projectId: project.id, projectName: project.name, reason: reasons.join(', ') };
    });

    const funnelDropOff = this.calculateFunnelDropOff(stageCountMap);
    const { avgTimeToQuote, avgTimeToClose } = this.calculateTimeMetricsFromLeads(timeMetricLeads);

    const highValueDealsResult = highValueDeals.map((l) => ({
      leadId: l.id,
      company: l.company,
      value: Number(l.expectedValue),
      stage: l.stage,
    }));

    const stalledLeadsResult = stalledLeads.map((l) => {
      const daysStalled = Math.floor(
        (now.getTime() - l.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      return { leadId: l.id, company: l.company, daysStalled, stage: l.stage };
    });

    const revenueByProject = leanProjects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      revenue: Number(p.contractedValue ?? 0),
    }));

    return {
      totalRevenue,
      monthlyRevenue,
      quarterlyRevenue,
      revenueByClient,
      revenueByProject,
      totalLeads,
      wonLeads,
      lostLeads,
      winRate,
      avgDealSize,
      funnelDropOff,
      avgTimeToQuote,
      avgTimeToClose,
      totalProjects,
      activeProjects,
      projectsByStatus,
      projectsAtRisk: computedProjectsAtRisk,
      pipelineValue,
      highValueDeals: highValueDealsResult,
      stalledLeads: stalledLeadsResult,
      activeClients,
      topClients,
      revenueConcentration,
    };
  }

  private getPeriodStart(period: 'week' | 'month' | 'quarter', now: Date): Date {
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
    }
    return date;
  }

  private calculateFunnelDropOff(
    stageCountMap: Record<string, number>,
  ): DashboardMetrics['funnelDropOff'] {
    const stages = ['New', 'Contacted', 'Quoted', 'Negotiation', 'Won', 'Lost'];
    const result: DashboardMetrics['funnelDropOff'] = [];
    let previousCount = stageCountMap['New'] ?? 0;

    stages.forEach((stage, idx) => {
      const count = stageCountMap[stage] ?? 0;
      let dropOffRate = 0;
      if (idx > 0 && previousCount > 0) {
        dropOffRate = Math.round(((previousCount - count) / previousCount) * 100);
      }
      result.push({ stage, count, dropOffRate: Math.max(0, dropOffRate) });
      previousCount = count;
    });

    return result;
  }

  private calculateTimeMetricsFromLeads(
    leads: { createdAt: Date; quoteSentAt: Date | null; dealClosedAt: Date | null }[],
  ): { avgTimeToQuote: number; avgTimeToClose: number } {
    const leadsWithQuote = leads.filter((l) => l.quoteSentAt);
    const avgTimeToQuote =
      leadsWithQuote.length > 0
        ? Math.round(
            leadsWithQuote.reduce(
              (sum, l) =>
                sum + (l.quoteSentAt!.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24),
              0,
            ) / leadsWithQuote.length,
          )
        : 0;

    const leadsWithClose = leads.filter((l) => l.dealClosedAt);
    const avgTimeToClose =
      leadsWithClose.length > 0
        ? Math.round(
            leadsWithClose.reduce(
              (sum, l) =>
                sum +
                (l.dealClosedAt!.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24),
              0,
            ) / leadsWithClose.length,
          )
        : 0;

    return { avgTimeToQuote, avgTimeToClose };
  }

  private calculateRevenueConcentration(
    revenueByClient: { clientId: string; clientName: string; revenue: number }[],
    totalRevenue: number,
  ): DashboardMetrics['revenueConcentration'] {
    if (totalRevenue === 0 || revenueByClient.length === 0) {
      return { topClientPercentage: 0, top5ClientsPercentage: 0, isHighRisk: false };
    }
    const topClient = revenueByClient[0];
    const top5Revenue = revenueByClient.slice(0, 5).reduce((sum, c) => sum + c.revenue, 0);
    const topClientPercentage = Math.round((topClient.revenue / totalRevenue) * 100);
    const top5ClientsPercentage = Math.round((top5Revenue / totalRevenue) * 100);
    return { topClientPercentage, top5ClientsPercentage, isHighRisk: top5ClientsPercentage > 50 };
  }
}
