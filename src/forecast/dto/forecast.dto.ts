import { IsInt, IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';

export class UpsertForecastTargetDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  year: number;

  @IsNumber()
  @Min(0)
  targetAmount: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
