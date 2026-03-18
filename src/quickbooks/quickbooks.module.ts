import { Module } from '@nestjs/common';
import { QuickBooksController } from './quickbooks.controller';
import { QuickBooksService } from './quickbooks.service';
import { QuickBooksSyncService } from './quickbooks-sync.service';
import { QuickBooksWebhookService } from './quickbooks-webhook.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [QuickBooksController],
  providers: [QuickBooksService, QuickBooksSyncService, QuickBooksWebhookService],
  exports: [QuickBooksService],
})
export class QuickBooksModule {}
