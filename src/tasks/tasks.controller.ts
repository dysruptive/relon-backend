import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';
import { PermissionsService } from '../permissions/permissions.service';

interface CompleteTaskBody {
  completionNote: string;
}

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly permissionsService: PermissionsService,
  ) {}

  // --- Task Types ---

  @Get('task-types')
  @Permissions('tasks:read')
  getTaskTypes(@CurrentUser() user: any) {
    return this.tasksService.getTaskTypes(user.organizationId);
  }

  @Post('task-types')
  @Permissions('tasks:create')
  createTaskType(
    @Body() body: { name: string; description?: string; sortOrder?: number },
    @CurrentUser() user: any,
  ) {
    return this.tasksService.createTaskType(user.organizationId, body);
  }

  @Patch('task-types/:id')
  @Permissions('tasks:edit')
  updateTaskType(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
    @CurrentUser() user: any,
  ) {
    return this.tasksService.updateTaskType(id, user.organizationId, body);
  }

  @Delete('task-types/:id')
  @Permissions('tasks:delete')
  deleteTaskType(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.deleteTaskType(id, user.organizationId);
  }

  // --- Tasks ---

  @Get('summary')
  @Permissions('tasks:read')
  getSummary(@CurrentUser() user: any) {
    return this.tasksService.getMyTasksSummary(user.id, user.organizationId);
  }

  @Get('team-summary')
  @Permissions('tasks:read')
  async getTeamSummary(@CurrentUser() user: any) {
    const viewAll = await this.permissionsService.hasPermission(
      user.role,
      'tasks:view_all',
      user.organizationId,
    );
    return this.tasksService.getTeamSummary(user.id, user.organizationId, viewAll);
  }

  @Get('entity/:entityType/:entityId')
  @Permissions('tasks:read')
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.findByEntity(entityType, entityId, user.organizationId);
  }

  @Get(':id')
  @Permissions('tasks:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.findOne(id, user.organizationId);
  }

  @Get()
  @Permissions('tasks:read')
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('dueAfter') dueAfter?: string,
  ) {
    const canViewAll = await this.permissionsService.hasPermission(
      user.role,
      'tasks:view_all',
      user.organizationId,
    );
    return this.tasksService.findAll({
      organizationId: user.organizationId,
      userId: user.id,
      canViewAll,
      status,
      priority,
      entityType,
      entityId,
      assignedToId,
      dueBefore,
      dueAfter,
    });
  }

  @Post()
  @Permissions('tasks:create')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(dto, user.id, user.organizationId);
  }

  @Patch(':id')
  @Permissions('tasks:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.update(id, dto, user.id, user.organizationId);
  }

  @Post(':id/complete')
  @Permissions('tasks:edit')
  complete(
    @Param('id') id: string,
    @Body() body: CompleteTaskBody,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.complete(id, body.completionNote, user.id, user.organizationId);
  }

  @Delete(':id')
  @Permissions('tasks:delete')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.remove(id, user.organizationId);
  }
}
