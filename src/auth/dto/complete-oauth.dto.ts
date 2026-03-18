import { IsOptional, IsString, IsIn, MinLength, MaxLength } from 'class-validator';

const VALID_COUNTRIES = ['GH', 'NG', 'KE', 'ZA', 'US', 'GB', 'CA', 'AU', 'OTHER'];
const VALID_SECTORS = ['construction', 'architecture', 'real_estate', 'facilities', 'professional_services', 'manufacturing', 'other'];

export class CompleteOAuthDto {
  @IsOptional()
  @IsString()
  pendingToken?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  organizationName: string;

  @IsOptional()
  @IsIn(VALID_COUNTRIES)
  country?: string;

  @IsOptional()
  @IsIn(VALID_SECTORS)
  sector?: string;
}
