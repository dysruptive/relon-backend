import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional()
  @IsBoolean()
  statusOverride?: boolean;

  @IsOptional()
  @IsString()
  statusOverrideReason?: string;

  // Passed as a raw ID; clients.service.ts converts it to a relation connect/disconnect
  @IsOptional()
  @IsString()
  accountManager?: string;
}
