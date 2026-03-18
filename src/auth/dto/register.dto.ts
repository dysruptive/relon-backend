import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, Matches, IsTimeZone } from 'class-validator';

const VALID_COUNTRIES = ['GH', 'NG', 'KE', 'ZA', 'US', 'GB', 'CA', 'AU', 'OTHER'];
const VALID_SECTORS = ['construction', 'architecture', 'real_estate', 'facilities', 'professional_services', 'manufacturing', 'other'];

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  organizationName: string;

  @IsOptional()
  @IsString()
  @IsIn(VALID_COUNTRIES)
  country?: string;

  @IsOptional()
  @IsString()
  @IsIn(VALID_SECTORS)
  sector?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
