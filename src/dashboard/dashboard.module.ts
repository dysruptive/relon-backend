import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardTrendsService } from './dashboard-trends.service';
import { DashboardAiService } from './dashboard-ai.service';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardMetricsService,
    DashboardTrendsService,
    DashboardAiService,
    PrismaService,
    AiService,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
