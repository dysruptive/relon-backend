import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export { DashboardMetrics } from './dashboard-metrics.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getCalendarEvents(organizationId: string, start: string, end: string) {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');

    const [tasks, projects] = await Promise.all([
      this.prisma.task.findMany({
        where: { organizationId, dueDate: { gte: startDate, lte: endDate } },
        select: { id: true, title: true, dueDate: true, status: true, priority: true },
      }),
      this.prisma.project.findMany({
        where: {
          organizationId,
          OR: [
            { startDate: { gte: startDate, lte: endDate } },
            { estimatedDueDate: { gte: startDate, lte: endDate } },
            { startDate: { lte: startDate }, estimatedDueDate: { gte: endDate } },
          ],
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          estimatedDueDate: true,
          status: true,
        },
      }),
    ]);

    return [
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        start: t.dueDate!.toISOString().split('T')[0],
        end: t.dueDate!.toISOString().split('T')[0],
        type: 'task',
        entityType: 'task',
        status: t.status,
        priority: t.priority,
      })),
      ...projects.map((p) => ({
        id: `project-${p.id}`,
        title: p.name,
        start: (p.startDate ?? p.estimatedDueDate)!.toISOString().split('T')[0],
        end: (p.estimatedDueDate ?? p.startDate)!.toISOString().split('T')[0],
        type: 'project-span',
        entityType: 'project',
        status: p.status,
      })),
    ];
  }

  async getDashboardLayout(userId: string, organizationId: string) {
    const layout = await this.prisma.dashboardLayout.findFirst({
      where: { userId, organizationId },
    });
    return { widgets: layout?.widgets ?? [] };
  }

  async saveDashboardLayout(userId: string, organizationId: string, widgets: unknown[]) {
    const widgetsJson = widgets as Parameters<
      typeof this.prisma.dashboardLayout.create
    >[0]['data']['widgets'];
    return this.prisma.dashboardLayout.upsert({
      where: { userId },
      create: { userId, organizationId, widgets: widgetsJson },
      update: { widgets: widgetsJson },
    });
  }
}
