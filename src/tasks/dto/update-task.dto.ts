import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto, TaskStatus } from './create-task.dto';
import { IsOptional, IsEnum, IsString } from 'class-validator';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  completionNote?: string;

  @IsOptional()
  @IsString()
  uncompleteReason?: string;
}
