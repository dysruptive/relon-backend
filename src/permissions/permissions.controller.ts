import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  ForbiddenException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { Permissions } from './permissions.decorator';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('matrix')
  @Permissions('permissions:view')
  getMatrix(@Request() req: any) {
    return this.permissionsService.getMatrix(req.user.organizationId);
  }

  @Put('role/:role')
  @Permissions('permissions:edit')
  async updateRolePermissions(
    @Param('role') role: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Request() req: any,
  ) {
    if (role === 'CEO') {
      throw new ForbiddenException('Cannot modify CEO permissions');
    }

    const roleRecord = await this.prisma.role.findUnique({ where: { key: role } });
    if (!roleRecord) {
      throw new NotFoundException(`Role not found: ${role}`);
    }

    await this.permissionsService.updateRolePermissions(
      role,
      dto.permissions,
      req.user.organizationId,
    );

    await this.auditService.log({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: 'UPDATE_PERMISSIONS',
      details: {
        role,
        permissions: dto.permissions,
      },
    });

    return { message: `Permissions updated for role ${role}` };
  }
}
