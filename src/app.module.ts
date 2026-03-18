import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CacheModule } from './cache/cache.module';
import { APP_GUARD } from '@nestjs/core';
import { LeadsModule } from './leads/leads.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { AiModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { AuditModule } from './audit/audit.module';
import { ActivitiesModule } from './activities/activities.module';
import { StorageModule } from './storage/storage.module';
import { FilesModule } from './files/files.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { PlanStatusGuard } from './billing/guards/plan-status.guard';
import { PermissionsModule } from './permissions/permissions.module';
import { TeamsModule } from './teams/teams.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { BillingModule } from './billing/billing.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContactsModule } from './contacts/contacts.module';
import { ServiceItemsModule } from './service-items/service-items.module';
import { QuotesModule } from './quotes/quotes.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { ForecastModule } from './forecast/forecast.module';
import { BottleneckModule } from './bottleneck/bottleneck.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { FormsModule } from './forms/forms.module';
import { RolesModule } from './roles/roles.module';
import { ProductsModule } from './products/products.module';
import { QuickBooksModule } from './quickbooks/quickbooks.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        customProps: () => ({ context: 'HTTP' }),
        quietReqLogger: true,
      },
    }),
    CacheModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DatabaseModule,
    StorageModule,
    HealthModule,
    AuthModule,
    EmailModule,
    AuditModule,
    ActivitiesModule,
    FilesModule,
    DashboardModule,
    LeadsModule,
    ClientsModule,
    ProjectsModule,
    AiModule,
    AdminModule,
    TeamsModule,
    PermissionsModule,
    PipelineModule,
    ReportsModule,
    SettingsModule,
    OrganizationsModule,
    BillingModule,
    NotificationsModule,
    TasksModule,
    ContactsModule,
    ServiceItemsModule,
    QuotesModule,
    TimeTrackingModule,
    CustomFieldsModule,
    ForecastModule,
    BottleneckModule,
    WorkflowsModule,
    FormsModule,
    RolesModule,
    ProductsModule,
    QuickBooksModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlanStatusGuard,
    },
  ],
})
export class AppModule {}
