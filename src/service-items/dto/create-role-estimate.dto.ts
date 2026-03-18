import { IsNumber, Min } from 'class-validator';

export class CreateRoleEstimateDto {
  @IsNumber()
  @Min(0)
  estimatedHours: number;
}
