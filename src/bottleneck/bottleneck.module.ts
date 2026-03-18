import { Module } from '@nestjs/common';
import { BottleneckService } from './bottleneck.service';
import { BottleneckController } from './bottleneck.controller';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, PermissionsModule, AiModule],
  controllers: [BottleneckController],
  providers: [BottleneckService],
})
export class BottleneckModule {}
