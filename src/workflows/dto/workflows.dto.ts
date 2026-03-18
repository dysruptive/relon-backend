import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateWorkflowRuleDto {
  @IsString()
  name: string;

  @IsString()
  trigger: string; // LEAD_STAGE_CHANGED, LEAD_CREATED, TASK_DUE, PROJECT_STATUS_CHANGED, DAYS_SINCE_CONTACT

  @IsObject()
  conditions: Record<string, unknown>; // { logic: 'AND'|'OR', rules: [{ field, operator, value }] }

  @IsArray()
  actions: Record<string, unknown>[]; // [{ type: 'SEND_EMAIL'|'CREATE_TASK'|'UPDATE_FIELD'|'ASSIGN_USER'|'SEND_NOTIFICATION', config: {...} }]

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWorkflowRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  actions?: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
