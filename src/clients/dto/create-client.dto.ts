import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClientDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  individualName?: string;

  @IsOptional()
  @IsString()
  individualType?: string;

  @IsString()
  segment: string;

  @IsString()
  industry: string;

  @IsOptional()
  @IsString()
  accountManagerId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  lifetimeRevenue?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  healthScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
