import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';
import { ProjectsService } from './projects.service';
import { ProjectsAiService } from './projects-ai.service';
import { ProjectsCostsService } from './projects-costs.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateCostLogDto } from './dto/create-cost-log.dto';
import { CreateProjectAssignmentDto } from './dto/create-project-assignment.dto';
import { IsArray, IsString, IsObject } from 'class-validator';

class BulkUpdateProjectsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsObject()
  data: { status?: string };
}

class BulkDeleteProjectsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectsAiService: ProjectsAiService,
    private readonly projectsCostsService: ProjectsCostsService,
  ) {}

  @Get()
  @Permissions('projects:view')
  findAll(@CurrentUser() user: any) {
    return this.projectsService.findAll(user?.id, user?.role, user?.organizationId);
  }

  @Post()
  @Permissions('projects:create')
  create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.create(createProjectDto, user?.id, user?.organizationId);
  }

  // --- Bulk operations (must come before :id routes) ---

  @Patch('bulk')
  @Permissions('projects:edit')
  bulkUpdate(@Body() dto: BulkUpdateProjectsDto, @CurrentUser() user: any) {
    return this.projectsService.bulkUpdate(dto.ids, dto.data, user.id, user.organizationId);
  }

  @Delete('bulk')
  @HttpCode(HttpStatus.OK)
  @Permissions('projects:delete')
  bulkDelete(@Body() dto: BulkDeleteProjectsDto, @CurrentUser() user: any) {
    return this.projectsService.bulkDelete(dto.ids, user.id, user.organizationId);
  }

  @Get('client/:clientId')
  @Permissions('projects:view')
  findByClient(@Param('clientId') clientId: string, @CurrentUser() user: any) {
    return this.projectsService.findByClient(clientId, user?.organizationId);
  }

  @Post(':id/analyze')
  @HttpCode(HttpStatus.OK)
  @Permissions('projects:view')
  analyzeProject(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsAiService.analyzeProject(id, user.organizationId);
  }

  @Post(':id/draft-email')
  @HttpCode(HttpStatus.OK)
  @Permissions('projects:view')
  draftEmail(
    @Param('id') id: string,
    @Body('emailType') emailType: string = 'follow-up',
    @CurrentUser() user: any,
  ) {
    return this.projectsAiService.draftProjectEmail(id, emailType || 'follow-up', user.organizationId);
  }

  @Get(':id')
  @Permissions('projects:view')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.findOne(id, user?.organizationId);
  }

  @Patch(':id')
  @Permissions('projects:edit')
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.update(
      id,
      updateProjectDto,
      user?.id,
      user?.organizationId,
    );
  }

  @Delete(':id')
  @Permissions('projects:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.remove(id, user?.id, user?.organizationId);
  }

  @Post('convert-lead/:leadId')
  @Permissions('projects:create')
  convertLead(
    @Param('leadId') leadId: string,
    @Body() body: { clientId: string; projectManagerId?: string },
    @CurrentUser() user: any,
  ) {
    return this.projectsService.convertLead(
      leadId,
      body.clientId,
      body.projectManagerId,
      user?.id,
      user?.organizationId,
    );
  }

  // --- Cost Logs ---

  @Get(':id/costs')
  @Permissions('costs:view')
  getCostLogs(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsCostsService.getCostLogs(id, user?.organizationId);
  }

  @Post(':id/costs')
  @Permissions('costs:create')
  addCostLog(
    @Param('id') id: string,
    @Body() dto: CreateCostLogDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsCostsService.addCostLog(id, dto, user?.id, user?.organizationId);
  }

  @Delete(':id/costs/:costId')
  @Permissions('costs:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCostLog(
    @Param('id') id: string,
    @Param('costId') costId: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsCostsService.removeCostLog(id, costId, user?.organizationId);
  }

  // --- Project Assignments ---

  @Get(':id/assignments')
  @Permissions('projects:view')
  getAssignments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.getAssignments(id, user.organizationId);
  }

  @Post(':id/assignments')
  @Permissions('projects:edit')
  addAssignment(
    @Param('id') id: string,
    @Body() dto: CreateProjectAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.addAssignment(id, dto, user.organizationId, user);
  }

  @Patch(':id/assignments/:assignmentId')
  @Permissions('projects:edit')
  updateAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { role: string },
    @CurrentUser() user: any,
  ) {
    return this.projectsService.updateAssignment(id, assignmentId, body.role, user.organizationId);
  }

  @Delete(':id/assignments/:assignmentId')
  @Permissions('projects:edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.removeAssignment(id, assignmentId, user.organizationId);
  }
}
