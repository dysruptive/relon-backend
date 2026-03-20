import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateLeadRepDto } from './dto/create-lead-rep.dto';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './dto/create-team-member.dto';
import { LeadsService } from './leads.service';
import { LeadsAiService } from './leads-ai.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';
import { IsArray, IsString, IsOptional, IsObject } from 'class-validator';

class BulkUpdateLeadsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsObject()
  data: { stage?: string; assignedToId?: string; urgency?: string };
}

class BulkDeleteLeadsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadsAiService: LeadsAiService,
  ) {}

  @Get()
  @Permissions('leads:view')
  findAll(
    @CurrentUser() user: any,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.findAll(
      user.id,
      user.role,
      user.organizationId,
      year,
      page ? parseInt(page, 10) : undefined,
      limit ? Math.min(parseInt(limit, 10), 200) : undefined,
    );
  }

  // --- Bulk operations (must come before :id routes) ---

  @Patch('bulk')
  @Permissions('leads:edit')
  bulkUpdate(@Body() dto: BulkUpdateLeadsDto, @CurrentUser() user: any) {
    return this.leadsService.bulkUpdate(dto.ids, dto.data, user.id, user.organizationId);
  }

  @Delete('bulk')
  @HttpCode(HttpStatus.OK)
  @Permissions('leads:delete')
  bulkDelete(@Body() dto: BulkDeleteLeadsDto, @CurrentUser() user: any) {
    return this.leadsService.bulkDelete(dto.ids, user.id, user.organizationId);
  }

  @Get(':id')
  @Permissions('leads:view')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.findOne(id, user.id, user.role, user.organizationId);
  }

  @Post()
  @Permissions('leads:create')
  create(
    @Body() createLeadDto: CreateLeadDto,
    @CurrentUser() user: any
  ) {
    return this.leadsService.create(
      { ...createLeadDto, organizationId: user.organizationId },
      user?.id,
    );
  }

  @Patch(':id')
  @Permissions('leads:edit')
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @CurrentUser() user: any
  ) {
    return this.leadsService.update(id, updateLeadDto, user?.id, user.organizationId);
  }

  @Delete(':id')
  @Permissions('leads:delete')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.remove(id, user?.id, user.organizationId);
  }

  @Post(':id/analyze')
  @Permissions('leads:analyze')
  analyzeRisk(
    @Param('id') id: string,
    @Body() body: { provider?: string },
    @CurrentUser() user: any,
  ) {
    return this.leadsAiService.analyzeRisk(id, body.provider, user.organizationId);
  }

  @Post(':id/draft-email')
  @Permissions('leads:analyze')
  draftEmail(
    @Param('id') id: string,
    @Body('emailType') emailType: string = 'follow-up',
    @CurrentUser() user: any,
  ) {
    return this.leadsAiService.draftEmail(id, emailType || 'follow-up', user.organizationId);
  }

  @Post(':id/summary')
  @Permissions('leads:analyze')
  generateAISummary(
    @Param('id') id: string,
    @Body() body: { provider?: string },
    @CurrentUser() user: any,
  ) {
    return this.leadsAiService.generateAISummary(id, body.provider, user.organizationId);
  }

  // --- Rep sub-routes ---

  @Post(':id/reps')
  @Permissions('leads:edit')
  createRep(
    @Param('id') id: string,
    @Body() dto: CreateLeadRepDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.createRep(id, dto, user.organizationId);
  }

  @Patch(':id/reps/:repId')
  @Permissions('leads:edit')
  updateRep(
    @Param('id') id: string,
    @Param('repId') repId: string,
    @Body() dto: Partial<CreateLeadRepDto>,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.updateRep(repId, dto, user.organizationId);
  }

  @Delete(':id/reps/:repId')
  @Permissions('leads:edit')
  deleteRep(
    @Param('id') id: string,
    @Param('repId') repId: string,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.deleteRep(repId, user.organizationId);
  }

  @Post(':id/team')
  @Permissions('leads:edit')
  addTeamMember(
    @Param('id') id: string,
    @Body() dto: CreateTeamMemberDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.addTeamMember(id, dto.userId, dto.roleLabel, user.organizationId, user);
  }

  @Patch(':id/team/:memberId')
  @Permissions('leads:edit')
  updateTeamMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.updateTeamMember(memberId, dto.roleLabel, user.organizationId);
  }

  @Delete(':id/team/:memberId')
  @Permissions('leads:edit')
  removeTeamMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.removeTeamMember(memberId, user.organizationId);
  }
}
