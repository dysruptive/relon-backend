import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface FileUploadResult {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  category: string;
  gcpPath: string;
  downloadUrl: string;
  createdAt: Date;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
}

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async uploadFile(
    leadId: string,
    userId: string,
    file: Express.Multer.File,
    category: string = 'other',
    organizationId?: string,
  ): Promise<FileUploadResult> {
    // Upload to GCP (files remain private)
    const { fileName, gcpPath } = await this.storageService.uploadFile(
      file,
      `leads/${leadId}`,
    );

    // Derive organizationId from lead if not provided
    let orgId = organizationId;
    if (!orgId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { organizationId: true } });
      orgId = lead?.organizationId;
    }

    // Save metadata to database
    const fileRecord = await this.prisma.file.create({
      data: {
        leadId,
        organizationId: orgId!,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        category,
        gcpPath,
        uploadedById: userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Return with download URL that routes through backend API
    return {
      ...fileRecord,
      downloadUrl: `/leads/${leadId}/files/${fileRecord.id}/download`,
    };
  }

  async getFilesByLead(leadId: string, organizationId: string) {
    const files = await this.prisma.file.findMany({
      where: { leadId, organizationId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add download URLs that route through backend API
    return files.map((file) => ({
      ...file,
      downloadUrl: `/leads/${leadId}/files/${file.id}/download`,
    }));
  }

  async deleteFile(fileId: string, userId: string, organizationId?: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (organizationId && file.organizationId !== organizationId) {
      throw new NotFoundException('File not found');
    }

    // Only file uploader or admin can delete
    // You can add more complex permission logic here
    if (file.uploadedById !== userId) {
      throw new Error('You can only delete files you uploaded');
    }

    // Delete from GCP
    await this.storageService.deleteFile(file.gcpPath);

    // Delete from database
    await this.prisma.file.delete({
      where: { id: fileId },
    });

    return { message: 'File deleted successfully' };
  }

  async getFileById(fileId: string, organizationId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!file || file.organizationId !== organizationId) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  /**
   * Get file stream for downloading
   */
  async getFileStream(fileId: string, organizationId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.organizationId !== organizationId) {
      throw new NotFoundException('File not found');
    }

    const stream = this.storageService.getFileStream(file.gcpPath);

    return {
      stream,
      mimeType: file.mimeType,
      originalName: file.originalName,
    };
  }

  // ==================== CLIENT FILES ====================

  async uploadFileForClient(
    clientId: string,
    userId: string,
    file: Express.Multer.File,
    category: string = 'other',
    organizationId?: string,
  ): Promise<FileUploadResult> {
    const { fileName, gcpPath } = await this.storageService.uploadFile(
      file,
      `clients/${clientId}`,
    );

    let orgId = organizationId;
    if (!orgId) {
      const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { organizationId: true } });
      orgId = client?.organizationId;
    }

    const fileRecord = await this.prisma.file.create({
      data: {
        clientId,
        organizationId: orgId!,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        category,
        gcpPath,
        uploadedById: userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Return with download URL that routes through backend API
    return {
      ...fileRecord,
      downloadUrl: `/clients/${clientId}/files/${fileRecord.id}/download`,
    };
  }

  async getFilesByClient(clientId: string, organizationId: string) {
    const files = await this.prisma.file.findMany({
      where: { clientId, organizationId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add download URLs that route through backend API
    return files.map((file) => ({
      ...file,
      downloadUrl: `/clients/${clientId}/files/${file.id}/download`,
    }));
  }

  // ==================== PROJECT FILES ====================

  async uploadFileForProject(
    projectId: string,
    userId: string,
    file: Express.Multer.File,
    category: string = 'other',
    organizationId?: string,
  ): Promise<FileUploadResult> {
    const { fileName, gcpPath } = await this.storageService.uploadFile(
      file,
      `projects/${projectId}`,
    );

    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
      orgId = project?.organizationId;
    }

    const fileRecord = await this.prisma.file.create({
      data: {
        projectId,
        organizationId: orgId!,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        category,
        gcpPath,
        uploadedById: userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Return with download URL that routes through backend API
    return {
      ...fileRecord,
      downloadUrl: `/projects/${projectId}/files/${fileRecord.id}/download`,
    };
  }

  async getFilesByProject(projectId: string, organizationId: string) {
    const files = await this.prisma.file.findMany({
      where: { projectId, organizationId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add download URLs that route through backend API
    return files.map((file) => ({
      ...file,
      downloadUrl: `/projects/${projectId}/files/${file.id}/download`,
    }));
  }
}
