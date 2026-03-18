import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  roleLabel: string;
}

export class UpdateTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  roleLabel: string;
}
