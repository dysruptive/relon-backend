import { Controller, Get, Post, Body } from '@nestjs/common';
import { BottleneckService } from './bottleneck.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('bottleneck')
export class BottleneckController {
  constructor(private readonly bottleneckService: BottleneckService) {}

  @Get('stage-dwell')
  @Permissions('analytics:view')
  getStageDwell(@CurrentUser() user: any) {
    return this.bottleneckService.getStageDwell(user.organizationId);
  }

  @Get('task-velocity')
  @Permissions('analytics:view')
  getTaskVelocity(@CurrentUser() user: any) {
    return this.bottleneckService.getTaskVelocity(user.organizationId);
  }

  @Get('stuck-projects')
  @Permissions('analytics:view')
  getStuckProjects(@CurrentUser() user: any) {
    return this.bottleneckService.getStuckProjects(user.organizationId);
  }

  @Post('ai-report')
  @Permissions('analytics:ai')
  generateAIReport(@Body() body: { reportType?: string }, @CurrentUser() user: any) {
    return this.bottleneckService.generateAIReport(body.reportType ?? 'bottleneck', user.organizationId);
  }
}
