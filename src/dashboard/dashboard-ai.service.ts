import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class DashboardAiService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async getPipelineInsights(organizationId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [stageCounts, urgencyCounts, pipelineAgg, staleCount] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['stage'],
        where: { organizationId, stage: { notIn: ['Won', 'Lost'] } },
        _count: { id: true },
        _sum: { expectedValue: true },
      }),
      this.prisma.lead.groupBy({
        by: ['urgency'],
        where: { organizationId, stage: { notIn: ['Won', 'Lost'] } },
        _count: { id: true },
      }),
      this.prisma.lead.aggregate({
        where: { organizationId, stage: { notIn: ['Won', 'Lost'] } },
        _sum: { expectedValue: true },
        _avg: { expectedValue: true },
        _count: { id: true },
      }),
      this.prisma.lead.count({
        where: {
          organizationId,
          stage: { notIn: ['Won', 'Lost'] },
          updatedAt: { lt: sevenDaysAgo },
        },
      }),
    ]);

    const [wonCount, totalClosed] = await Promise.all([
      this.prisma.lead.count({ where: { organizationId, stage: 'Won' } }),
      this.prisma.lead.count({ where: { organizationId, stage: { in: ['Won', 'Lost'] } } }),
    ]);

    const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

    const byStage = Object.fromEntries(
      stageCounts.map((s) => [
        s.stage,
        { count: s._count.id, value: Number(s._sum.expectedValue ?? 0) },
      ]),
    );

    const byUrgency = Object.fromEntries(
      urgencyCounts.map((u) => [u.urgency, u._count.id]),
    );

    const data = {
      totalLeads: pipelineAgg._count.id,
      byStage,
      totalValue: Number(pipelineAgg._sum.expectedValue ?? 0),
      avgDealSize: Math.round(Number(pipelineAgg._avg.expectedValue ?? 0)),
      winRate,
      staleLeads: staleCount,
      byUrgency,
    };

    return this.aiService.analyzePipeline(data, organizationId);
  }
}
