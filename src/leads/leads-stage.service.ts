import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeadsStageService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validates that the given stage exists in the org's prospective_project pipeline.
   * Skips validation if the org has not configured any pipeline stages yet.
   */
  async validateStage(stage: string, organizationId: string): Promise<void> {
    const orgStageCount = await this.prisma.pipelineStage.count({
      where: { organizationId, pipelineType: 'prospective_project' },
    });
    if (orgStageCount === 0) return;

    const exists = await this.prisma.pipelineStage.findFirst({
      where: { name: stage, pipelineType: 'prospective_project', organizationId },
    });
    if (!exists) {
      throw new BadRequestException(
        `Stage "${stage}" does not exist in the prospective project pipeline.`,
      );
    }
  }

  /**
   * Records a stage change in the StageHistory table.
   */
  async recordStageChange(
    leadId: string,
    fromStage: string | null,
    toStage: string,
    changedBy: string,
    organizationId: string,
  ): Promise<void> {
    await this.prisma.stageHistory.create({
      data: { leadId, fromStage, toStage, changedBy, organizationId },
    });
  }
}
