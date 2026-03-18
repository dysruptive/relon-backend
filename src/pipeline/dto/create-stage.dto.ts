import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateStageDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  pipelineType?: string; // 'prospective_project' | 'project'

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  lightColor?: string;

  @IsString()
  @IsOptional()
  border?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  probability: number;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
