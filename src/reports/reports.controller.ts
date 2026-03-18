import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LeadsReportingService } from './services/leads-reporting.service';
import { ProjectsReportingService } from './services/projects-reporting.service';
import { ClientsReportingService } from './services/clients-reporting.service';
import { RepsReportingService } from './services/reps-reporting.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ReportsPlanGuard } from './guards/reports-plan.guard';

@Controller('reports')
@UseGuards(ReportsPlanGuard)
export class ReportsController {
  constructor(
    private leadsReportingService: LeadsReportingService,
    private projectsReportingService: ProjectsReportingService,
    private clientsReportingService: ClientsReportingService,
    private repsReportingService: RepsReportingService,
  ) {}

  // Leads Reports
  @Get('leads/overview')
  @Permissions('reports:view')
  async getLeadsOverview(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsReportingService.getOverview(filters, user);
  }

  @Get('leads/stage-analysis')
  @Permissions('reports:view')
  async getLeadsStageAnalysis(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsReportingService.getStageAnalysis(filters, user);
  }

  @Get('leads/conversion-funnel')
  @Permissions('reports:view')
  async getLeadsConversionFunnel(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsReportingService.getConversionFunnel(filters, user);
  }

  @Get('leads/revenue-by-rep')
  @Permissions('reports:view')
  async getLeadsRevenueByRep(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsReportingService.getRevenueByRep(filters, user);
  }

  @Get('leads/overdue')
  @Permissions('reports:view')
  async getLeadsOverdue(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsReportingService.getOverdueLeads(filters, user);
  }

  // Projects Reports
  @Get('projects/overview')
  @Permissions('reports:view')
  async getProjectsOverview(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsReportingService.getOverview(filters, user);
  }

  @Get('projects/profitability')
  @Permissions('reports:view')
  async getProjectsProfitability(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsReportingService.getProfitabilityData(filters, user);
  }

  @Get('projects/risk-distribution')
  @Permissions('reports:view')
  async getProjectsRiskDistribution(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsReportingService.getRiskDistribution(filters, user);
  }

  @Get('projects/cost-breakdown')
  @Permissions('reports:view')
  async getProjectsCostBreakdown(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsReportingService.getCostBreakdown(filters, user);
  }

  // Clients Reports
  @Get('clients/overview')
  @Permissions('reports:view')
  async getClientsOverview(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.clientsReportingService.getOverview(filters, user);
  }

  @Get('clients/revenue-analysis')
  @Permissions('reports:view')
  async getClientsRevenueAnalysis(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.clientsReportingService.getRevenueAnalysis(filters, user);
  }

  @Get('clients/health-trends')
  @Permissions('reports:view')
  async getClientsHealthTrends(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.clientsReportingService.getHealthTrends(filters, user);
  }

  @Get('clients/retention-metrics')
  @Permissions('reports:view')
  async getClientsRetentionMetrics(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.clientsReportingService.getRetentionMetrics(filters, user);
  }

  @Get('clients/engagement-trends')
  @Permissions('reports:view')
  async getClientsEngagementTrends(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.clientsReportingService.getEngagementTrends(filters, user);
  }

  @Get('clients/health-score-trends')
  @Permissions('reports:view')
  async getClientsHealthScoreTrends(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.clientsReportingService.getHealthScoreTrends(filters, user);
  }

  // Sales Reps Reports
  @Get('reps/overview')
  @Permissions('reports:view')
  async getRepsOverview(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.repsReportingService.getOverview(filters, user);
  }

  @Get('reps/performance')
  @Permissions('reports:view')
  async getRepsPerformance(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.repsReportingService.getPerformanceData(filters, user);
  }

  @Get('reps/stage-time')
  @Permissions('reports:view')
  async getRepsStageTime(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: any,
  ) {
    return this.repsReportingService.getStageTimeByRep(filters, user);
  }
}
