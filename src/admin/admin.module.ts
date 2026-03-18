import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAiSettingsService } from './admin-ai-settings.service';
import { AdminController } from './admin.controller';
import { EmailModule } from '../email/email.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [EmailModule, AuditModule, BillingModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAiSettingsService],
})
export class AdminModule {}
