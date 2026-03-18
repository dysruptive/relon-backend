import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  taskAssigned?: boolean;

  @IsOptional()
  @IsBoolean()
  taskDue?: boolean;

  @IsOptional()
  @IsBoolean()
  taskOverdue?: boolean;

  @IsOptional()
  @IsBoolean()
  leadStale?: boolean;

  @IsOptional()
  @IsBoolean()
  leadStageChanged?: boolean;

  @IsOptional()
  @IsBoolean()
  projectAtRisk?: boolean;

  @IsOptional()
  @IsBoolean()
  clientDormant?: boolean;

  @IsOptional()
  @IsBoolean()
  emailDigest?: boolean;
}
