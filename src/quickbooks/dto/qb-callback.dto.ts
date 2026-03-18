import { IsString, IsOptional } from 'class-validator';

export class QbCallbackDto {
  @IsString()
  code: string;

  @IsString()
  realmId: string;

  @IsString()
  @IsOptional()
  state?: string;
}
