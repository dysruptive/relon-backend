import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateSubtaskDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
