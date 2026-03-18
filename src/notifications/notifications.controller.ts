import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Sse,
  Body,
} from '@nestjs/common';
import { Observable, map, finalize } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions('notifications:view')
  findAll(
    @CurrentUser() user: any,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.findAll(user.id, {
      unread: unread === 'true',
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('unread-count')
  @Permissions('notifications:view')
  getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Get('preferences')
  @Permissions('notifications:view')
  getPreferences(@CurrentUser() user: any) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @Permissions('notifications:view')
  updatePreferences(
    @CurrentUser() user: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.id, dto);
  }

  @Patch(':id/read')
  @Permissions('notifications:view')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post('mark-all-read')
  @Permissions('notifications:view')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Sse('stream')
  @Permissions('notifications:view')
  stream(@CurrentUser() user: any): Observable<MessageEvent> {
    const subject = this.notificationsService.getSubjectForUser(user.id);
    return subject.pipe(
      map(
        (notification) =>
          ({ data: JSON.stringify(notification) }) as MessageEvent,
      ),
      finalize(() => {
        this.notificationsService.removeSubjectForUser(user.id);
      }),
    );
  }
}
