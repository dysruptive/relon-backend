import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { CreateDropdownOptionDto, UpdateDropdownOptionDto } from './dto/dropdown-option.dto';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Service Types ──────────────────────────────────────────────────────────

  @Get('service-types')
  @Permissions('leads:view')
  findAllServiceTypes(@CurrentUser() user: any) {
    return this.settingsService.findAllServiceTypes(user.organizationId);
  }

  @Post('service-types')
  @Permissions('settings:manage')
  createServiceType(@Body() dto: CreateServiceTypeDto, @CurrentUser() user: any) {
    return this.settingsService.createServiceType(dto, user.organizationId);
  }

  @Patch('service-types/:id')
  @Permissions('settings:manage')
  updateServiceType(
    @Param('id') id: string,
    @Body() dto: Partial<CreateServiceTypeDto>,
    @CurrentUser() user: any,
  ) {
    return this.settingsService.updateServiceType(id, dto, user.organizationId);
  }

  @Delete('service-types/:id')
  @Permissions('settings:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteServiceType(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settingsService.deleteServiceType(id, user.organizationId);
  }

  // ── Dropdown Options ───────────────────────────────────────────────────────

  @Get('dropdown-options')
  @Permissions('leads:view')
  findDropdownOptions(@CurrentUser() user: any, @Query('category') category?: string) {
    return this.settingsService.findDropdownOptions(user.organizationId, category);
  }

  @Get('dropdown-options/all')
  @Permissions('settings:manage')
  findAllDropdownOptions(@CurrentUser() user: any) {
    return this.settingsService.findAllDropdownOptions(user.organizationId);
  }

  @Post('dropdown-options')
  @Permissions('settings:manage')
  createDropdownOption(@Body() dto: CreateDropdownOptionDto, @CurrentUser() user: any) {
    return this.settingsService.createDropdownOption(dto, user.organizationId);
  }

  @Patch('dropdown-options/:id')
  @Permissions('settings:manage')
  updateDropdownOption(
    @Param('id') id: string,
    @Body() dto: UpdateDropdownOptionDto,
    @CurrentUser() user: any,
  ) {
    return this.settingsService.updateDropdownOption(id, dto, user.organizationId);
  }

  @Delete('dropdown-options/:id')
  @Permissions('settings:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDropdownOption(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settingsService.deleteDropdownOption(id, user.organizationId);
  }

  @Post('dropdown-options/reorder')
  @Permissions('settings:manage')
  reorderDropdownOptions(
    @Body() body: { category: string; orderedIds: string[] },
    @CurrentUser() user: any,
  ) {
    return this.settingsService.reorderDropdownOptions(body.category, body.orderedIds, user.organizationId);
  }
}
