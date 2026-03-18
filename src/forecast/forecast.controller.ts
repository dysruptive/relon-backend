import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { UpsertForecastTargetDto } from './dto/forecast.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('summary')
  @Permissions('analytics:view')
  getSummary(@CurrentUser() user: any) {
    return this.forecastService.getSummary(user.organizationId);
  }

  @Get('targets')
  @Permissions('analytics:view')
  getTargets(@CurrentUser() user: any, @Query('months') months?: string) {
    return this.forecastService.getTargets(user.organizationId, months ? parseInt(months, 10) : 6);
  }

  @Put('targets')
  @Permissions('analytics:view')
  upsertTarget(@Body() dto: UpsertForecastTargetDto, @CurrentUser() user: any) {
    return this.forecastService.upsertTarget(dto, user.organizationId);
  }
}
