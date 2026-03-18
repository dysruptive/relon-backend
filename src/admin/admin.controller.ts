import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAiSettingsService } from './admin-ai-settings.service';
import { AuditService } from '../audit/audit.service';
import { Permissions } from '../permissions/permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAiSettingsService: AdminAiSettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('users')
  @Permissions('users:view')
  async getAllUsers(@Request() req) {
    return this.adminService.getAllUsers(req.user.id, req.user.role, req.user.organizationId);
  }

  @Post('users')
  @Permissions('users:create')
  async createUser(@Request() req, @Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(req.user.id, createUserDto, req.user.organizationId);
  }

  @Patch('users/:id')
  @Permissions('users:edit')
  async updateUser(
    @Request() req,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(req.user.id, id, updateUserDto, req.user.organizationId);
  }

  @Delete('users/:id')
  @Permissions('users:delete')
  async deleteUser(@Request() req, @Param('id') id: string) {
    return this.adminService.deleteUser(req.user.id, id, req.user.organizationId);
  }

  @Get('ai-settings')
  @Permissions('ai_settings:view')
  getAISettings(@Request() req) {
    return this.adminAiSettingsService.getAISettings(req.user.organizationId);
  }

  @Patch('ai-settings')
  @Permissions('ai_settings:edit')
  updateAISettings(@Body() updateSettingsDto: any, @Request() req) {
    return this.adminAiSettingsService.updateAISettings(updateSettingsDto, req.user.organizationId);
  }

  @Get('api-keys/status')
  @Permissions('ai_settings:view')
  checkAPIKeys(@Request() req) {
    return this.adminAiSettingsService.checkAPIKeys(req.user.organizationId);
  }

  @Get('audit-logs')
  @Permissions('audit_logs:view')
  async getAllAuditLogs(
    @Request() req,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '50',
  ) {
    if (userId) {
      return this.auditService.getLogsForUser(userId, parseInt(take), req.user.organizationId);
    }
    return this.auditService.getAllLogs({
      skip: parseInt(skip),
      take: parseInt(take),
      action,
      organizationId: req.user.organizationId,
    });
  }

  @Get('audit-logs/user/:userId')
  @Permissions('audit_logs:view')
  async getAuditLogsByUser(
    @Request() req,
    @Param('userId') userId: string,
    @Query('limit') limit: string = '100',
  ) {
    return this.auditService.getLogsForUser(userId, parseInt(limit), req.user.organizationId);
  }

  @Get('audit-logs/action/:action')
  @Permissions('audit_logs:view')
  async getAuditLogsByAction(
    @Request() req,
    @Param('action') action: string,
    @Query('limit') limit: string = '100',
  ) {
    return this.auditService.getLogsByAction(action, parseInt(limit), req.user.organizationId);
  }

  @Get('tenant-settings')
  @Permissions('settings:manage')
  getTenantSettings(@Request() req) {
    return this.adminService.getTenantSettings(req.user.organizationId);
  }

  @Patch('tenant-settings')
  @Permissions('settings:manage')
  updateTenantSettings(
    @Body() dto: { clientDisplayMode?: string },
    @Request() req,
  ) {
    return this.adminService.updateTenantSettings(req.user.organizationId, dto);
  }
}
