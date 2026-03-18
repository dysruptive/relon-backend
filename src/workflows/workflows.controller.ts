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
import { WorkflowsService } from './workflows.service';
import {
  CreateWorkflowRuleDto,
  UpdateWorkflowRuleDto,
} from './dto/workflows.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  @Permissions('workflows:view')
  findAll(@CurrentUser() user: any) {
    return this.workflowsService.findAll(user.organizationId);
  }

  @Get(':id')
  @Permissions('workflows:view')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workflowsService.findOne(id, user.organizationId);
  }

  @Post()
  @Permissions('workflows:create')
  create(
    @Body() dto: CreateWorkflowRuleDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.create(dto, user.id, user.organizationId);
  }

  @Patch(':id')
  @Permissions('workflows:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowRuleDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Permissions('workflows:delete')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workflowsService.delete(id, user.organizationId);
  }

  @Get(':id/executions')
  @Permissions('workflows:view')
  getExecutions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: any,
  ) {
    return this.workflowsService.getExecutions(
      id,
      user.organizationId,
      limit ? parseInt(limit) : undefined,
    );
  }

  @Post(':id/test')
  @Permissions('workflows:view')
  async testRule(
    @Param('id') id: string,
    @Body() body: { entityType?: string; entityId?: string },
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.testRule(
      id,
      user.organizationId,
      body.entityType || 'LEAD',
      body.entityId,
    );
  }
}
