import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { ClientMetricsService } from './client-metrics.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private clientMetricsService: ClientMetricsService,
    private auditService: AuditService,
    private billingService: BillingService,
  ) {}

  async findAll(userId: string, userRole: string, organizationId: string) {
    // Build query filters based on role
    const where: any = { organizationId, deletedAt: null };

    if (userRole === 'SALES') {
      // Sales executives see only their assigned clients
      where.accountManagerId = userId;
    } else if (userRole === 'BDM') {
      // BDMs see their team's clients OR clients linked to leads they are a team member of
      const teamMembers = await this.prisma.user.findMany({
        where: { managerId: userId, organizationId },
        select: { id: true },
      });
      const teamMemberIds = teamMembers.map((m) => m.id);

      const leadClients = await this.prisma.lead.findMany({
        where: { organizationId, deletedAt: null, teamMembers: { some: { userId } }, clientId: { not: null } },
        select: { clientId: true },
      });
      const leadClientIds = leadClients.map((l) => l.clientId).filter(Boolean) as string[];

      where.OR = [
        { accountManagerId: { in: [...teamMemberIds, userId] } },
        ...(leadClientIds.length > 0 ? [{ id: { in: leadClientIds } }] : []),
      ];
    }
    // CEO, ADMIN, DESIGNER, QS see all clients (no filter beyond org)

    const clients = await this.prisma.client.findMany({
      where,
      include: {
        accountManager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            contractedValue: true,
            startDate: true,
            completedDate: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        convertedFromLeads: {
          select: {
            id: true,
            contactName: true,
            company: true,
            expectedValue: true,
            stage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Batch-load all metrics in 2 queries instead of 4×N queries (N+1 fix)
    const batchMetrics =
      await this.clientMetricsService.calculateBatchMetrics(
        clients.map((c) => ({
          id: c.id,
          createdAt: c.createdAt,
          projects: c.projects,
        })),
      );

    return clients.map((client) => {
      const metrics = batchMetrics.get(client.id)!;
      const healthFlags = this.clientMetricsService.detectHealthFlags(
        metrics,
        Number(client.lifetimeRevenue),
      );
      return {
        ...client,
        metrics,
        healthFlags,
        suggestedActions:
          this.clientMetricsService.generateSuggestedActions(
            healthFlags,
            metrics,
          ),
      };
    });
  }

  async findOne(id: string, userId: string, userRole: string, organizationId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        accountManager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            contractedValue: true,
            startDate: true,
            completedDate: true,
            description: true,
            projectManager: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          select: {
            id: true,
            type: true,
            activityDate: true,
            activityTime: true,
            reason: true,
            notes: true,
            meetingType: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20, // Last 20 activities for AI context
        },
        convertedFromLeads: {
          select: {
            id: true,
            contactName: true,
            company: true,
            expectedValue: true,
            stage: true,
          },
        },
      },
    });

    if (!client) {
      return null;
    }

    // Check access permissions
    if (userRole === 'SALES' && client.accountManagerId !== userId) {
      throw new Error(
        'You do not have permission to view this client',
      );
    }

    if (userRole === 'BDM') {
      const teamMembers = await this.prisma.user.findMany({
        where: { managerId: userId, organizationId },
        select: { id: true },
      });
      const teamMemberIds = teamMembers.map((m) => m.id);
      const canAccess =
        client.accountManagerId === userId ||
        teamMemberIds.includes(client.accountManagerId || '');

      if (!canAccess) {
        throw new Error(
          'You do not have permission to view this client',
        );
      }
    }

    // Enrich with metrics
    return this.enrichClientWithMetrics(client);
  }

  async create(data: any, userId: string) {
    const planCheck = await this.billingService.checkPlanLimit(data.organizationId, 'clients');
    if (!planCheck.allowed) {
      throw new BadRequestException(
        `Client limit reached for your plan (${planCheck.current}/${planCheck.limit}). Please upgrade to add more clients.`,
      );
    }

    const client = await this.prisma.client.create({
      data,
    });

    // Audit log
    await this.auditService.log({
      userId: data.accountManagerId || userId || 'system',
      organizationId: data.organizationId,
      action: 'CREATE_CLIENT',
      details: {
        clientId: client.id,
        name: client.name,
        segment: client.segment,
        industry: client.industry,
      },
    });

    return client;
  }

  async update(id: string, data: any, userId: string, organizationId: string) {
    const { accountManager, ...rest } = data;
    const prismaData: any = { ...rest };

    if (accountManager !== undefined) {
      prismaData.accountManager = accountManager
        ? { connect: { id: accountManager } }
        : { disconnect: true };
    }

    const client = await this.prisma.client.update({
      where: { id, organizationId },
      data: prismaData,
    });

    // Audit log
    await this.auditService.log({
      userId: userId || 'system',
      organizationId: organizationId || client.organizationId,
      action: 'UPDATE_CLIENT',
      details: {
        clientId: id,
        updates: data,
      },
    });

    return client;
  }

  async remove(id: string, userId: string, organizationId: string) {
    // Get client details before deletion for audit log
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        segment: true,
        industry: true,
        organizationId: true,
      },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    const deletedClient = await this.prisma.client.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await this.auditService.log({
      userId: userId || 'system',
      organizationId: client.organizationId,
      action: 'DELETE_CLIENT',
      details: {
        clientId: id,
        name: client.name,
        segment: client.segment,
        industry: client.industry,
      },
    });

    return deletedClient;
  }

  /**
   * Convert a won lead to a client with first project
   */
  async convertLeadToClient(
    leadId: string,
    accountManagerId: string | undefined,
    projectManagerId: string | undefined,
    projectData: {
      name?: string;
      contractedValue?: number;
      endOfProjectValue?: number;
      estimatedDueDate?: string;
      closedDate?: string;
      designerId?: string;
      qsId?: string;
      description?: string;
      status?: string;
    } | undefined,
    organizationId: string,
  ) {
    // Get the lead
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: {
        assignedTo: true,
        client: true, // Include linked client if exists
        serviceType: { select: { id: true, name: true } },
      },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    if (lead.stage !== 'Won') {
      throw new Error('Only Won leads can be converted to clients');
    }

    if (lead.convertedToClientId) {
      throw new Error('Lead has already been converted');
    }

    let client;
    let isNewClient = false;
    let existingClientDetected = false;

    const clientInclude = {
      accountManager: {
        select: { id: true, name: true, email: true, role: true },
      },
    };

    // Check if lead is already linked to an existing client (repeat business)
    if (lead.clientId && lead.client) {
      // Use existing client
      client = await this.prisma.client.findFirst({
        where: { id: lead.clientId, organizationId },
        include: clientInclude,
      });
    } else if (lead.email) {
      // Check if a client with the same email already exists in same org
      const existingClient = await this.prisma.client.findFirst({
        where: { email: lead.email, organizationId },
        include: clientInclude,
      });

      if (existingClient) {
        client = existingClient;
        existingClientDetected = true;
      }
    }

    if (!client) {
      // Create new client from lead data
      client = await this.prisma.client.create({
        data: {
          name: lead.company,
          email: lead.email,
          phone: lead.phone,
          segment: 'SME',
          industry: lead.serviceType?.name || 'General',
          accountManagerId: accountManagerId || lead.assignedToId,
          organizationId: lead.organizationId,
        },
        include: clientInclude,
      });
      isNewClient = true;
    }

    // Create first project for the client
    const project = await this.prisma.project.create({
      data: {
        name:
          projectData?.name ||
          `${lead.company} - ${lead.serviceType?.name || lead.projectName || 'Project'}`,
        clientId: client.id,
        leadId: lead.id,
        status: projectData?.status || 'Planning',
        contractedValue:
          projectData?.contractedValue ??
          lead.contractedValue ??
          lead.expectedValue,
        endOfProjectValue:
          projectData?.endOfProjectValue ?? undefined,
        estimatedDueDate: projectData?.estimatedDueDate
          ? new Date(projectData.estimatedDueDate)
          : undefined,
        closedDate: projectData?.closedDate
          ? new Date(projectData.closedDate)
          : undefined,
        description:
          projectData?.description ?? lead.notes ?? undefined,
        projectManagerId:
          projectManagerId || accountManagerId || undefined,
        organizationId: lead.organizationId,
      },
      include: {
        projectManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead to mark it as converted
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        convertedToClientId: client.id,
      },
    });

    // Update client project counts (increment for existing clients)
    await this.prisma.client.update({
      where: { id: client.id },
      data: {
        totalProjectCount: { increment: 1 },
        activeProjectCount: { increment: 1 },
      },
    });

    const message = isNewClient
      ? `Successfully converted lead "${lead.contactName}" to new client "${client.name}" with first project`
      : existingClientDetected
        ? `Lead "${lead.contactName}" auto-linked to existing client "${client.name}" (matching email) with new project`
        : `Successfully converted lead "${lead.contactName}" to project for existing client "${client.name}"`;

    // Audit log
    await this.auditService.log({
      userId: accountManagerId || lead.assignedToId || 'system',
      organizationId: lead.organizationId,
      action: 'CONVERT_LEAD_TO_CLIENT',
      details: {
        leadId,
        clientId: client.id,
        clientName: client.name,
        projectId: project.id,
        projectName: project.name,
        isNewClient,
      },
    });

    return {
      client,
      project,
      message,
      isNewClient,
      existingClientDetected,
    };
  }

  /**
   * Enrich client with calculated metrics and health flags
   */
  private async enrichClientWithMetrics(client: any) {
    // Calculate metrics
    const metrics = await this.clientMetricsService.calculateMetrics(
      client.id,
      client.createdAt,
    );

    // Detect health flags
    const healthFlags = this.clientMetricsService.detectHealthFlags(
      metrics,
      client.lifetimeRevenue,
    );

    // Generate suggested actions
    const suggestedActions =
      this.clientMetricsService.generateSuggestedActions(
        healthFlags,
        metrics,
      );

    return {
      ...client,
      metrics,
      healthFlags,
      suggestedActions,
    };
  }

  /**
   * Automatically update health status using AI + metrics
   */
  async updateHealthStatus(id: string, provider: string | undefined, organizationId: string) {
    const client = await this.findOne(id, undefined, undefined, organizationId);
    if (!client) {
      throw new Error('Client not found');
    }

    // Skip if status is manually overridden
    if (client.statusOverride) {
      return {
        message:
          'Health status is manually overridden and will not be auto-updated',
        currentStatus: client.status,
        overrideReason: client.statusOverrideReason,
      };
    }

    // Generate health report with AI (includes metrics)
    const report = await this.aiService.generateClientHealth(
      client,
      organizationId,
      provider,
    );

    // Determine status based on metrics
    const calculatedStatus =
      this.clientMetricsService.determineHealthStatus(
        client.metrics?.engagementScore || 0,
        client.metrics?.activeProjectCount || 0,
      );

    // Update client
    await this.update(id, {
      status: calculatedStatus,
      healthScore: report.healthScore,
      aiHealthSummary: report.summary,
      statusLastCalculated: new Date(),
    }, undefined, organizationId);

    return {
      message: 'Health status updated successfully',
      status: calculatedStatus,
      healthScore: report.healthScore,
      report,
    };
  }

  /**
   * Manually override health status
   */
  async overrideHealthStatus(
    id: string,
    status: string,
    reason: string,
    userId: string,
    organizationId: string,
  ) {
    const client = await this.findOne(id, undefined, undefined, organizationId);
    if (!client) {
      throw new Error('Client not found');
    }

    await this.update(id, {
      status,
      statusOverride: true,
      statusOverrideReason: reason,
    }, userId, organizationId);

    return {
      message: 'Health status overridden successfully',
      status,
      reason,
    };
  }

  async generateHealthReport(id: string, provider: string | undefined, organizationId: string) {
    const client = await this.findOne(id, undefined, undefined, organizationId);
    if (!client) {
      throw new Error('Client not found');
    }

    const report = await this.aiService.generateClientHealth(
      client,
      organizationId,
      provider,
    );

    // Update client with AI insights
    await this.update(id, {
      healthScore: report.healthScore,
      aiHealthSummary: report.summary,
    }, undefined, organizationId);

    return report;
  }

  async generateUpsellStrategy(id: string, provider: string | undefined, organizationId: string) {
    const client = await this.findOne(id, undefined, undefined, organizationId);
    if (!client) {
      throw new Error('Client not found');
    }

    const strategy = await this.aiService.generateUpsellStrategy(
      client,
      organizationId,
      provider,
    );

    // Update client with upsell strategy
    await this.update(id, {
      aiUpsellStrategy: JSON.stringify(strategy),
    }, undefined, organizationId);

    return strategy;
  }
}
