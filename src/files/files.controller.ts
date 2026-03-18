import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
];

function allowedFileFilter(_req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`File type not allowed: ${file.mimetype}`), false);
  }
}

@Controller('leads/:leadId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: allowedFileFilter,
    }),
  )
  async uploadFile(
    @Param('leadId') leadId: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.filesService.uploadFile(
      leadId,
      req.user.id,
      file,
      category || 'other',
      req.user.organizationId,
    );
  }

  @Get()
  async getFiles(@Param('leadId') leadId: string, @Request() req) {
    return this.filesService.getFilesByLead(leadId, req.user.organizationId);
  }

  @Get(':fileId')
  async getFile(@Param('fileId') fileId: string, @Request() req) {
    return this.filesService.getFileById(fileId, req.user.organizationId);
  }

  @Get(':fileId/download')
  async downloadFile(
    @Param('fileId') fileId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const { stream, mimeType, originalName } = await this.filesService.getFileStream(fileId, req.user.organizationId);

    // Set response headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);

    // Handle stream errors
    stream.on('error', (err: any) => {
      if (err.code === 404) {
        return res.status(404).send('File not found in storage');
      }
      console.error('Stream error:', err);
      return res.status(500).send('Error streaming file');
    });

    // Pipe the GCS stream to the response
    stream.pipe(res);
  }

  @Delete(':fileId')
  async deleteFile(@Param('fileId') fileId: string, @Request() req) {
    return this.filesService.deleteFile(fileId, req.user.id, req.user.organizationId);
  }
}

@Controller('clients/:clientId/files')
@UseGuards(JwtAuthGuard)
export class ClientFilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: allowedFileFilter,
    }),
  )
  async uploadFile(
    @Param('clientId') clientId: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.filesService.uploadFileForClient(
      clientId,
      req.user.id,
      file,
      category || 'other',
      req.user.organizationId,
    );
  }

  @Get()
  async getFiles(@Param('clientId') clientId: string, @Request() req) {
    return this.filesService.getFilesByClient(clientId, req.user.organizationId);
  }

  @Get(':fileId')
  async getFile(@Param('fileId') fileId: string, @Request() req) {
    return this.filesService.getFileById(fileId, req.user.organizationId);
  }

  @Get(':fileId/download')
  async downloadFile(
    @Param('fileId') fileId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const { stream, mimeType, originalName } = await this.filesService.getFileStream(fileId, req.user.organizationId);

    // Set response headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);

    // Handle stream errors
    stream.on('error', (err: any) => {
      if (err.code === 404) {
        return res.status(404).send('File not found in storage');
      }
      console.error('Stream error:', err);
      return res.status(500).send('Error streaming file');
    });

    // Pipe the GCS stream to the response
    stream.pipe(res);
  }

  @Delete(':fileId')
  async deleteFile(@Param('fileId') fileId: string, @Request() req) {
    return this.filesService.deleteFile(fileId, req.user.id, req.user.organizationId);
  }
}

@Controller('projects/:projectId/files')
@UseGuards(JwtAuthGuard)
export class ProjectFilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: allowedFileFilter,
    }),
  )
  async uploadFile(
    @Param('projectId') projectId: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.filesService.uploadFileForProject(
      projectId,
      req.user.id,
      file,
      category || 'other',
      req.user.organizationId,
    );
  }

  @Get()
  async getFiles(@Param('projectId') projectId: string, @Request() req) {
    return this.filesService.getFilesByProject(projectId, req.user.organizationId);
  }

  @Get(':fileId')
  async getFile(@Param('fileId') fileId: string, @Request() req) {
    return this.filesService.getFileById(fileId, req.user.organizationId);
  }

  @Get(':fileId/download')
  async downloadFile(
    @Param('fileId') fileId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const { stream, mimeType, originalName } = await this.filesService.getFileStream(fileId, req.user.organizationId);

    // Set response headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);

    // Handle stream errors
    stream.on('error', (err: any) => {
      if (err.code === 404) {
        return res.status(404).send('File not found in storage');
      }
      console.error('Stream error:', err);
      return res.status(500).send('Error streaming file');
    });

    // Pipe the GCS stream to the response
    stream.pipe(res);
  }

  @Delete(':fileId')
  async deleteFile(@Param('fileId') fileId: string, @Request() req) {
    return this.filesService.deleteFile(fileId, req.user.id, req.user.organizationId);
  }
}
