import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCostLogDto } from './dto/create-cost-log.dto';

@Injectable()
export class ProjectsCostsService {
  constructor(private prisma: PrismaService) {}

  async getCostLogs(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return this.prisma.costLog.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async addCostLog(
    projectId: string,
    dto: CreateCostLogDto,
    userId: string,
    organizationId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const costLog = await this.prisma.costLog.create({
      data: {
        projectId,
        date: new Date(dto.date),
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        createdBy: userId,
        organizationId: project.organizationId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    await this.recalculateTotalCost(projectId);

    return costLog;
  }

  async removeCostLog(projectId: string, costId: string, organizationId: string) {
    const costLog = await this.prisma.costLog.findFirst({
      where: { id: costId, projectId, organizationId },
    });

    if (!costLog) {
      throw new NotFoundException(`Cost log not found`);
    }

    await this.prisma.costLog.delete({ where: { id: costId } });

    await this.recalculateTotalCost(projectId);

    return { message: 'Cost log deleted successfully' };
  }

  async recalculateTotalCost(projectId: string) {
    const result = await this.prisma.costLog.aggregate({
      where: { projectId },
      _sum: { amount: true },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { totalCost: result._sum.amount || 0 },
    });
  }
}
