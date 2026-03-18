import { IsUUID, IsString, IsOptional } from 'class-validator';

export class CreateProjectAssignmentDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsOptional()
  role?: string;
}
