import { Controller, Get, Post, Patch, Delete, Put, Body, Param, Query } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDefinitionDto, UpdateCustomFieldDefinitionDto, BulkSaveCustomFieldValuesDto } from './dto/custom-fields.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get('definitions')
  @Permissions('leads:read')
  getDefinitions(@CurrentUser() user: any, @Query('entityType') entityType?: string) {
    return this.customFieldsService.getDefinitions(user.organizationId, entityType);
  }

  @Post('definitions')
  @Permissions('custom_fields:manage')
  createDefinition(@Body() dto: CreateCustomFieldDefinitionDto, @CurrentUser() user: any) {
    return this.customFieldsService.createDefinition(dto, user.organizationId);
  }

  @Patch('definitions/:id')
  @Permissions('custom_fields:manage')
  updateDefinition(@Param('id') id: string, @Body() dto: UpdateCustomFieldDefinitionDto, @CurrentUser() user: any) {
    return this.customFieldsService.updateDefinition(id, dto, user.organizationId);
  }

  @Delete('definitions/:id')
  @Permissions('custom_fields:manage')
  deleteDefinition(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customFieldsService.deleteDefinition(id, user.organizationId);
  }

  @Get('values')
  @Permissions('leads:read')
  getValues(@CurrentUser() user: any, @Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.customFieldsService.getValues(user.organizationId, entityType, entityId);
  }

  @Put('values')
  @Permissions('leads:create')
  saveValues(@Body() dto: BulkSaveCustomFieldValuesDto, @CurrentUser() user: any) {
    return this.customFieldsService.saveValues(dto, user.organizationId);
  }
}
