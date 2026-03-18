import { Controller, Get, Put, Query, Body } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardTrendsService } from './dashboard-trends.service';
import { DashboardAiService } from './dashboard-ai.service';
import { AiService } from '../ai/ai.service';
import { Permissions } from '../permissions/permissions.decorator';
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
  @Permissions('dashboard:view')
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
  @Permissions('dashboard:view')
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
  @Permissions('dashboard:view')
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
  @Permissions('dashboard:view')
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
  @Permissions('dashboard:view')
  async getRevenueTrend(@CurrentUser() user: any) {
    return this.dashboardTrendsService.getRevenueTrend(user.organizationId);
  }

  @Get('lead-volume-trend')
  @Permissions('dashboard:view')
  async getLeadVolumeTrend(@CurrentUser() user: any) {
    return this.dashboardTrendsService.getLeadVolumeTrend(user.organizationId);
  }

  @Get('pipeline-insights')
  @Permissions('dashboard:view')
  async getPipelineInsights(@CurrentUser() user: any) {
    return this.dashboardAiService.getPipelineInsights(user.organizationId);
  }

  @Get('calendar-events')
  @Permissions('dashboard:view')
  async getCalendarEvents(
    @CurrentUser() user: any,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.dashboardService.getCalendarEvents(user.organizationId, start, end);
  }

  @Get('layout')
  @Permissions('dashboard:view')
  async getLayout(@CurrentUser() user: any) {
    return this.dashboardService.getDashboardLayout(user.sub, user.organizationId);
  }

  @Put('layout')
  @Permissions('dashboard:view')
  async saveLayout(@CurrentUser() user: any, @Body() body: { widgets: unknown[] }) {
    return this.dashboardService.saveDashboardLayout(user.sub, user.organizationId, body.widgets);
  }
}
