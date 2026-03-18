import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientMetricsService } from './client-metrics.service';
import { ClientsController } from './clients.controller';
import { AiModule } from '../ai/ai.module';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AiModule, DatabaseModule, AuditModule, BillingModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientMetricsService],
})
export class ClientsModule {}
