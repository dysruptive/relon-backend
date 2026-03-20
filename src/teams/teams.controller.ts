import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @Permissions('teams:create')
  create(@Body() createTeamDto: CreateTeamDto, @CurrentUser() user: any) {
    return this.teamsService.create(createTeamDto, user.organizationId);
  }

  @Get()
  @Permissions('teams:view')
  findAll(@CurrentUser() user: any) {
    return this.teamsService.findAll(user.organizationId);
  }

  @Get('my-team')
  @Permissions('teams:view')
  getMyTeam(@CurrentUser() user: any) {
    return this.teamsService.findMyTeam(user.sub, user.organizationId);
  }

  @Get(':id')
  @Permissions('teams:view')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teamsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Permissions('teams:edit')
  update(
    @Param('id') id: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.update(id, updateTeamDto, user.organizationId);
  }

  @Delete(':id')
  @Permissions('teams:delete')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teamsService.remove(id, user.organizationId);
  }

  @Post(':id/members')
  @Permissions('teams:manage_members')
  addMember(@Param('id') id: string, @Body('userId') userId: string, @CurrentUser() user: any) {
    return this.teamsService.addMember(id, userId, user.organizationId);
  }

  @Delete(':id/members/:userId')
  @Permissions('teams:manage_members')
  removeMember(@Param('userId') userId: string, @CurrentUser() user: any) {
    return this.teamsService.removeMember(userId, user.organizationId);
  }
}
