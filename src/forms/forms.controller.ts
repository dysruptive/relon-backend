import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Ip,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FormsService } from './forms.service';
import { CreateLeadFormDto } from './dto/create-lead-form.dto';
import { UpdateLeadFormDto } from './dto/update-lead-form.dto';
import { SubmitFormDto } from './dto/submit-form.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Permissions } from '../permissions/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  // ============================================================
  // Public routes (no auth) — must come before /:id routes
  // ============================================================

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('public/:apiKey')
  findPublic(@Param('apiKey') apiKey: string) {
    return this.formsService.findPublic(apiKey);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/:apiKey/submit')
  submit(
    @Param('apiKey') apiKey: string,
    @Body() dto: SubmitFormDto,
    @Ip() ip: string,
  ) {
    return this.formsService.submit(apiKey, dto, ip);
  }

  // ============================================================
  // Authenticated routes
  // ============================================================

  @Get()
  @Permissions('forms:read')
  findAll(@CurrentUser() user: any) {
    return this.formsService.findAll(user.organizationId);
  }

  @Post()
  @Permissions('forms:create')
  create(@Body() dto: CreateLeadFormDto, @CurrentUser() user: any) {
    return this.formsService.create(dto, user.organizationId);
  }

  @Get(':id')
  @Permissions('forms:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.formsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Permissions('forms:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadFormDto,
    @CurrentUser() user: any,
  ) {
    return this.formsService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Permissions('forms:delete')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.formsService.remove(id, user.organizationId);
  }

  @Get(':id/submissions')
  @Permissions('forms:read')
  getSubmissions(@Param('id') id: string, @CurrentUser() user: any) {
    return this.formsService.getSubmissions(id, user.organizationId);
  }

  @Get(':id/analytics')
  @Permissions('forms:read')
  getAnalytics(@Param('id') id: string, @CurrentUser() user: any) {
    return this.formsService.getAnalytics(id, user.organizationId);
  }
}
