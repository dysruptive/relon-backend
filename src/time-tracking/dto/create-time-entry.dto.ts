import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class CreateTimeEntryDto {
  // userId is NOT accepted from request body — it comes from JWT via @CurrentUser()

  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  billable?: boolean;

  @IsNumber()
  @IsOptional()
  hourlyRate?: number;

  @IsString()
  @IsOptional()
  source?: string;

  @IsUUID()
  @IsOptional()
  serviceItemId?: string;

  @IsUUID()
  @IsOptional()
  serviceItemSubtaskId?: string;
}
