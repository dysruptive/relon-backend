import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServiceItemsService } from './service-items.service';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceItemDto } from './dto/update-service-item.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { CreateRoleEstimateDto } from './dto/create-role-estimate.dto';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('service-items')
export class ServiceItemsController {
  constructor(private readonly serviceItemsService: ServiceItemsService) {}

  @Get()
  @Permissions('service_items:read')
  findAll(
    @CurrentUser() user: any,
    @Query('serviceTypeId') serviceTypeId?: string,
  ) {
    return this.serviceItemsService.findAll(user.organizationId, serviceTypeId);
  }

  @Get(':id')
  @Permissions('service_items:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.serviceItemsService.findOne(id, user.organizationId);
  }

  @Post()
  @Permissions('service_items:manage')
  create(@Body() dto: CreateServiceItemDto, @CurrentUser() user: any) {
    return this.serviceItemsService.create(dto, user.organizationId);
  }

  @Patch(':id')
  @Permissions('service_items:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceItemDto,
    @CurrentUser() user: any,
  ) {
    return this.serviceItemsService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Permissions('service_items:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.serviceItemsService.remove(id, user.organizationId);
  }

  // ── Subtasks ──────────────────────────────────────────────────────────────

  @Get(':id/subtasks')
  @Permissions('service_items:read')
  getSubtasks(@Param('id') id: string, @CurrentUser() user: any) {
    return this.serviceItemsService.getSubtasks(id, user.organizationId);
  }

  @Post(':id/subtasks')
  @Permissions('service_items:manage')
  createSubtask(
    @Param('id') id: string,
    @Body() dto: CreateSubtaskDto,
    @CurrentUser() user: any,
  ) {
    return this.serviceItemsService.createSubtask(id, dto, user.organizationId);
  }

  @Patch(':id/subtasks/:subtaskId')
  @Permissions('service_items:manage')
  updateSubtask(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Body() dto: Partial<CreateSubtaskDto>,
    @CurrentUser() user: any,
  ) {
    return this.serviceItemsService.updateSubtask(
      id,
      subtaskId,
      dto,
      user.organizationId,
    );
  }

  @Delete(':id/subtasks/:subtaskId')
  @Permissions('service_items:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubtask(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @CurrentUser() user: any,
  ) {
    return this.serviceItemsService.deleteSubtask(
      id,
      subtaskId,
      user.organizationId,
    );
  }

  @Post(':id/subtasks/reorder')
  @Permissions('service_items:manage')
  reorderSubtasks(
    @Param('id') id: string,
    @Body() body: { orderedIds: string[] },
    @CurrentUser() user: any,
  ) {
    return this.serviceItemsService.reorderSubtasks(
      id,
      body.orderedIds,
      user.organizationId,
    );
  }

  // ── Role Estimates ────────────────────────────────────────────────────────

  @Put(':id/subtasks/:subtaskId/roles/:role')
  @Permissions('service_items:manage')
  upsertRoleEstimate(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Param('role') role: string,
    @Body() dto: CreateRoleEstimateDto,
    @CurrentUser() user: any,
  ) {
    return this.serviceItemsService.upsertRoleEstimate(
      id,
      subtaskId,
      role,
      dto.estimatedHours,
      user.organizationId,
    );
  }

  @Delete(':id/subtasks/:subtaskId/roles/:role')
  @Permissions('service_items:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoleEstimate(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Param('role') role: string,
    @CurrentUser() user: any,
  ) {
    return this.serviceItemsService.deleteRoleEstimate(
      id,
      subtaskId,
      role,
      user.organizationId,
    );
  }
}
