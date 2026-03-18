import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { LeadsReportingService } from './services/leads-reporting.service';
import { ProjectsReportingService } from './services/projects-reporting.service';
import { ClientsReportingService } from './services/clients-reporting.service';
import { RepsReportingService } from './services/reps-reporting.service';
import { PrismaService } from '../database/prisma.service';
import { ReportsPlanGuard } from './guards/reports-plan.guard';

@Module({
  controllers: [ReportsController],
  providers: [
    ReportsService,
    LeadsReportingService,
    ProjectsReportingService,
    ClientsReportingService,
    RepsReportingService,
    PrismaService,
    ReportsPlanGuard,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
