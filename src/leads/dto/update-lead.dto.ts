import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadDto } from './create-lead.dto';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  // clientId made optional for updates (required only on create)
  @IsOptional()
  @IsString()
  clientId?: string;

  /** When the deal was won or lost (ISO date string, e.g. YYYY-MM-DD). */
  @IsOptional()
  @IsISO8601({ strict: false })
  dealClosedAt?: string;
}
