import { IsString, IsOptional, IsNumber, IsDateString, IsUUID, Min } from 'class-validator';

export class CreateUserRateDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsDateString()
  effectiveFrom: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsString()
  @IsOptional()
  type?: string;
}
