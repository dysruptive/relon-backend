import { IsString, IsBoolean, IsOptional, IsInt, IsArray, Matches, IsIn } from 'class-validator';

export class CreateCustomFieldDefinitionDto {
  @IsString()
  entityType: string;

  @IsString()
  label: string;

  @Matches(/^[a-z_][a-z0-9_]*$/, { message: 'fieldKey must match [a-z_][a-z0-9_]*' })
  fieldKey: string;

  @IsIn(['text', 'select', 'checkbox', 'date', 'number'])
  fieldType: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCustomFieldDefinitionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsIn(['text', 'select', 'checkbox', 'date', 'number'])
  fieldType?: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class BulkSaveCustomFieldValuesDto {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  values: Record<string, unknown>;
}
