import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('leads/:leadId/activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  async createActivity(
    @Param('leadId') leadId: string,
    @Request() req,
    @Body() createActivityDto: CreateActivityDto,
  ) {
    return this.activitiesService.createActivity(
      leadId,
      req.user.id,
      createActivityDto,
      req.user.organizationId,
    );
  }

  @Get()
  async getActivities(@Param('leadId') leadId: string, @Request() req) {
    return this.activitiesService.getActivitiesByLead(leadId, req.user.organizationId);
  }

  @Delete(':activityId')
  async deleteActivity(
    @Param('activityId') activityId: string,
    @Request() req,
  ) {
    return this.activitiesService.deleteActivity(activityId, req.user.id);
  }
}

@Controller('clients/:clientId/activities')
@UseGuards(JwtAuthGuard)
export class ClientActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  async createActivity(
    @Param('clientId') clientId: string,
    @Request() req,
    @Body() createActivityDto: CreateActivityDto,
  ) {
    return this.activitiesService.createActivityForClient(
      clientId,
      req.user.id,
      createActivityDto,
      req.user.organizationId,
    );
  }

  @Get()
  async getActivities(@Param('clientId') clientId: string, @Request() req) {
    return this.activitiesService.getActivitiesByClient(clientId, req.user.organizationId);
  }

  @Delete(':activityId')
  async deleteActivity(
    @Param('activityId') activityId: string,
    @Request() req,
  ) {
    return this.activitiesService.deleteActivity(activityId, req.user.id);
  }
}

@Controller('projects/:projectId/activities')
@UseGuards(JwtAuthGuard)
export class ProjectActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  async createActivity(
    @Param('projectId') projectId: string,
    @Request() req,
    @Body() createActivityDto: CreateActivityDto,
  ) {
    return this.activitiesService.createActivityForProject(
      projectId,
      req.user.id,
      createActivityDto,
      req.user.organizationId,
    );
  }

  @Get()
  async getActivities(@Param('projectId') projectId: string, @Request() req) {
    return this.activitiesService.getActivitiesByProject(projectId, req.user.organizationId);
  }

  @Delete(':activityId')
  async deleteActivity(
    @Param('activityId') activityId: string,
    @Request() req,
  ) {
    return this.activitiesService.deleteActivity(activityId, req.user.id);
  }
}
