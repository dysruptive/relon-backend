import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportFiltersDto } from '../dto/report-filters.dto';

export interface ClientsOverview {
  totalClients: number;
  activeClients: number;
  dormantClients: number;
  atRiskClients: number;
  avgHealthScore: number;
  totalRevenue: number;
}

export interface RevenueByClient {
  clientId: string;
  clientName: string;
  segment: string;
  status: string;
  healthScore: number | null;
  lifetimeRevenue: number;
  projectCount: number;
  activeProjectCount: number;
  lastContactDate: Date | null;
}

export interface HealthTrends {
  segment: string;
  avgHealthScore: number;
  clientCount: number;
}

export interface RetentionMetrics {
  status: string;
  count: number;
  percentage: number;
}

export interface EngagementTrendData {
  period: string;
  avgActivitiesPerClient: number;
  totalActivities: number;
  activeClients: number;
}

export interface HealthScoreTrendData {
  period: string;
  avgHealthScore: number;
  clientsWithScore: number;
}

@Injectable()
export class ClientsReportingService {
  constructor(private prisma: PrismaService) {}

  async getOverview(filters: ReportFiltersDto, user: any): Promise<ClientsOverview> {
    const clients = await this.getFilteredClients(filters, user);

    const activeClients = clients.filter((c) => c.status === 'Active').length;
    const dormantClients = clients.filter((c) => c.status === 'Dormant').length;
    const atRiskClients = clients.filter((c) => c.status === 'At Risk').length;

    const clientsWithScore = clients.filter((c) => c.healthScore !== null);
    const avgHealthScore = clientsWithScore.length > 0
      ? Math.round(
          clientsWithScore.reduce((sum, c) => sum + (c.healthScore || 0), 0) / clientsWithScore.length
        )
      : 0;

    const totalRevenue = clients.reduce((sum, c) => sum + Number(c.lifetimeRevenue || 0), 0);

    return {
      totalClients: clients.length,
      activeClients,
      dormantClients,
      atRiskClients,
      avgHealthScore,
      totalRevenue,
    };
  }

  async getRevenueAnalysis(filters: ReportFiltersDto, user: any): Promise<RevenueByClient[]> {
    const clients = await this.prisma.client.findMany({
      where: this.buildWhereClause(filters, user),
      include: {
        accountManager: true,
      },
      orderBy: {
        lifetimeRevenue: 'desc',
      },
    });

    return clients.map((client) => ({
      clientId: client.id,
      clientName: client.name,
      segment: client.segment,
      status: client.status,
      healthScore: client.healthScore,
      lifetimeRevenue: Number(client.lifetimeRevenue || 0),
      projectCount: client.totalProjectCount || 0,
      activeProjectCount: client.activeProjectCount || 0,
      lastContactDate: client.lastContactDate,
    }));
  }

  async getHealthTrends(filters: ReportFiltersDto, user: any): Promise<HealthTrends[]> {
    const clients = await this.getFilteredClients(filters, user);

    const segmentMap = new Map<string, { totalScore: number; count: number }>();

    clients.forEach((client) => {
      if (client.healthScore !== null) {
        const existing = segmentMap.get(client.segment) || { totalScore: 0, count: 0 };
        existing.totalScore += client.healthScore;
        existing.count += 1;
        segmentMap.set(client.segment, existing);
      }
    });

    return Array.from(segmentMap.entries()).map(([segment, data]) => ({
      segment,
      avgHealthScore: Math.round(data.totalScore / data.count),
      clientCount: data.count,
    }));
  }

  async getEngagementTrends(filters: ReportFiltersDto, user: any): Promise<EngagementTrendData[]> {
    const periodStart = this.getPeriodStart(filters.period || 'month');
    const now = new Date();

    // Get all activities for clients in the period
    const activities = await this.prisma.activity.findMany({
      where: {
        organizationId: user.organizationId,
        clientId: { not: null },
        createdAt: { gte: periodStart, lte: now },
      },
      include: {
        client: true,
      },
    });

    // Group by week for granular trends
    const weeklyData = new Map<string, { activities: number; clients: Set<string> }>();

    activities.forEach((activity) => {
      const date = new Date(activity.createdAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week
      const weekKey = weekStart.toISOString().split('T')[0];

      const existing = weeklyData.get(weekKey) || { activities: 0, clients: new Set() };
      existing.activities += 1;
      if (activity.clientId) existing.clients.add(activity.clientId);
      weeklyData.set(weekKey, existing);
    });

    return Array.from(weeklyData.entries())
      .map(([period, data]) => ({
        period,
        totalActivities: data.activities,
        activeClients: data.clients.size,
        avgActivitiesPerClient: data.clients.size > 0 ? Math.round((data.activities / data.clients.size) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getHealthScoreTrends(filters: ReportFiltersDto, user: any): Promise<HealthScoreTrendData[]> {
    // Since we don't have historical health score data, we'll show current health scores grouped by creation period
    const periodStart = this.getPeriodStart(filters.period || 'month');
    const clients = await this.prisma.client.findMany({
      where: {
        ...this.buildWhereClause(filters, user),
        healthScore: { not: null },
        createdAt: { gte: periodStart },
      },
    });

    // Group by month for trends
    const monthlyData = new Map<string, { totalScore: number; count: number }>();

    clients.forEach((client) => {
      const date = new Date(client.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const existing = monthlyData.get(monthKey) || { totalScore: 0, count: 0 };
      existing.totalScore += client.healthScore || 0;
      existing.count += 1;
      monthlyData.set(monthKey, existing);
    });

    return Array.from(monthlyData.entries())
      .map(([period, data]) => ({
        period,
        avgHealthScore: Math.round(data.totalScore / data.count),
        clientsWithScore: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getRetentionMetrics(filters: ReportFiltersDto, user: any): Promise<RetentionMetrics[]> {
    const clients = await this.getFilteredClients(filters, user);
    const total = clients.length;

    const statusMap = new Map<string, number>();
    clients.forEach((client) => {
      statusMap.set(client.status, (statusMap.get(client.status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
  }

  private async getFilteredClients(filters: ReportFiltersDto, user: any) {
    return this.prisma.client.findMany({
      where: this.buildWhereClause(filters, user),
      include: {
        accountManager: true,
      },
    });
  }

  private buildWhereClause(filters: ReportFiltersDto, user: any) {
    const where: any = {};
    where.organizationId = user.organizationId;

    // Period filter
    if (filters.period) {
      const periodStart = this.getPeriodStart(filters.period);
      where.createdAt = { gte: periodStart };
    }

    // Role-based filtering
    if (user.role === 'SALES') {
      where.accountManagerId = user.id;
    } else if (user.role === 'BDM' && user.teamId) {
      where.accountManager = {
        teamId: user.teamId,
      };
    }

    // Additional filters
    if (filters.clientId) {
      where.id = filters.clientId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    return where;
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
