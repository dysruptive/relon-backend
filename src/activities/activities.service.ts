import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  // ==================== LEAD ACTIVITIES ====================

  async createActivity(
    leadId: string,
    userId: string,
    createActivityDto: CreateActivityDto,
    organizationId?: string,
  ) {
    if (createActivityDto.type === 'meeting' && !createActivityDto.meetingType) {
      throw new BadRequestException('meetingType is required for meeting activities');
    }

    // Derive organizationId from lead if not provided
    let orgId = organizationId;
    if (!orgId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { organizationId: true } });
      orgId = lead?.organizationId;
    }

    return this.prisma.activity.create({
      data: {
        leadId,
        userId,
        organizationId: orgId!,
        type: createActivityDto.type,
        activityDate: new Date(createActivityDto.activityDate),
        activityTime: createActivityDto.activityTime,
        reason: createActivityDto.reason,
        notes: createActivityDto.notes,
        meetingType: createActivityDto.meetingType,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getActivitiesByLead(leadId: string, organizationId: string) {
    return this.prisma.activity.findMany({
      where: { leadId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { activityDate: 'desc' },
        { activityTime: 'desc' },
      ],
      take: 200,
    });
  }

  async deleteActivity(activityId: string, userId: string) {
    // Verify the activity belongs to the user
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new BadRequestException('Activity not found');
    }

    if (activity.userId !== userId) {
      throw new BadRequestException('You can only delete your own activities');
    }

    return this.prisma.activity.delete({
      where: { id: activityId },
    });
  }

  // ==================== CLIENT ACTIVITIES ====================

  async createActivityForClient(
    clientId: string,
    userId: string,
    createActivityDto: CreateActivityDto,
    organizationId?: string,
  ) {
    if (createActivityDto.type === 'meeting' && !createActivityDto.meetingType) {
      throw new BadRequestException('meetingType is required for meeting activities');
    }

    let orgId = organizationId;
    if (!orgId) {
      const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { organizationId: true } });
      orgId = client?.organizationId;
    }

    const activity = await this.prisma.activity.create({
      data: {
        clientId,
        userId,
        organizationId: orgId!,
        type: createActivityDto.type,
        activityDate: new Date(createActivityDto.activityDate),
        activityTime: createActivityDto.activityTime,
        reason: createActivityDto.reason,
        notes: createActivityDto.notes,
        meetingType: createActivityDto.meetingType,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update client's lastContactDate
    await this.prisma.client.update({
      where: { id: clientId },
      data: { lastContactDate: new Date() },
    });

    return activity;
  }

  async getActivitiesByClient(clientId: string, organizationId: string) {
    return this.prisma.activity.findMany({
      where: { clientId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { activityDate: 'desc' },
        { activityTime: 'desc' },
      ],
      take: 200,
    });
  }

  // ==================== PROJECT ACTIVITIES ====================

  async createActivityForProject(
    projectId: string,
    userId: string,
    createActivityDto: CreateActivityDto,
    organizationId?: string,
  ) {
    if (createActivityDto.type === 'meeting' && !createActivityDto.meetingType) {
      throw new BadRequestException('meetingType is required for meeting activities');
    }

    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
      orgId = project?.organizationId;
    }

    return this.prisma.activity.create({
      data: {
        projectId,
        userId,
        organizationId: orgId!,
        type: createActivityDto.type,
        activityDate: new Date(createActivityDto.activityDate),
        activityTime: createActivityDto.activityTime,
        reason: createActivityDto.reason,
        notes: createActivityDto.notes,
        meetingType: createActivityDto.meetingType,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getActivitiesByProject(projectId: string, organizationId: string) {
    return this.prisma.activity.findMany({
      where: { projectId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { activityDate: 'desc' },
        { activityTime: 'desc' },
      ],
      take: 200,
    });
  }
}
