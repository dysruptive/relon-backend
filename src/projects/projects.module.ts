import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsAiService } from './projects-ai.service';
import { ProjectsCostsService } from './projects-costs.service';
import { ProjectsController } from './projects.controller';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { EmailModule } from '../email/email.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, AuditModule, BillingModule, EmailModule, AiModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsAiService, ProjectsCostsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
