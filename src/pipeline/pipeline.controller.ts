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
import { PipelineService } from './pipeline.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('stages')
  @Permissions('leads:view')
  findAll(@CurrentUser() user: any, @Query('type') type?: string) {
    return this.pipelineService.findAll(user.organizationId, type);
  }

  @Post('stages/initialize-defaults')
  @Permissions('pipeline:manage')
  initializeDefaults(@CurrentUser() user: any, @Query('type') type?: string) {
    return this.pipelineService.initializeDefaults(user.organizationId, type);
  }

  @Post('stages')
  @Permissions('pipeline:manage')
  create(@Body() dto: CreateStageDto, @CurrentUser() user: any) {
    return this.pipelineService.create(dto, user.organizationId);
  }

  @Patch('stages/reorder')
  @Permissions('pipeline:manage')
  reorder(@Body() dto: ReorderStagesDto, @CurrentUser() user: any) {
    return this.pipelineService.reorder(dto, user.organizationId);
  }

  @Patch('stages/:id')
  @Permissions('pipeline:manage')
  update(@Param('id') id: string, @Body() dto: UpdateStageDto, @CurrentUser() user: any) {
    return this.pipelineService.update(id, dto, user.organizationId);
  }

  @Delete('stages/:id')
  @Permissions('pipeline:manage')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pipelineService.remove(id, user.organizationId);
  }
}
