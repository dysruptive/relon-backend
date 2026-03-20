import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LeadMetricsService } from './lead-metrics.service';
import { LeadsStageService } from './leads-stage.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { EmailService } from '../email/email.service';
import { CreateLeadRepDto } from './dto/create-lead-rep.dto';

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private leadMetricsService: LeadMetricsService,
    private leadsStageService: LeadsStageService,
    private auditService: AuditService,
    private billingService: BillingService,
    private workflowsService: WorkflowsService,
    private emailService: EmailService,
  ) {}

  async findAll(userId: string, userRole: string, organizationId: string, year?: string, page?: number, limit?: number) {
    // Build query filters based on role
    const where: any = { organizationId, deletedAt: null };

    if (userRole === 'SALES') {
      // Sales executives see leads they are assigned to OR are a team member of
      where.OR = [
        { assignedToId: userId },
        { teamMembers: { some: { userId } } },
      ];
    } else if (userRole === 'BDM') {
      // BDMs see their team's leads OR leads they are a team member of
      const teamMembers = await this.prisma.user.findMany({
        where: { managerId: userId, organizationId },
        select: { id: true },
      });
      const teamMemberIds = teamMembers.map((m) => m.id);
      where.OR = [
        { assignedToId: { in: [...teamMemberIds, userId] } },
        { teamMembers: { some: { userId } } },
      ];
    } else if (userRole === 'DESIGNER' || userRole === 'QS') {
      // These roles only see leads where they are a team member
      where.teamMembers = { some: { userId } };
    }
    // CEO and ADMIN see all leads (no filter beyond org)

    // Optional year filter on likelyStartDate
    if (year) {
      const y = parseInt(year, 10);
      where.likelyStartDate = {
        gte: new Date(`${y}-01-01`),
        lt: new Date(`${y + 1}-01-01`),
      };
    }

    const take = limit ?? 100; // default 100, max enforced at controller (200)
    const skip = page && page > 1 ? (page - 1) * take : 0;

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
        teamMembers: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        serviceType: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true },
        },
        reps: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    // Batch-load all metrics in 3 queries instead of 4×N queries (N+1 fix)
    const batchMetrics =
      await this.leadMetricsService.calculateBatchMetrics(
        leads.map((l) => ({ id: l.id, createdAt: l.createdAt })),
      );

    return leads.map((lead) => {
      const metrics = batchMetrics.get(lead.id) ?? {
        daysInPipeline: 0,
        daysSinceLastContact: 0,
        activityCount: 0,
        fileCount: 0,
      };
      const riskFlags = this.leadMetricsService.detectRiskFlags(
        metrics,
        Number(lead.expectedValue),
        lead.stage,
      );
      return {
        ...lead,
        metrics,
        riskFlags,
        suggestedActions:
          this.leadMetricsService.generateSuggestedActions(
            riskFlags,
            metrics,
            lead.stage,
          ),
      };
    });
  }

  async findOne(id: string, userId: string, userRole: string, organizationId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
        teamMembers: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        serviceType: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true },
        },
        reps: true,
        stageHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!lead) {
      return null;
    }

    // Check access permissions
    if (
      userRole === 'SALES' &&
      lead.assignedToId !== userId &&
      !lead.teamMembers.some((m) => m.userId === userId)
    ) {
      throw new Error('You do not have permission to view this lead');
    }

    if ((userRole === 'DESIGNER' || userRole === 'QS') && !lead.teamMembers.some((m) => m.userId === userId)) {
      throw new Error('You do not have permission to view this lead');
    }

    if (userRole === 'BDM') {
      const teamMembers = await this.prisma.user.findMany({
        where: { managerId: userId, organizationId },
        select: { id: true },
      });
      const teamMemberIds = teamMembers.map((m) => m.id);
      const canAccess =
        lead.assignedToId === userId ||
        teamMemberIds.includes(lead.assignedToId || '');

      if (!canAccess) {
        throw new Error(
          'You do not have permission to view this lead',
        );
      }
    }

    // Enrich with metrics and risk flags
    return this.enrichLeadWithMetrics(lead);
  }

  async create(data: any, userId?: string) {
    // Check plan limit for leads
    const planCheck = await this.billingService.checkPlanLimit(data.organizationId, 'leads');
    if (!planCheck.allowed) {
      throw new BadRequestException(
        `Lead limit reached for your plan (${planCheck.current}/${planCheck.limit}). Please upgrade to add more leads.`
      );
    }

    if (data.stage) {
      await this.leadsStageService.validateStage(data.stage, data.organizationId);
    }

    const lead = await this.prisma.lead.create({
      data,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        teamMembers: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        serviceType: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        reps: true,
      },
    });

    // Record initial stage in stage history
    if (userId) {
      await this.leadsStageService.recordStageChange(
        lead.id,
        null,
        lead.stage || 'New',
        userId,
        lead.organizationId,
      );
    }

    // Audit log
    await this.auditService.log({
      userId: data.assignedToId || userId || 'system',
      organizationId: data.organizationId,
      action: 'CREATE_LEAD',
      details: {
        leadId: lead.id,
        company: lead.company,
        contactName: lead.contactName,
        expectedValue: lead.expectedValue,
        stage: lead.stage,
      },
    });

    // Auto-mark onboarding: first lead added
    await this.prisma.organization.updateMany({
      where: { id: data.organizationId, onboardingAddedLead: false },
      data: { onboardingAddedLead: true },
    }).catch(() => {});

    return lead;
  }

  async update(id: string, data: any, userId: string, organizationId: string) {
    if (data.stage) {
      await this.leadsStageService.validateStage(data.stage, organizationId);
    }

    // Check if stage is being changed
    if (data.stage && userId) {
      const currentLead = await this.prisma.lead.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { stage: true },
      });

      if (currentLead && currentLead.stage !== data.stage) {
        await this.leadsStageService.recordStageChange(
          id,
          currentLead.stage,
          data.stage,
          userId,
          organizationId,
        );

        // Auto-set dates based on stage transitions (use client-provided date if present)
        if (data.stage === 'Won' || data.stage === 'Lost') {
          data.dealClosedAt = data.dealClosedAt
            ? new Date(data.dealClosedAt)
            : new Date();
        }
        if (data.stage === 'Quoted') {
          data.quoteSentAt = new Date();
        }

        // Fire workflow trigger — fire-and-forget, does not block update
        if (organizationId) {
          this.workflowsService.triggerForEntity(
            organizationId,
            'LEAD_STAGE_CHANGED',
            'LEAD',
            id,
            { ...data, stage: data.stage, fromStage: currentLead.stage },
          );
        }
      }
    }

    // Normalize date string to Date for Prisma
    if (data.dealClosedAt && typeof data.dealClosedAt === 'string') {
      data.dealClosedAt = new Date(data.dealClosedAt);
    }

    const updatedLead = await this.prisma.lead.update({
      where: { id, organizationId },
      data,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        teamMembers: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        serviceType: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        reps: true,
      },
    });

    // Audit log
    await this.auditService.log({
      userId: userId || 'system',
      organizationId: organizationId || updatedLead.organizationId,
      action: 'UPDATE_LEAD',
      details: {
        leadId: id,
        updates: data,
      },
    });

    return updatedLead;
  }

  async remove(id: string, userId: string, organizationId: string) {
    // Get lead details before deletion for audit log
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        company: true,
        contactName: true,
        expectedValue: true,
        organizationId: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const deletedLead = await this.prisma.lead.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await this.auditService.log({
      userId: userId || 'system',
      organizationId: lead.organizationId,
      action: 'DELETE_LEAD',
      details: {
        leadId: id,
        company: lead.company,
        contactName: lead.contactName,
        expectedValue: lead.expectedValue,
      },
    });

    return deletedLead;
  }

  // ============================================================
  // Bulk Operations
  // ============================================================

  async bulkUpdate(
    ids: string[],
    data: { stage?: string; assignedToId?: string; urgency?: string },
    userId: string,
    organizationId: string,
  ) {
    if (!ids || ids.length === 0) return { updated: 0 };

    // Verify ALL ids belong to this org before mutation
    const owned = await this.prisma.lead.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true },
    });

    const ownedIds = owned.map((l) => l.id);
    if (ownedIds.length !== ids.length) {
      const missing = ids.filter((id) => !ownedIds.includes(id));
      throw new Error(`Leads not found or unauthorized: ${missing.join(', ')}`);
    }

    await this.prisma.lead.updateMany({
      where: { id: { in: ownedIds }, organizationId },
      data,
    });

    await this.auditService.log({
      userId,
      organizationId,
      action: 'BULK_UPDATE_LEADS',
      details: { ids: ownedIds, updates: data, count: ownedIds.length },
    });

    return { updated: ownedIds.length };
  }

  async bulkDelete(ids: string[], userId: string, organizationId: string) {
    if (!ids || ids.length === 0) return { deleted: 0 };

    // Verify ALL ids belong to this org before deletion
    const owned = await this.prisma.lead.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true },
    });

    const ownedIds = owned.map((l) => l.id);
    if (ownedIds.length !== ids.length) {
      const missing = ids.filter((id) => !ownedIds.includes(id));
      throw new Error(`Leads not found or unauthorized: ${missing.join(', ')}`);
    }

    await this.prisma.lead.updateMany({
      where: { id: { in: ownedIds }, organizationId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      organizationId,
      action: 'BULK_DELETE_LEADS',
      details: { ids: ownedIds, count: ownedIds.length },
    });

    return { deleted: ownedIds.length };
  }

  /**
   * Enrich lead with calculated metrics and risk flags
   */
  private async enrichLeadWithMetrics(lead: any) {
    // Calculate metrics
    const metrics = await this.leadMetricsService.calculateMetrics(
      lead.id,
      lead.createdAt,
    );

    // Detect risk flags
    const riskFlags = this.leadMetricsService.detectRiskFlags(
      metrics,
      lead.expectedValue,
      lead.stage,
    );

    // Generate suggested actions
    const suggestedActions =
      this.leadMetricsService.generateSuggestedActions(
        riskFlags,
        metrics,
        lead.stage,
      );

    return {
      ...lead,
      metrics,
      riskFlags,
      suggestedActions,
    };
  }

  // ============================================================
  // Rep management
  // ============================================================

  async createRep(leadId: string, data: CreateLeadRepDto, organizationId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });
    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    return this.prisma.leadRep.create({
      data: {
        leadId,
        organizationId: lead.organizationId,
        ...data,
      },
    });
  }

  async updateRep(repId: string, data: Partial<CreateLeadRepDto>, organizationId: string) {
    const rep = await this.prisma.leadRep.findUnique({
      where: { id: repId },
    });
    if (!rep) {
      throw new NotFoundException(`Rep with ID ${repId} not found`);
    }
    if (rep.organizationId !== organizationId) {
      throw new NotFoundException(`Rep with ID ${repId} not found`);
    }

    return this.prisma.leadRep.update({
      where: { id: repId },
      data,
    });
  }

  async deleteRep(repId: string, organizationId: string) {
    const rep = await this.prisma.leadRep.findUnique({
      where: { id: repId },
    });
    if (!rep) {
      throw new NotFoundException(`Rep with ID ${repId} not found`);
    }
    if (rep.organizationId !== organizationId) {
      throw new NotFoundException(`Rep with ID ${repId} not found`);
    }

    return this.prisma.leadRep.delete({ where: { id: repId } });
  }

  // ============================================================
  // Team member management
  // ============================================================

  async addTeamMember(
    leadId: string,
    userId: string,
    roleLabel: string,
    organizationId: string,
    actor?: { id: string; name: string },
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException(`Lead not found`);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user) throw new NotFoundException(`User not found`);

    const member = await this.prisma.leadTeamMember.create({
      data: { leadId, userId, roleLabel, organizationId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Fire-and-forget email — don't block the response
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const assignedByName = actor?.name ?? 'A team member';
    const entityName = lead.projectName || lead.company || 'a lead';
    this.emailService.sendAssignmentNotificationEmail({
      to: user.email,
      userName: user.name,
      role: roleLabel,
      entityType: 'lead',
      entityName,
      entityUrl: `${frontendUrl}/leads`,
      assignedByName,
    }).catch(() => { /* non-critical */ });

    return member;
  }

  async updateTeamMember(memberId: string, roleLabel: string, organizationId: string) {
    const member = await this.prisma.leadTeamMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException(`Team member not found`);
    }

    return this.prisma.leadTeamMember.update({
      where: { id: memberId },
      data: { roleLabel },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async removeTeamMember(memberId: string, organizationId: string) {
    const member = await this.prisma.leadTeamMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException(`Team member not found`);
    }

    return this.prisma.leadTeamMember.delete({ where: { id: memberId } });
  }
}
