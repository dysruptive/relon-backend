import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDate,
  IsEmail,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsString()
  @IsNotEmpty()
  company: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  expectedValue: number;

  @IsString()
  @IsNotEmpty()
  stage: string;

  @IsString()
  @IsOptional()
  serviceTypeId?: string;

  @IsString()
  @IsNotEmpty()
  urgency: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  likelyStartDate?: Date;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  assignedToId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  projectName?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  contractedValue?: number;

  @IsString()
  @IsOptional()
  executingCompany?: string;
}
