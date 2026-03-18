import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadMetricsService } from './lead-metrics.service';
import { LeadsAiService } from './leads-ai.service';
import { LeadsStageService } from './leads-stage.service';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AiModule, AuditModule, BillingModule, EmailModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadMetricsService, LeadsAiService, LeadsStageService],
})
export class LeadsModule {}
