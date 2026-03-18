import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardTrendsService {
  constructor(private prisma: PrismaService) {}

  async getRevenueTrend(organizationId: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11, 1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const completed = await this.prisma.project.findMany({
      where: {
        organizationId,
        status: 'Completed',
        completedDate: { gte: twelveMonthsAgo },
      },
      select: { completedDate: true, contractedValue: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      buckets.set(key, 0);
    }

    for (const p of completed) {
      if (!p.completedDate) continue;
      const key = p.completedDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (buckets.has(key)) {
        buckets.set(key, buckets.get(key)! + Number(p.contractedValue ?? 0));
      }
    }

    return Array.from(buckets.entries()).map(([month, revenue]) => ({ month, revenue }));
  }

  async getLeadVolumeTrend(organizationId: string) {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);
    twelveWeeksAgo.setHours(0, 0, 0, 0);

    const leads = await this.prisma.lead.findMany({
      where: { organizationId, createdAt: { gte: twelveWeeksAgo }, deletedAt: null },
      select: { createdAt: true },
    });

    const weeks: { week: string; count: number; start: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i * 7 - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const count = leads.filter((l) => l.createdAt >= start && l.createdAt < end).length;
      weeks.push({
        week: `W${12 - i}`,
        count,
        start: start.toISOString().split('T')[0],
      });
    }
    return weeks;
  }
}
