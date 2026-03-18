import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('admin/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('users:view')
  getAll(@CurrentUser() user: any) {
    return this.rolesService.getAll(user.organizationId);
  }

  @Post()
  @Permissions('permissions:edit')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: any) {
    return this.rolesService.create(dto, user.organizationId);
  }

  @Patch(':key')
  @Permissions('permissions:edit')
  update(@Param('key') key: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(key, dto);
  }

  @Delete(':key')
  @Permissions('permissions:edit')
  delete(@Param('key') key: string) {
    return this.rolesService.delete(key);
  }
}
