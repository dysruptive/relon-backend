import { Module } from '@nestjs/common';
import {
  ActivitiesController,
  ClientActivitiesController,
  ProjectActivitiesController
} from './activities.controller';
import { ActivitiesService } from './activities.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ActivitiesController, ClientActivitiesController, ProjectActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
