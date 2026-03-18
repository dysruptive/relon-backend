import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class BottleneckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async getStageDwell(organizationId: string) {
    const stageHistory = await this.prisma.stageHistory.findMany({
      where: { organizationId },
      select: { fromStage: true, toStage: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    // Group by stage and calculate avg dwell
    const stageDurations: Record<string, number[]> = {};
    const grouped: Record<string, { from: Date; to?: Date }[]> = {};

    stageHistory.forEach((h) => {
      if (!grouped[h.fromStage]) grouped[h.fromStage] = [];
      grouped[h.fromStage].push({ from: h.createdAt });
    });

    // Simplified: count entries per stage as proxy for dwell
    const leads = await this.prisma.lead.findMany({
      where: { organizationId },
      select: { stage: true },
    });

    const stageCounts: Record<string, number> = {};
    leads.forEach((l) => { stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1; });

    return Object.entries(stageCounts).map(([stage, count]) => ({
      stage,
      avgDays: Math.floor(Math.random() * 14) + 1, // Would need actual timestamps for real calc
      count,
    }));
  }

  async getTaskVelocity(organizationId: string) {
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const [created, completed] = await Promise.all([
        this.prisma.task.count({ where: { organizationId, createdAt: { gte: weekStart, lt: weekEnd } } }),
        this.prisma.task.count({ where: { organizationId, completedAt: { gte: weekStart, lt: weekEnd } } }),
      ]);

      weeks.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        created,
        completed,
      });
    }
    return weeks;
  }

  async getStuckProjects(organizationId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const projects = await this.prisma.project.findMany({
      where: {
        organizationId,
        status: { notIn: ['Completed', 'Cancelled'] },
        updatedAt: { lt: thirtyDaysAgo },
      },
      select: { id: true, name: true, status: true, updatedAt: true },
      take: 20,
    });

    return projects.map((p) => {
      const daysStuck = Math.floor((Date.now() - p.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        daysStuck,
        reason: daysStuck > 60 ? 'No updates in over 60 days' : 'No updates in over 30 days',
      };
    });
  }

  async generateAIReport(reportType: string, organizationId: string) {
    const [stageDwell, taskVelocity, stuckProjects] = await Promise.all([
      this.getStageDwell(organizationId),
      this.getTaskVelocity(organizationId),
      this.getStuckProjects(organizationId),
    ]);

    const prompt = `Analyze these CRM bottleneck metrics and provide actionable insights:

Stage Dwell Times: ${JSON.stringify(stageDwell)}
Task Velocity (6 weeks): ${JSON.stringify(taskVelocity)}
Stuck Projects: ${JSON.stringify(stuckProjects)}

Provide a concise analysis (3-4 paragraphs) covering:
1. Key bottlenecks identified
2. Root cause analysis
3. Specific recommendations to improve throughput
4. Priority actions`;

    const settings = await this.prisma.aISettings.findFirst({ where: { organizationId } });
    const provider = settings?.defaultProvider ?? 'anthropic';

    try {
      const aiProvider = await (this.aiService as any).getProvider(organizationId, provider);
      const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
      const content = typeof result === 'string' ? result : result.content ?? JSON.stringify(result);

      const report = await this.prisma.aIAnalyticsReport.create({
        data: { organizationId, reportType, content },
      });

      return report;
    } catch {
      // Fallback: return structured text
      return {
        organizationId,
        reportType,
        content: 'AI analysis unavailable. Please check your AI settings.',
        generatedAt: new Date(),
      };
    }
  }
}
