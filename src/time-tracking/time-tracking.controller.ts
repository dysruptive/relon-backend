import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { CreateUserRateDto } from './dto/create-user-rate.dto';
import { CreateProjectBudgetDto } from './dto/create-project-budget.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('time-tracking')
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  // ─── Time Entries ─────────────────────────────────────────────────────────

  @Post('entries')
  @Permissions('time_tracking:create')
  createEntry(
    @Body() dto: CreateTimeEntryDto,
    @CurrentUser() user: any,
  ) {
    return this.timeTrackingService.createEntry(dto, user.sub, user.organizationId);
  }

  @Get('entries')
  @Permissions('time_tracking:read')
  getEntries(
    @CurrentUser() user: any,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.timeTrackingService.getEntries(
      {
        userId,
        projectId,
        startDate,
        endDate,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      user.organizationId,
    );
  }

  @Patch('entries/:id')
  @Permissions('time_tracking:edit_own')
  updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateTimeEntryDto,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.role === 'CEO' || user.role === 'ADMIN';
    return this.timeTrackingService.updateEntry(id, dto, user.sub, user.organizationId, isAdmin);
  }

  @Delete('entries/:id')
  @Permissions('time_tracking:edit_own')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEntry(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user.role === 'CEO' || user.role === 'ADMIN';
    return this.timeTrackingService.deleteEntry(id, user.sub, user.organizationId, isAdmin);
  }

  // ─── Timesheet ────────────────────────────────────────────────────────────

  @Get('timesheet')
  @Permissions('time_tracking:read')
  getTimesheet(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('userId') userId?: string,
  ) {
    return this.timeTrackingService.getWeeklyTimesheet(
      startDate,
      user.organizationId,
      userId,
    );
  }

  // ─── User Rates ───────────────────────────────────────────────────────────

  @Get('user-rates')
  @Permissions('time_tracking:read')
  getRates(@CurrentUser() user: any) {
    return this.timeTrackingService.getRatesForOrg(user.organizationId);
  }

  @Post('user-rates')
  @Permissions('time_tracking:edit_all')
  createRate(@Body() dto: CreateUserRateDto, @CurrentUser() user: any) {
    return this.timeTrackingService.createRate(dto, user.organizationId);
  }
}
