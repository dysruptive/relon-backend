import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Subject } from 'rxjs';

export interface CreateNotificationDto {
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  private notificationSubjects = new Map<string, Subject<Record<string, unknown>>>();

  constructor(private prisma: PrismaService) {}

  getSubjectForUser(userId: string): Subject<Record<string, unknown>> {
    if (!this.notificationSubjects.has(userId)) {
      this.notificationSubjects.set(userId, new Subject());
    }
    return this.notificationSubjects.get(userId)!;
  }

  removeSubjectForUser(userId: string): void {
    const subject = this.notificationSubjects.get(userId);
    if (subject) {
      subject.complete();
      this.notificationSubjects.delete(userId);
    }
  }

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        organizationId: dto.organizationId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        entityType: dto.entityType,
        entityId: dto.entityId,
      },
    });

    // Push to SSE stream
    const subject = this.notificationSubjects.get(dto.userId);
    if (subject) {
      subject.next(notification as unknown as Record<string, unknown>);
    }

    return notification;
  }

  async createMany(dtos: CreateNotificationDto[]) {
    return Promise.all(dtos.map((dto) => this.create(dto)));
  }

  async findAll(
    userId: string,
    filters: { unread?: boolean; limit?: number; offset?: number },
  ) {
    const where: Record<string, unknown> = { userId };
    if (filters.unread) where.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { notifications, total, unreadCount };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async deleteOld(daysOld: number = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    return this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff }, read: true },
    });
  }

  async getPreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    return this.prisma.notificationPreference.create({ data: { userId } });
  }

  async updatePreferences(
    userId: string,
    dto: {
      taskAssigned?: boolean;
      taskDue?: boolean;
      taskOverdue?: boolean;
      leadStale?: boolean;
      leadStageChanged?: boolean;
      projectAtRisk?: boolean;
      clientDormant?: boolean;
      emailDigest?: boolean;
    },
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async hasRecentNotification(
    userId: string,
    type: string,
    entityId: string,
    withinHours = 20,
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinHours * 3600 * 1000);
    const count = await this.prisma.notification.count({
      where: { userId, type, entityId, createdAt: { gte: since } },
    });
    return count > 0;
  }
}
