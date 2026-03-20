import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async create(createTeamDto: CreateTeamDto, organizationId: string) {
    if (createTeamDto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: createTeamDto.managerId, organizationId },
      });
      if (!manager) {
        throw new NotFoundException('Manager not found');
      }
    }

    const team = await this.prisma.team.create({
      data: {
        name: createTeamDto.name,
        description: createTeamDto.description,
        type: createTeamDto.type || 'SALES',
        managerId: createTeamDto.managerId,
        organizationId,
      },
    });

    if (createTeamDto.memberIds?.length) {
      await this.prisma.user.updateMany({
        where: { id: { in: createTeamDto.memberIds }, organizationId },
        data: { teamId: team.id },
      });
    }

    return team;
  }

  async findMyTeam(userId: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { teamId: true },
    });
    if (!user?.teamId) return null;
    return this.findOne(user.teamId, organizationId);
  }

  async findAll(organizationId: string) {
    return this.prisma.team.findMany({
      where: { organizationId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findOne(id: string, organizationId?: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async update(id: string, updateTeamDto: UpdateTeamDto, organizationId: string) {
    await this.findOne(id, organizationId);

    if (updateTeamDto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: updateTeamDto.managerId, organizationId },
      });
      if (!manager) {
        throw new NotFoundException('Manager not found');
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: updateTeamDto,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    const memberCount = await this.prisma.user.count({
      where: { teamId: id, organizationId },
    });

    if (memberCount > 0) {
      throw new BadRequestException(
        'Cannot delete team with existing members. Please reassign them first.'
      );
    }

    return this.prisma.team.delete({
      where: { id },
    });
  }

  async addMember(teamId: string, userId: string, organizationId: string) {
    await this.findOne(teamId, organizationId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { teamId },
    });
  }

  async removeMember(userId: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { teamId: null },
    });
  }
}
