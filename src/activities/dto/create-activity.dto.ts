import { IsString, IsNotEmpty, IsOptional, IsIn, Matches } from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  activityDate: string; // ISO date string

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'activityTime must be in HH:MM format',
  })
  @IsNotEmpty()
  activityTime: string; // HH:MM format

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsIn(['in-person', 'virtual'])
  @IsOptional()
  meetingType?: 'in-person' | 'virtual'; // Required for meetings
}
