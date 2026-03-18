import { Module } from '@nestjs/common';
import { FilesController, ClientFilesController, ProjectFilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageModule } from '../storage/storage.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [StorageModule, DatabaseModule],
  controllers: [FilesController, ClientFilesController, ProjectFilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
