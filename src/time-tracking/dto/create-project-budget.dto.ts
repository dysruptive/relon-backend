import { IsUUID, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProjectBudgetDto {
  @IsUUID()
  projectId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  budgetedHours?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  budgetedCost?: number;
}
