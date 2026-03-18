import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpsertForecastTargetDto } from './dto/forecast.dto';

@Injectable()
export class ForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Weighted pipeline: sum of leads in active stages with probability weights
    const activeLeads = await this.prisma.lead.findMany({
      where: { organizationId, stage: { notIn: ['Won', 'Lost'] } },
      select: { expectedValue: true, stage: true },
    });

    const stageWeights: Record<string, number> = {
      'New': 0.1, 'Contacted': 0.2, 'Quoted': 0.4, 'Negotiation': 0.7,
    };
    const weightedPipeline = activeLeads.reduce((sum, lead) => {
      const weight = stageWeights[lead.stage] ?? 0.3;
      return sum + (Number(lead.expectedValue) * weight);
    }, 0);

    // Won this month
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    const wonLeads = await this.prisma.lead.findMany({
      where: { organizationId, stage: 'Won', dealClosedAt: { gte: monthStart, lte: monthEnd } },
      select: { contractedValue: true, expectedValue: true },
    });
    const wonThisMonth = wonLeads.reduce((sum, l) => sum + Number(l.contractedValue ?? l.expectedValue), 0);

    // This month target
    const target = await this.prisma.forecastTarget.findFirst({
      where: { organizationId, month: currentMonth, year: currentYear },
    });
    const thisMonthTarget = target ? Number(target.targetAmount) : 0;

    // Forecast accuracy vs last month
    let forecastAccuracy = 0;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const lastTarget = await this.prisma.forecastTarget.findFirst({
      where: { organizationId, month: lastMonth, year: lastYear },
    });
    if (lastTarget && Number(lastTarget.targetAmount) > 0) {
      const lastMonthStart = new Date(lastYear, lastMonth - 1, 1);
      const lastMonthEnd = new Date(lastYear, lastMonth, 0, 23, 59, 59);
      const lastWon = await this.prisma.lead.findMany({
        where: { organizationId, stage: 'Won', dealClosedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        select: { contractedValue: true, expectedValue: true },
      });
      const lastWonTotal = lastWon.reduce((sum, l) => sum + Number(l.contractedValue ?? l.expectedValue), 0);
      forecastAccuracy = (lastWonTotal / Number(lastTarget.targetAmount)) * 100;
    }

    return { weightedPipeline, thisMonthTarget, wonThisMonth, forecastAccuracy };
  }

  async getTargets(organizationId: string, months = 6) {
    const now = new Date();
    const results = [];

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const target = await this.prisma.forecastTarget.findFirst({
        where: { organizationId, month, year },
      });

      // Won leads for this month
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      const wonLeads = await this.prisma.lead.findMany({
        where: { organizationId, stage: 'Won', dealClosedAt: { gte: monthStart, lte: monthEnd } },
        select: { contractedValue: true, expectedValue: true },
      });
      const won = wonLeads.reduce((sum, l) => sum + Number(l.contractedValue ?? l.expectedValue), 0);

      // Active leads weighted for this month (approximate)
      const activeLeads = await this.prisma.lead.findMany({
        where: { organizationId, stage: { notIn: ['Won', 'Lost'] }, createdAt: { lte: monthEnd } },
        select: { expectedValue: true, stage: true },
      });
      const stageWeights: Record<string, number> = { 'New': 0.1, 'Contacted': 0.2, 'Quoted': 0.4, 'Negotiation': 0.7 };
      const weighted = activeLeads.reduce((sum, l) => sum + (Number(l.expectedValue) * (stageWeights[l.stage] ?? 0.3)), 0);

      results.push({ month, year, label, target: target ? Number(target.targetAmount) : 0, won, weighted });
    }

    return results;
  }

  async upsertTarget(dto: UpsertForecastTargetDto, organizationId: string) {
    return this.prisma.forecastTarget.upsert({
      where: { organizationId_month_year: { organizationId, month: dto.month, year: dto.year } },
      create: { organizationId, month: dto.month, year: dto.year, targetAmount: dto.targetAmount, currency: dto.currency ?? 'USD' },
      update: { targetAmount: dto.targetAmount, currency: dto.currency ?? 'USD' },
    });
  }
}
