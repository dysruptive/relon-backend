import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ClientMetrics {
  daysSinceLastContact: number;
  totalActivityCount: number;
  recentActivityCount: number; // Last 30 days
  totalProjectCount: number;
  activeProjectCount: number;
  completedProjectCount: number;
  totalRevenue: number;
  recentRevenue: number; // Last 12 months
  avgProjectValue: number;
  engagementScore: number; // 0-100
}

export interface ClientHealthFlag {
  type:
    | 'NO_CONTACT'
    | 'DECLINING_ENGAGEMENT'
    | 'HIGH_VALUE_AT_RISK'
    | 'STRONG_RELATIONSHIP';
  severity: 'low' | 'medium' | 'high' | 'positive';
  message: string;
  icon: string;
}

@Injectable()
export class ClientMetricsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate metrics for many clients in 2 batch queries instead of 4×N queries.
   * Pass in pre-loaded projects (already fetched via include in findAll).
   * Returns a Map keyed by clientId.
   */
  async calculateBatchMetrics(
    clients: { id: string; createdAt: Date; projects?: any[] }[],
  ): Promise<Map<string, ClientMetrics>> {
    if (clients.length === 0) return new Map();

    const clientIds = clients.map((c) => c.id);
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const twelveMonthsAgo = new Date(
      now.getTime() - 365 * 24 * 60 * 60 * 1000,
    );

    // Two queries regardless of client count
    const [allTimeGroups, recentGroups] = await Promise.all([
      this.prisma.activity.groupBy({
        by: ['clientId'],
        where: { clientId: { in: clientIds } },
        _count: { id: true },
        _max: { createdAt: true },
      }),
      this.prisma.activity.groupBy({
        by: ['clientId'],
        where: {
          clientId: { in: clientIds },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { id: true },
      }),
    ]);

    const allTimeMap = new Map(
      allTimeGroups.map((g) => [g.clientId, g]),
    );
    const recentMap = new Map(
      recentGroups.map((g) => [g.clientId, g]),
    );

    const result = new Map<string, ClientMetrics>();

    for (const client of clients) {
      const allTime = allTimeMap.get(client.id);
      const recent = recentMap.get(client.id);

      const totalActivityCount = allTime?._count.id ?? 0;
      const recentActivityCount = recent?._count.id ?? 0;
      const lastActivityAt = allTime?._max.createdAt ?? null;

      const daysSinceLastContact = lastActivityAt
        ? Math.floor(
            (now.getTime() - lastActivityAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : Math.floor(
            (now.getTime() - client.createdAt.getTime()) /
              (1000 * 60 * 60 * 24),
          );

      // Use pre-loaded projects (no extra DB call)
      const projects = client.projects ?? [];
      const totalProjectCount = projects.length;
      const activeProjectCount = projects.filter(
        (p: any) => p.status === 'Active' || p.status === 'Planning',
      ).length;
      const completedProjectCount = projects.filter(
        (p: any) => p.status === 'Completed',
      ).length;

      const totalRevenue = projects.reduce(
        (sum: number, p: any) => sum + (p.contractedValue ?? 0),
        0,
      );
      const recentRevenue = projects
        .filter(
          (p: any) =>
            new Date(p.createdAt) >= twelveMonthsAgo ||
            (p.completedDate &&
              new Date(p.completedDate) >= twelveMonthsAgo),
        )
        .reduce(
          (sum: number, p: any) => sum + (p.contractedValue ?? 0),
          0,
        );

      const avgProjectValue =
        totalProjectCount > 0 ? totalRevenue / totalProjectCount : 0;

      const engagementScore = this.calculateEngagementScore({
        daysSinceLastContact,
        recentActivityCount,
        activeProjectCount,
        totalProjectCount,
        completedProjectCount,
      });

      result.set(client.id, {
        daysSinceLastContact,
        totalActivityCount,
        recentActivityCount,
        totalProjectCount,
        activeProjectCount,
        completedProjectCount,
        totalRevenue,
        recentRevenue,
        avgProjectValue,
        engagementScore,
      });
    }

    return result;
  }

  /**
   * Calculate comprehensive metrics for a client
   */
  async calculateMetrics(
    clientId: string,
    clientCreatedAt: Date,
  ): Promise<ClientMetrics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const twelveMonthsAgo = new Date(
      now.getTime() - 365 * 24 * 60 * 60 * 1000,
    );

    // Get most recent activity
    const latestActivity = await this.prisma.activity.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });

    // Days since last contact
    const daysSinceLastContact = latestActivity
      ? Math.floor(
          (now.getTime() - latestActivity.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : Math.floor(
          (now.getTime() - clientCreatedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );

    // Activity counts
    const [totalActivityCount, recentActivityCount] =
      await Promise.all([
        this.prisma.activity.count({ where: { clientId } }),
        this.prisma.activity.count({
          where: {
            clientId,
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
      ]);

    // Project data
    const projects = await this.prisma.project.findMany({
      where: { clientId },
    });

    const totalProjectCount = projects.length;
    const activeProjectCount = projects.filter(
      (p) => p.status === 'Active' || p.status === 'Planning',
    ).length;
    const completedProjectCount = projects.filter(
      (p) => p.status === 'Completed',
    ).length;

    // Revenue calculations
    const totalRevenue = projects.reduce(
      (sum, p) => sum + Number(p.contractedValue),
      0,
    );
    const recentRevenue = projects
      .filter(
        (p) =>
          p.createdAt >= twelveMonthsAgo ||
          (p.completedDate && p.completedDate >= twelveMonthsAgo),
      )
      .reduce((sum, p) => sum + Number(p.contractedValue), 0);

    const avgProjectValue =
      totalProjectCount > 0 ? totalRevenue / totalProjectCount : 0;

    // Calculate engagement score (0-100)
    const engagementScore = this.calculateEngagementScore({
      daysSinceLastContact,
      recentActivityCount,
      activeProjectCount,
      totalProjectCount,
      completedProjectCount,
    });

    return {
      daysSinceLastContact,
      totalActivityCount,
      recentActivityCount,
      totalProjectCount,
      activeProjectCount,
      completedProjectCount,
      totalRevenue,
      recentRevenue,
      avgProjectValue,
      engagementScore,
    };
  }

  /**
   * Calculate engagement score (0-100) based on multiple factors
   */
  private calculateEngagementScore(data: {
    daysSinceLastContact: number;
    recentActivityCount: number;
    activeProjectCount: number;
    totalProjectCount: number;
    completedProjectCount: number;
  }): number {
    let score = 0;

    // Factor 1: Recent contact (max 25 points)
    if (data.daysSinceLastContact <= 7) {
      score += 25;
    } else if (data.daysSinceLastContact <= 14) {
      score += 20;
    } else if (data.daysSinceLastContact <= 30) {
      score += 15;
    } else if (data.daysSinceLastContact <= 60) {
      score += 10;
    } else if (data.daysSinceLastContact <= 90) {
      score += 5;
    }
    // else: 0 points for 90+ days

    // Factor 2: Activity level (max 25 points)
    if (data.recentActivityCount >= 10) {
      score += 25;
    } else if (data.recentActivityCount >= 7) {
      score += 20;
    } else if (data.recentActivityCount >= 5) {
      score += 15;
    } else if (data.recentActivityCount >= 3) {
      score += 10;
    } else if (data.recentActivityCount >= 1) {
      score += 5;
    }
    // else: 0 points for no recent activity

    // Factor 3: Active projects (max 20 points)
    if (data.activeProjectCount >= 3) {
      score += 20;
    } else if (data.activeProjectCount === 2) {
      score += 15;
    } else if (data.activeProjectCount === 1) {
      score += 10;
    }
    // else: 0 points for no active projects

    // Factor 4: Repeat business indicator (max 10 points)
    if (data.completedProjectCount >= 5) {
      score += 10;
    } else if (data.completedProjectCount >= 3) {
      score += 8;
    } else if (data.completedProjectCount >= 2) {
      score += 5;
    } else if (data.completedProjectCount >= 1) {
      score += 3;
    }
    // else: 0 points for no completed projects

    // Factor 5: Project history bonus (max 20 points)
    // Rewards consistent, long-term relationships
    if (data.totalProjectCount >= 10) {
      score += 20;
    } else if (data.totalProjectCount >= 7) {
      score += 15;
    } else if (data.totalProjectCount >= 5) {
      score += 10;
    } else if (data.totalProjectCount >= 3) {
      score += 5;
    }
    // else: 0 points for 0-2 projects

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Detect health flags based on client data and metrics
   */
  detectHealthFlags(
    metrics: ClientMetrics,
    lifetimeRevenue?: number,
  ): ClientHealthFlag[] {
    const flags: ClientHealthFlag[] = [];

    // 🚩 No contact in 60+ days
    if (metrics.daysSinceLastContact >= 60) {
      flags.push({
        type: 'NO_CONTACT',
        severity:
          metrics.daysSinceLastContact >= 120 ? 'high' : 'medium',
        message: `No contact in ${metrics.daysSinceLastContact} days`,
        icon: '🚩',
      });
    }

    // 📉 Declining engagement (low recent activity compared to total)
    const avgActivityPerMonth =
      metrics.totalActivityCount /
      Math.max(1, metrics.daysSinceLastContact / 30);
    const recentActivityPerMonth = metrics.recentActivityCount;

    if (
      metrics.totalActivityCount >= 10 &&
      recentActivityPerMonth < avgActivityPerMonth * 0.5 &&
      metrics.daysSinceLastContact >= 30
    ) {
      flags.push({
        type: 'DECLINING_ENGAGEMENT',
        severity: 'medium',
        message:
          'Engagement declining - recent activity below historical average',
        icon: '📉',
      });
    }

    // 💰 High-value client at risk
    if (
      lifetimeRevenue &&
      lifetimeRevenue >= 100000 &&
      (metrics.engagementScore < 40 ||
        metrics.activeProjectCount === 0)
    ) {
      flags.push({
        type: 'HIGH_VALUE_AT_RISK',
        severity: 'high',
        message: `High-value client ($${lifetimeRevenue.toLocaleString()}) with low engagement`,
        icon: '💰',
      });
    }

    // ⭐ Strong relationship (positive indicator)
    if (metrics.engagementScore >= 75) {
      flags.push({
        type: 'STRONG_RELATIONSHIP',
        severity: 'positive',
        message:
          'Strong relationship - high engagement and active projects',
        icon: '⭐',
      });
    }

    return flags;
  }

  /**
   * Generate suggested actions based on metrics and flags
   */
  generateSuggestedActions(
    flags: ClientHealthFlag[],
    metrics: ClientMetrics,
  ): string[] {
    const actions: string[] = [];

    if (flags.some((f) => f.type === 'NO_CONTACT')) {
      actions.push('📞 Schedule a check-in call immediately');
      actions.push('📧 Send a relationship-building email');
      actions.push('🎯 Review account status with team');
    }

    if (flags.some((f) => f.type === 'DECLINING_ENGAGEMENT')) {
      actions.push('📊 Analyze recent interaction patterns');
      actions.push('🤝 Schedule quarterly business review');
      actions.push('💡 Propose new project or service');
    }

    if (flags.some((f) => f.type === 'HIGH_VALUE_AT_RISK')) {
      actions.push('🚨 Escalate to senior management');
      actions.push('👔 Schedule executive-level meeting');
      actions.push('🎁 Consider value-add initiative or discount');
    }

    if (flags.some((f) => f.type === 'STRONG_RELATIONSHIP')) {
      actions.push('🎯 Explore upsell opportunities');
      actions.push('🌟 Request referrals or testimonial');
      actions.push('📈 Discuss expansion possibilities');
    }

    // General actions based on project status
    if (actions.length === 0 && metrics.activeProjectCount === 0) {
      actions.push('💼 Identify new project opportunities');
      actions.push('📅 Schedule catch-up meeting');
    }

    if (actions.length === 0 && metrics.recentActivityCount === 0) {
      actions.push('📝 Log recent interactions');
      actions.push('🔄 Re-engage with client');
    }

    return actions;
  }

  /**
   * Determine health status based on engagement score and active projects
   */
  determineHealthStatus(
    engagementScore: number,
    activeProjectCount: number,
  ): string {
    // Active: High engagement OR has active projects
    if (engagementScore >= 60 || activeProjectCount > 0) {
      return 'Active';
    }

    // At Risk: Low engagement with no active projects
    if (engagementScore < 40) {
      return 'At Risk';
    }

    // Dormant: Medium engagement, no active projects
    return 'Dormant';
  }
}
