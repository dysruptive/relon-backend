import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PermissionsModule, EmailModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
