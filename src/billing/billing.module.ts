import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PaystackBillingService } from './paystack-billing.service';
import { BillingCronService } from './billing-cron.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, EmailModule],
  providers: [BillingService, PaystackBillingService, BillingCronService],
  controllers: [BillingController],
  exports: [BillingService, PaystackBillingService],
})
export class BillingModule {}
