import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface StageTimelineEntry {
  stage: string;
  enteredAt: Date;
  daysSpent: number;
  changedBy?: string;
}

export interface LeadMetrics {
  daysInPipeline: number;
  daysSinceLastContact: number;
  activityCount: number;
  fileCount: number;
  daysToQuotation?: number;
  daysFromQuotationToClose?: number;
  stageTimeline?: StageTimelineEntry[];
}

export interface RiskFlag {
  type:
    | 'NO_CONTACT'
    | 'LONG_PIPELINE'
    | 'HIGH_VALUE_STALE'
    | 'NO_ACTIVITY'
    | 'HIGH_PROBABILITY';
  severity: 'low' | 'medium' | 'high' | 'positive';
  message: string;
  icon: string;
}

@Injectable()
export class LeadMetricsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate metrics for many leads in 3 batch queries instead of 4×N queries.
   * Returns a Map keyed by leadId.
   */
  async calculateBatchMetrics(
    leads: { id: string; createdAt: Date }[],
  ): Promise<Map<string, LeadMetrics>> {
    if (leads.length === 0) return new Map();

    const leadIds = leads.map((l) => l.id);
    const now = new Date();

    // Three queries total regardless of how many leads there are.
    // Stage history is filtered to only Quoted/Won — the two entries needed
    // for daysToQuotation / daysFromQuotationToClose. Full stageTimeline
    // is only built in calculateMetrics (findOne).
    const [activityGroups, fileGroups, allStageHistories] =
      await Promise.all([
        this.prisma.activity.groupBy({
          by: ['leadId'],
          where: { leadId: { in: leadIds } },
          _count: { id: true },
          _max: { createdAt: true },
        }),
        this.prisma.file.groupBy({
          by: ['leadId'],
          where: { leadId: { in: leadIds } },
          _count: { id: true },
        }),
        this.prisma.stageHistory.findMany({
          where: {
            leadId: { in: leadIds },
            toStage: { in: ['Quoted', 'Won'] },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    // Index the results by leadId for O(1) lookups
    const activityMap = new Map(
      activityGroups.map((g) => [g.leadId, g]),
    );
    const fileMap = new Map(fileGroups.map((g) => [g.leadId, g]));

    // Group stage history by leadId
    const stageHistoryMap = new Map<
      string,
      typeof allStageHistories
    >();
    for (const entry of allStageHistories) {
      if (!stageHistoryMap.has(entry.leadId)) {
        stageHistoryMap.set(entry.leadId, []);
      }
      stageHistoryMap.get(entry.leadId)!.push(entry);
    }

    const result = new Map<string, LeadMetrics>();

    for (const lead of leads) {
      const daysInPipeline = Math.floor(
        (now.getTime() - lead.createdAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const activityGroup = activityMap.get(lead.id);
      const activityCount = activityGroup?._count.id ?? 0;
      const lastActivityAt = activityGroup?._max.createdAt ?? null;
      const daysSinceLastContact = lastActivityAt
        ? Math.floor(
            (now.getTime() - lastActivityAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : daysInPipeline;

      const fileCount = fileMap.get(lead.id)?._count.id ?? 0;
      const stageHistory = stageHistoryMap.get(lead.id) ?? [];

      const quotedStage = stageHistory.find(
        (h) => h.toStage === 'Quoted',
      );
      const wonStage = stageHistory.find((h) => h.toStage === 'Won');

      const daysToQuotation = quotedStage
        ? Math.floor(
            (quotedStage.createdAt.getTime() -
              lead.createdAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : undefined;

      const daysFromQuotationToClose =
        quotedStage && wonStage
          ? Math.floor(
              (wonStage.createdAt.getTime() -
                quotedStage.createdAt.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : undefined;

      result.set(lead.id, {
        daysInPipeline,
        daysSinceLastContact,
        activityCount,
        fileCount,
        daysToQuotation,
        daysFromQuotationToClose,
        stageTimeline: [], // Full timeline only available in findOne
      });
    }

    return result;
  }

  /**
   * Calculate key metrics for a lead
   */
  async calculateMetrics(
    leadId: string,
    leadCreatedAt: Date,
  ): Promise<LeadMetrics> {
    const now = new Date();

    // Days in pipeline (from creation date)
    const daysInPipeline = Math.floor(
      (now.getTime() - leadCreatedAt.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Get most recent activity
    const latestActivity = await this.prisma.activity.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });

    // Days since last contact
    const daysSinceLastContact = latestActivity
      ? Math.floor(
          (now.getTime() - latestActivity.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : daysInPipeline; // If no activity, use days in pipeline

    // Get activity and file counts
    const [activityCount, fileCount] = await Promise.all([
      this.prisma.activity.count({ where: { leadId } }),
      this.prisma.file.count({ where: { leadId } }),
    ]);

    // Get stage history for advanced metrics
    const stageHistory = await this.prisma.stageHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate time to quotation (from creation to "Quoted" stage)
    let daysToQuotation: number | undefined;
    const quotedStage = stageHistory.find(
      (h) => h.toStage === 'Quoted',
    );
    if (quotedStage) {
      daysToQuotation = Math.floor(
        (quotedStage.createdAt.getTime() - leadCreatedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }

    // Calculate time from quotation to close (from "Quoted" to "Won")
    let daysFromQuotationToClose: number | undefined;
    const wonStage = stageHistory.find((h) => h.toStage === 'Won');
    if (quotedStage && wonStage) {
      daysFromQuotationToClose = Math.floor(
        (wonStage.createdAt.getTime() -
          quotedStage.createdAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }

    // Build stage timeline from history
    const stageTimeline: StageTimelineEntry[] = stageHistory.map(
      (entry, index) => {
        const nextEntry = stageHistory[index + 1];
        const exitTime = nextEntry
          ? nextEntry.createdAt.getTime()
          : now.getTime();
        const daysSpent = Math.floor(
          (exitTime - entry.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        return {
          stage: entry.toStage,
          enteredAt: entry.createdAt,
          daysSpent,
          changedBy: undefined, // Will be populated if user is included
        };
      },
    );

    return {
      daysInPipeline,
      daysSinceLastContact,
      activityCount,
      fileCount,
      daysToQuotation,
      daysFromQuotationToClose,
      stageTimeline,
    };
  }

  /**
   * Detect risk flags based on lead data and metrics
   */
  detectRiskFlags(
    metrics: LeadMetrics,
    leadValue?: number,
    status?: string,
  ): RiskFlag[] {
    const flags: RiskFlag[] = [];

    // 🚩 No contact in 14+ days
    if (
      metrics.daysSinceLastContact >= 14 &&
      status !== 'Won' &&
      status !== 'Lost'
    ) {
      flags.push({
        type: 'NO_CONTACT',
        severity:
          metrics.daysSinceLastContact >= 30 ? 'high' : 'medium',
        message: `No contact in ${metrics.daysSinceLastContact} days`,
        icon: '🚩',
      });
    }

    // ⚠️ In pipeline 60+ days
    if (
      metrics.daysInPipeline >= 60 &&
      status !== 'Won' &&
      status !== 'Lost'
    ) {
      flags.push({
        type: 'LONG_PIPELINE',
        severity: metrics.daysInPipeline >= 90 ? 'high' : 'medium',
        message: `In pipeline for ${metrics.daysInPipeline} days`,
        icon: '⚠️',
      });
    }

    // 💰 High-value lead going stale
    if (
      leadValue &&
      leadValue >= 50000 &&
      metrics.daysSinceLastContact >= 7 &&
      status !== 'Won' &&
      status !== 'Lost'
    ) {
      flags.push({
        type: 'HIGH_VALUE_STALE',
        severity: 'high',
        message: `High-value lead ($${leadValue.toLocaleString()}) - no contact in ${metrics.daysSinceLastContact} days`,
        icon: '💰',
      });
    }

    // 📭 No activity at all
    if (metrics.activityCount === 0 && metrics.daysInPipeline >= 3) {
      flags.push({
        type: 'NO_ACTIVITY',
        severity: 'medium',
        message: 'No activities logged',
        icon: '📭',
      });
    }

    // ⭐ High probability of closing (positive indicator)
    const isHighProbability =
      status !== 'Won' &&
      status !== 'Lost' &&
      // Recent activity with files uploaded
      ((metrics.daysSinceLastContact <= 3 &&
        metrics.fileCount >= 2) ||
        // In Quoted or Negotiation stage with recent contact
        (['Quoted', 'Negotiation'].includes(status || '') &&
          metrics.daysSinceLastContact <= 7) ||
        // High activity rate (5+ activities in short pipeline)
        (metrics.activityCount >= 5 &&
          metrics.daysInPipeline <= 30) ||
        // Fast-moving lead (reached quotation quickly)
        (metrics.daysToQuotation && metrics.daysToQuotation <= 14));

    if (isHighProbability) {
      flags.push({
        type: 'HIGH_PROBABILITY',
        severity: 'positive',
        message:
          'High probability of closing - active engagement detected',
        icon: '⭐',
      });
    }

    return flags;
  }

  /**
   * Generate suggested next actions based on metrics and flags
   */
  generateSuggestedActions(
    flags: RiskFlag[],
    metrics: LeadMetrics,
    status: string,
  ): string[] {
    const actions: string[] = [];

    if (flags.some((f) => f.type === 'NO_CONTACT')) {
      actions.push('📞 Schedule a follow-up call');
      actions.push('📧 Send a check-in email');
    }

    if (flags.some((f) => f.type === 'LONG_PIPELINE')) {
      actions.push('🎯 Review and update lead status');
      actions.push('💬 Discuss timeline with prospect');
    }

    if (flags.some((f) => f.type === 'HIGH_VALUE_STALE')) {
      actions.push('🚨 Priority follow-up required');
      actions.push('👔 Schedule executive meeting');
    }

    if (flags.some((f) => f.type === 'NO_ACTIVITY')) {
      actions.push('📝 Log initial contact notes');
      actions.push('🔍 Research prospect needs');
    }

    if (flags.some((f) => f.type === 'HIGH_PROBABILITY')) {
      actions.push('🎯 Push for commitment - momentum is strong');
      actions.push('📄 Prepare final contract/agreement');
      actions.push('💼 Schedule closing meeting');
    }

    // Add general actions if no specific flags
    if (actions.length === 0 && status === 'New') {
      actions.push('👋 Make initial contact');
      actions.push('📋 Gather project requirements');
    }

    if (actions.length === 0 && status === 'Contacted') {
      actions.push('📊 Send proposal/quote');
      actions.push('🤝 Schedule demo or meeting');
    }

    return actions;
  }
}
