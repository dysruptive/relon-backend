import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { LeadMetricsService } from './lead-metrics.service';

@Injectable()
export class LeadsAiService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private leadMetricsService: LeadMetricsService,
  ) {}

  async analyzeRisk(id: string, provider: string | undefined, organizationId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        teamMembers: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        serviceType: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        reps: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const analysis = await this.aiService.analyzeLeadRisk(lead, organizationId, provider);

    // Persist AI results directly — no stage/workflow side-effects needed
    await this.prisma.lead.update({
      where: { id, organizationId },
      data: {
        aiRiskLevel: analysis.riskLevel,
        aiSummary: analysis.summary,
        aiRecommendations: JSON.stringify(analysis.recommendations),
      },
    });

    return analysis;
  }

  async generateAISummary(id: string, provider: string | undefined, organizationId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { name: true, email: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        files: {
          select: { category: true, originalName: true, createdAt: true },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const metrics = await this.leadMetricsService.calculateMetrics(lead.id, lead.createdAt);

    const context = {
      leadName: lead.contactName,
      company: lead.company,
      status: lead.stage,
      estimatedValue: lead.expectedValue,
      source: lead.source,
      assignedTo: lead.assignedTo?.name,
      daysInPipeline: metrics.daysInPipeline,
      daysSinceLastContact: metrics.daysSinceLastContact,
      activityCount: metrics.activityCount,
      recentActivities: lead.activities.map((a) => ({
        type: a.type,
        activityDate: a.activityDate,
        activityTime: a.activityTime,
        reason: a.reason,
        notes: a.notes,
        meetingType: a.meetingType,
        date: a.createdAt,
      })),
      fileCategories: lead.files.map((f) => f.category),
    };

    const prompt = `Analyze this sales lead and provide:
1. A concise summary of the current situation (2-3 sentences)
2. Key insights about the lead's progress
3. Top 3 recommended next actions

Lead Information:
${JSON.stringify(context, null, 2)}

Format your response as JSON with fields: summary, insights (array), nextActions (array).`;

    try {
      const response = await this.aiService.chat(prompt, {}, organizationId, provider);
      const aiResponse = JSON.parse(response.message);

      await this.prisma.lead.update({
        where: { id, organizationId },
        data: {
          aiSummary: aiResponse.summary,
          aiRecommendations: JSON.stringify(aiResponse.nextActions),
        },
      });

      return {
        summary: aiResponse.summary,
        insights: aiResponse.insights || [],
        nextActions: aiResponse.nextActions || [],
        metrics,
      };
    } catch {
      return {
        summary: `${lead.contactName} from ${lead.company} - ${lead.stage} status. In pipeline for ${metrics.daysInPipeline} days.`,
        insights: [
          `Last contact: ${metrics.daysSinceLastContact} days ago`,
          `Total activities: ${metrics.activityCount}`,
          `Files uploaded: ${metrics.fileCount}`,
        ],
        nextActions: this.leadMetricsService.generateSuggestedActions(
          this.leadMetricsService.detectRiskFlags(metrics, Number(lead.expectedValue), lead.stage),
          metrics,
          lead.stage,
        ),
        metrics,
      };
    }
  }

  async draftEmail(id: string, emailType: string, organizationId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: { serviceType: true, assignedTo: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.aiService.draftEmail(lead, emailType, organizationId);
  }
}
