import { Injectable, BadRequestException } from '@nestjs/common';
import { LeadStage } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';

@Injectable()
export class PipelineService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, type?: string) {
    return this.prisma.pipelineStage.findMany({
      where: { organizationId, ...(type ? { pipelineType: type } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(dto: CreateStageDto, organizationId: string) {
    const pipelineType = dto.pipelineType || 'prospective_project';

    // Auto-assign sortOrder within the same type and org
    if (dto.sortOrder === undefined) {
      const maxOrder = await this.prisma.pipelineStage.aggregate({
        where: { pipelineType, organizationId },
        _max: { sortOrder: true },
      });
      dto.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    return this.prisma.pipelineStage.create({
      data: {
        name: dto.name,
        pipelineType,
        color: dto.color,
        lightColor: dto.lightColor,
        border: dto.border,
        probability: dto.probability,
        sortOrder: dto.sortOrder,
        organizationId,
      },
    });
  }

  async update(id: string, dto: UpdateStageDto, organizationId?: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
    });
    if (!stage) {
      throw new BadRequestException('Stage not found');
    }

    if (stage.isSystem) {
      throw new BadRequestException('System stages cannot be modified');
    }

    return this.prisma.pipelineStage.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId?: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
    });
    if (!stage) {
      throw new BadRequestException('Stage not found');
    }

    if (stage.isSystem) {
      throw new BadRequestException('System stages cannot be deleted');
    }

    if (stage.pipelineType === 'project') {
      const count = await this.prisma.project.count({
        where: { status: stage.name, ...(organizationId ? { organizationId } : {}) },
      });
      if (count > 0) {
        throw new BadRequestException(
          `Cannot delete stage "${stage.name}" — ${count} project(s) are currently in this stage`,
        );
      }
    } else {
      const count = await this.prisma.lead.count({
        where: { stage: stage.name as LeadStage, ...(organizationId ? { organizationId } : {}) },
      });
      if (count > 0) {
        throw new BadRequestException(
          `Cannot delete stage "${stage.name}" — ${count} lead(s) are currently in this stage`,
        );
      }
    }

    return this.prisma.pipelineStage.delete({ where: { id } });
  }

  async initializeDefaults(organizationId: string, pipelineType?: string): Promise<{ created: number }> {
    const DEFAULTS: Record<string, { name: string; color: string; lightColor: string; border: string; probability: number; sortOrder: number; isSystem: boolean }[]> = {
      prospective_project: [
        { name: 'New',         color: 'bg-slate-500',  lightColor: 'bg-slate-50',  border: 'border-slate-200',  probability: 10,  sortOrder: 0, isSystem: false },
        { name: 'Contacted',   color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 25,  sortOrder: 1, isSystem: false },
        { name: 'Quoted',      color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 50,  sortOrder: 2, isSystem: false },
        { name: 'Negotiation', color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 75,  sortOrder: 3, isSystem: false },
        { name: 'Won',         color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 100, sortOrder: 4, isSystem: true  },
        { name: 'Lost',        color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0,   sortOrder: 5, isSystem: true  },
      ],
      project: [
        { name: 'Planning',  color: 'bg-blue-500',   lightColor: 'bg-blue-50',   border: 'border-blue-200',   probability: 0,   sortOrder: 0, isSystem: false },
        { name: 'Active',    color: 'bg-green-500',  lightColor: 'bg-green-50',  border: 'border-green-200',  probability: 50,  sortOrder: 1, isSystem: false },
        { name: 'On Hold',   color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 0,   sortOrder: 2, isSystem: false },
        { name: 'Completed', color: 'bg-gray-400',   lightColor: 'bg-gray-50',   border: 'border-gray-200',   probability: 100, sortOrder: 3, isSystem: true  },
        { name: 'Cancelled', color: 'bg-red-500',    lightColor: 'bg-red-50',    border: 'border-red-200',    probability: 0,   sortOrder: 4, isSystem: false },
      ],
    };

    const types = pipelineType ? [pipelineType] : Object.keys(DEFAULTS);
    let totalCreated = 0;

    for (const type of types) {
      const template = DEFAULTS[type];
      if (!template) continue;

      const existing = await this.prisma.pipelineStage.count({ where: { organizationId, pipelineType: type } });
      if (existing > 0) continue;

      const result = await this.prisma.pipelineStage.createMany({
        data: template.map(s => ({ ...s, pipelineType: type, organizationId })),
        skipDuplicates: true,
      });
      totalCreated += result.count;
    }

    return { created: totalCreated };
  }

  async reorder(dto: ReorderStagesDto, organizationId: string) {
    const updates = dto.stages.map((s) =>
      this.prisma.pipelineStage.update({
        where: { id: s.id },
        data: { sortOrder: s.sortOrder },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll(organizationId);
  }
}
