import { Controller, Get, Put, Query, Body } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardTrendsService } from './dashboard-trends.service';
import { DashboardAiService } from './dashboard-ai.service';
import { AiService } from '../ai/ai.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private dashboardMetricsService: DashboardMetricsService,
    private dashboardTrendsService: DashboardTrendsService,
    private dashboardAiService: DashboardAiService,
    private aiService: AiService,
  ) {}

  @Get('metrics')
  async getMetrics(
    @CurrentUser() user: any,
    @Query('period') period: 'week' | 'month' | 'quarter' = 'month',
    @Query('executingCompany') executingCompany?: string,
  ) {
    return this.dashboardMetricsService.getMetrics(
      user.organizationId,
      period,
      executingCompany || undefined,
    );
  }

  @Get('executive-summary')
  async getExecutiveSummary(
    @CurrentUser() user: any,
    @Query('provider') provider: string = 'openai',
    @Query('period') period: 'week' | 'month' | 'quarter' = 'month',
    @Query('executingCompany') executingCompany?: string,
  ) {
    const metrics = await this.dashboardMetricsService.getMetrics(
      user.organizationId,
      period,
      executingCompany || undefined,
    );
    const summary = await this.aiService.generateExecutiveSummary(metrics, provider);

    return {
      period,
      generatedAt: new Date().toISOString(),
      summary,
      metrics: {
        totalRevenue: metrics.totalRevenue,
        pipelineValue: metrics.pipelineValue,
        winRate: metrics.winRate,
        activeClients: metrics.activeClients,
        activeProjects: metrics.activeProjects,
      },
    };
  }

  @Get('revenue-breakdown')
  async getRevenueBreakdown(
    @CurrentUser() user: any,
    @Query('period') period: 'week' | 'month' | 'quarter' = 'month',
    @Query('executingCompany') executingCompany?: string,
  ) {
    const metrics = await this.dashboardMetricsService.getMetrics(
      user.organizationId,
      period,
      executingCompany || undefined,
    );

    return {
      totalRevenue: metrics.totalRevenue,
      monthlyRevenue: metrics.monthlyRevenue,
      quarterlyRevenue: metrics.quarterlyRevenue,
      byClient: metrics.revenueByClient.slice(0, 10),
      byProject: metrics.revenueByProject.slice(0, 10),
      concentration: metrics.revenueConcentration,
    };
  }

  @Get('project-analytics')
  async getProjectAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'week' | 'month' | 'quarter' = 'month',
    @Query('executingCompany') executingCompany?: string,
  ) {
    const metrics = await this.dashboardMetricsService.getMetrics(
      user.organizationId,
      period,
      executingCompany || undefined,
    );

    return {
      totalProjects: metrics.totalProjects,
      activeProjects: metrics.activeProjects,
      byStatus: metrics.projectsByStatus,
      atRisk: metrics.projectsAtRisk,
    };
  }

  @Get('revenue-trend')
  async getRevenueTrend(@CurrentUser() user: any) {
    return this.dashboardTrendsService.getRevenueTrend(user.organizationId);
  }

  @Get('lead-volume-trend')
  async getLeadVolumeTrend(@CurrentUser() user: any) {
    return this.dashboardTrendsService.getLeadVolumeTrend(user.organizationId);
  }

  @Get('pipeline-insights')
  async getPipelineInsights(@CurrentUser() user: any) {
    return this.dashboardAiService.getPipelineInsights(user.organizationId);
  }

  @Get('calendar-events')
  async getCalendarEvents(
    @CurrentUser() user: any,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.dashboardService.getCalendarEvents(user.organizationId, start, end);
  }

  @Get('layout')
  async getLayout(@CurrentUser() user: any) {
    return this.dashboardService.getDashboardLayout(user.sub, user.organizationId);
  }

  @Put('layout')
  async saveLayout(@CurrentUser() user: any, @Body() body: { widgets: unknown[] }) {
    return this.dashboardService.saveDashboardLayout(user.sub, user.organizationId, body.widgets);
  }
}
