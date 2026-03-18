import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string; // e.g. 'SALES', 'SUPPORT'

  @IsString()
  @IsOptional()
  managerId?: string;
}
