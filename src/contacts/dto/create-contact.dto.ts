import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsUrl()
  @IsOptional()
  linkedInUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsBoolean()
  @IsOptional()
  isDecisionMaker?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
