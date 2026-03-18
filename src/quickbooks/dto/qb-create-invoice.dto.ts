import { IsUUID } from 'class-validator';

export class QbCreateInvoiceDto {
  @IsUUID()
  quoteId: string;
}
