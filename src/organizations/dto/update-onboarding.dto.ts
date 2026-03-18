import { IsString, IsIn } from 'class-validator';

export class UpdateOnboardingDto {
  @IsString()
  @IsIn(['addedLead', 'invitedTeam', 'setPipeline', 'completed'])
  step: 'addedLead' | 'invitedTeam' | 'setPipeline' | 'completed';
}
