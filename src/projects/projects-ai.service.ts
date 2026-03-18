import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ProjectsAiService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async analyzeProject(id: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      include: {
        client: { select: { id: true, name: true } },
        projectManager: { select: { id: true, name: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.aiService.analyzeLeadRisk(project, organizationId);
  }

  async draftProjectEmail(id: string, emailType: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      include: {
        client: { select: { id: true, name: true } },
        projectManager: { select: { id: true, name: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.aiService.draftEmail(project, emailType, organizationId);
  }
}
