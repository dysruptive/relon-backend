import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateProjectAssignmentDto } from './dto/create-project-assignment.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private billingService: BillingService,
    private emailService: EmailService,
  ) {}

  private readonly projectInclude = {
    client: { select: { id: true, name: true } },
    lead: { select: { id: true, contactName: true, company: true } },
    projectManager: { select: { id: true, name: true, email: true } },
    assignments: {
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' as const },
    },
    statusHistory: {
      orderBy: { createdAt: 'asc' as const },
      include: { user: { select: { name: true } } },
    },
  };

  /**
   * List all projects (role-filtered, org-scoped)
   */
  async findAll(userId: string, userRole: string, organizationId: string) {
    const where: any = { organizationId, deletedAt: null };

    // Role-based filtering
    if (userRole === 'SALES') {
      where.projectManagerId = userId;
    } else if (userRole === 'DESIGNER' || userRole === 'QS') {
      where.assignments = { some: { userId } };
    }

    return this.prisma.project.findMany({
      where,
      include: this.projectInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Create a new project
   */
  async create(createProjectDto: CreateProjectDto, userId: string | undefined, organizationId: string) {
    {
      const planCheck = await this.billingService.checkPlanLimit(organizationId, 'projects');
      if (!planCheck.allowed) {
        throw new BadRequestException(
          `Project limit reached for your plan (${planCheck.current}/${planCheck.limit}). Please upgrade to add more projects.`,
        );
      }
    }

    const { clientId, leadId, status, ...projectData } =
      createProjectDto;

    // Verify client exists (and belongs to same org)
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId },
    });

    if (!client) {
      throw new NotFoundException(
        `Client with ID ${clientId} not found`,
      );
    }

    // If leadId provided, verify it exists (and belongs to same org)
    if (leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: leadId, organizationId },
      });

      if (!lead) {
        throw new NotFoundException(
          `Lead with ID ${leadId} not found`,
        );
      }
    }

    // Create project
    const project = await this.prisma.project.create({
      data: {
        ...projectData,
        clientId,
        leadId: leadId || null,
        status,
        organizationId,
      },
      include: this.projectInclude,
    });

    // Update client project counts
    await this.updateClientProjectCounts(clientId);

    // Record initial status in history
    if (userId) {
      await this.prisma.projectStatusHistory.create({
        data: {
          projectId: project.id,
          fromStatus: null,
          toStatus: project.status,
          changedBy: userId,
          organizationId: project.organizationId,
        },
      });
    }

    // Audit log
    await this.auditService.log({
      userId: createProjectDto.projectManagerId || userId || 'system',
      organizationId: project.organizationId,
      action: 'CREATE_PROJECT',
      details: {
        projectId: project.id,
        projectName: project.name,
        clientId: project.clientId,
        clientName: client.name,
        contractedValue: project.contractedValue,
        status: project.status,
      },
    });

    return project;
  }

  /**
   * Get all projects for a client (org-scoped)
   */
  async findByClient(clientId: string, organizationId: string) {
    return this.prisma.project.findMany({
      where: { clientId, organizationId },
      include: this.projectInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single project by ID (org-scoped)
   */
  async findOne(id: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        client: true,
        lead: true,
        projectManager: {
          select: { id: true, name: true, email: true },
        },
        assignments: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        costLogs: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  /**
   * Update a project (org-scoped)
   */
  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    userId: string | undefined,
    organizationId: string,
  ) {
    const existingProject = await this.prisma.project.findFirst({
      where: { id, organizationId },
    });

    if (!existingProject) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const project = await this.prisma.project.update({
      where: { id, organizationId },
      data: updateProjectDto,
      include: this.projectInclude,
    });

    // Update client project counts if status changed
    if (
      updateProjectDto.status &&
      updateProjectDto.status !== existingProject.status
    ) {
      await this.updateClientProjectCounts(existingProject.clientId);

      // Record status change in history
      if (userId) {
        await this.prisma.projectStatusHistory.create({
          data: {
            projectId: id,
            fromStatus: existingProject.status,
            toStatus: updateProjectDto.status,
            changedBy: userId,
            organizationId: existingProject.organizationId,
          },
        });
      }
    }

    // Audit log
    await this.auditService.log({
      userId: userId || 'system',
      organizationId: existingProject.organizationId,
      action: 'UPDATE_PROJECT',
      details: {
        projectId: id,
        projectName: project.name,
        updates: updateProjectDto,
      },
    });

    return project;
  }

  /**
   * Delete a project (org-scoped)
   */
  async remove(id: string, userId: string | undefined, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        client: {
          select: { name: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    await this.prisma.project.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });

    // Update client project counts
    await this.updateClientProjectCounts(project.clientId);

    // Audit log
    await this.auditService.log({
      userId: userId || 'system',
      organizationId: project.organizationId,
      action: 'DELETE_PROJECT',
      details: {
        projectId: id,
        projectName: project.name,
        clientId: project.clientId,
        clientName: project.client?.name,
        contractedValue: project.contractedValue,
      },
    });

    return { message: 'Project deleted successfully' };
  }

  // ============================================================
  // Bulk Operations
  // ============================================================

  async bulkUpdate(
    ids: string[],
    data: { status?: string },
    userId: string,
    organizationId: string,
  ) {
    if (!ids || ids.length === 0) return { updated: 0 };

    // Verify ALL ids belong to this org before mutation
    const owned = await this.prisma.project.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true },
    });

    const ownedIds = owned.map((p) => p.id);
    if (ownedIds.length !== ids.length) {
      const missing = ids.filter((id) => !ownedIds.includes(id));
      throw new Error(`Projects not found or unauthorized: ${missing.join(', ')}`);
    }

    await this.prisma.project.updateMany({
      where: { id: { in: ownedIds }, organizationId },
      data,
    });

    await this.auditService.log({
      userId,
      organizationId,
      action: 'BULK_UPDATE_PROJECTS',
      details: { ids: ownedIds, updates: data, count: ownedIds.length },
    });

    return { updated: ownedIds.length };
  }

  async bulkDelete(ids: string[], userId: string, organizationId: string) {
    if (!ids || ids.length === 0) return { deleted: 0 };

    // Verify ALL ids belong to this org before deletion
    const owned = await this.prisma.project.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, clientId: true },
    });

    const ownedIds = owned.map((p) => p.id);
    if (ownedIds.length !== ids.length) {
      const missing = ids.filter((id) => !ownedIds.includes(id));
      throw new Error(`Projects not found or unauthorized: ${missing.join(', ')}`);
    }

    await this.prisma.project.updateMany({
      where: { id: { in: ownedIds }, organizationId },
      data: { deletedAt: new Date() },
    });

    // Update client project counts for affected clients
    const uniqueClientIds = [...new Set(owned.map((p) => p.clientId))];
    for (const clientId of uniqueClientIds) {
      await this.updateClientProjectCounts(clientId);
    }

    await this.auditService.log({
      userId,
      organizationId,
      action: 'BULK_DELETE_PROJECTS',
      details: { ids: ownedIds, count: ownedIds.length },
    });

    return { deleted: ownedIds.length };
  }

  /**
   * Convert a won lead to a project (org-scoped)
   */
  async convertLead(
    leadId: string,
    clientId: string,
    projectManagerId: string | undefined,
    userId: string | undefined,
    organizationId: string,
  ) {
    // Verify lead exists and is Won (org-scoped)
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    if (lead.stage !== 'Won') {
      throw new BadRequestException(
        'Only Won leads can be converted to projects',
      );
    }

    // Verify client exists (org-scoped)
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId },
    });

    if (!client) {
      throw new NotFoundException(
        `Client with ID ${clientId} not found`,
      );
    }

    // Check if project already exists for this lead
    const existingProject = await this.prisma.project.findFirst({
      where: { leadId, organizationId },
    });

    if (existingProject) {
      throw new BadRequestException(
        'A project already exists for this lead',
      );
    }

    // Create project from lead
    const project = await this.prisma.project.create({
      data: {
        name: `${lead.company} - ${lead.projectName || 'Project'}`,
        clientId,
        leadId,
        status: 'Planning',
        contractedValue: lead.contractedValue ?? lead.expectedValue,
        description: lead.notes || undefined,
        projectManagerId:
          projectManagerId || lead.assignedToId || undefined,
        organizationId: lead.organizationId,
      },
      include: this.projectInclude,
    });

    // Update lead to mark it as converted
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { convertedToClientId: clientId },
    });

    // Update client project counts
    await this.updateClientProjectCounts(clientId);

    // Record initial status in history
    if (userId) {
      await this.prisma.projectStatusHistory.create({
        data: {
          projectId: project.id,
          fromStatus: null,
          toStatus: project.status,
          changedBy: userId,
          organizationId: project.organizationId,
        },
      });
    }

    return project;
  }

  // --- Project Assignments ---

  async getAssignments(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return this.prisma.projectAssignment.findMany({
      where: { projectId, organizationId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAssignment(
    projectId: string,
    dto: CreateProjectAssignmentDto,
    organizationId: string,
    actor?: { id: string; name: string },
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const assignment = await this.prisma.projectAssignment.upsert({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      update: { role: dto.role },
      create: {
        projectId,
        userId: dto.userId,
        organizationId,
        role: dto.role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Fire-and-forget email — don't block the response
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const assignedByName = actor?.name ?? 'A team member';
    this.emailService.sendAssignmentNotificationEmail({
      to: assignment.user.email,
      userName: assignment.user.name,
      role: dto.role ?? 'Team Member',
      entityType: 'project',
      entityName: project.name,
      entityUrl: `${frontendUrl}/projects`,
      assignedByName,
    }).catch(() => { /* non-critical */ });

    return assignment;
  }

  async updateAssignment(
    projectId: string,
    assignmentId: string,
    role: string,
    organizationId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const assignment = await this.prisma.projectAssignment.findFirst({
      where: { id: assignmentId, projectId, organizationId },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return this.prisma.projectAssignment.update({
      where: { id: assignmentId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async removeAssignment(
    projectId: string,
    assignmentId: string,
    organizationId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const assignment = await this.prisma.projectAssignment.findFirst({
      where: { id: assignmentId, projectId, organizationId },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.projectAssignment.delete({ where: { id: assignmentId } });
    return { message: 'Assignment removed successfully' };
  }

  private async updateClientProjectCounts(clientId: string) {
    const projects = await this.prisma.project.findMany({
      where: { clientId },
    });

    const totalProjectCount = projects.length;
    const activeProjectCount = projects.filter(
      (p) => p.status === 'Active' || p.status === 'Planning',
    ).length;

    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        totalProjectCount,
        activeProjectCount,
      },
    });
  }
}
