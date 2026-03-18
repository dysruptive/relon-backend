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

export class UpdateTimeEntryDto {
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsNumber()
  @Min(0.25)
  @Max(24)
  @IsOptional()
  hours?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  billable?: boolean;

  @IsNumber()
  @IsOptional()
  hourlyRate?: number;

  @IsUUID()
  @IsOptional()
  serviceItemId?: string;

  @IsUUID()
  @IsOptional()
  serviceItemSubtaskId?: string;
}
