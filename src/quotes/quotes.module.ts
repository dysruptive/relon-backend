import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { QuoteSettingsService } from './quote-settings.service';
import { PdfService } from './pdf.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteSettingsService, PdfService],
  exports: [QuotesService, QuoteSettingsService, PdfService],
})
export class QuotesModule {}
