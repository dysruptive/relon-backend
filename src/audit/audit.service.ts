import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface LogAuditParams {
  userId: string;
  organizationId?: string;
  action: string;
  targetUserId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(params: LogAuditParams) {
    // If organizationId is not provided, look up from userId
    let organizationId = params.organizationId;
    if (!organizationId && params.userId && params.userId !== 'system') {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { organizationId: true },
      });
      organizationId = user?.organizationId;
    }

    // If we still don't have an organizationId (e.g. system action), skip
    if (!organizationId) {
      return null;
    }

    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        organizationId,
        action: params.action,
        targetUserId: params.targetUserId,
        details: params.details,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  /**
   * Get audit logs for a specific user (as actor or target)
   */
  async getLogsForUser(userId: string, limit = 50, organizationId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [{ userId }, { targetUserId: userId }],
      },
      include: {
        user: { select: { name: true, email: true } },
        targetUser: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all audit logs for an organization (admin only) with pagination
   */
  async getAllLogs(params: { skip?: number; take?: number; action?: string; organizationId: string }) {
    const { skip = 0, take = 50, action, organizationId } = params;
    if (!organizationId) throw new BadRequestException('organizationId is required');

    const where = {
      organizationId,
      ...(action ? { action } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, role: true } },
          targetUser: { select: { name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  /**
   * Get audit logs by action type
   * @deprecated Use getAllLogs with action param instead
   */
  async getLogsByAction(action: string, limit = 50, organizationId: string) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    return this.prisma.auditLog.findMany({
      where: { action, organizationId },
      include: {
        user: { select: { name: true, email: true, role: true } },
        targetUser: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
