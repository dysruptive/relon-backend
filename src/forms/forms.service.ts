import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { LeadStage } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeadFormDto } from './dto/create-lead-form.dto';
import { UpdateLeadFormDto } from './dto/update-lead-form.dto';
import { SubmitFormDto } from './dto/submit-form.dto';
import { FormFieldDto } from './dto/form-field.dto';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.leadForm.findMany({
      where: { organizationId },
      include: {
        assignTo: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const form = await this.prisma.leadForm.findFirst({
      where: { id, organizationId },
      include: {
        assignTo: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID "${id}" not found`);
    }

    return form;
  }

  /**
   * Public endpoint — resolves org from apiKey only (no JWT needed).
   * Returns only the form schema fields, no org data.
   */
  async findPublic(apiKey: string) {
    const form = await this.prisma.leadForm.findFirst({
      where: { apiKey, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        fields: true,
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found or is no longer active');
    }

    return form;
  }

  async create(dto: CreateLeadFormDto, organizationId: string) {
    await this.validateTargetStage(dto.targetStage, organizationId);

    if (dto.assignToUserId) {
      await this.validateUser(dto.assignToUserId, organizationId);
    }

    return this.prisma.leadForm.create({
      data: {
        name: dto.name,
        description: dto.description,
        fields: dto.fields as unknown as object[],
        targetStage: dto.targetStage,
        assignToUserId: dto.assignToUserId,
        isActive: dto.isActive ?? true,
        organizationId,
      },
      include: {
        assignTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateLeadFormDto, organizationId: string) {
    await this.findOne(id, organizationId);

    if (dto.targetStage) {
      await this.validateTargetStage(dto.targetStage, organizationId);
    }

    if (dto.assignToUserId) {
      await this.validateUser(dto.assignToUserId, organizationId);
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.fields !== undefined) updateData.fields = dto.fields as unknown as object[];
    if (dto.targetStage !== undefined) updateData.targetStage = dto.targetStage;
    if (dto.assignToUserId !== undefined) updateData.assignToUserId = dto.assignToUserId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.prisma.leadForm.update({
      where: { id },
      data: updateData,
      include: {
        assignTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.leadForm.delete({ where: { id } });
  }

  /**
   * Public form submission — resolves organizationId from apiKey, NOT from JWT.
   */
  async submit(apiKey: string, dto: SubmitFormDto, ipAddress?: string) {
    // 1. Find active form by apiKey — org is resolved from this record
    const form = await this.prisma.leadForm.findFirst({
      where: { apiKey, isActive: true },
    });

    if (!form) {
      throw new NotFoundException('Form not found or is no longer active');
    }

    const organizationId = form.organizationId;

    // 2. Validate required fields based on form schema
    const fieldDefinitions = form.fields as unknown as FormFieldDto[];
    const missingFields: string[] = [];

    for (const fieldDef of fieldDefinitions) {
      if (fieldDef.required && !dto.data[fieldDef.key]) {
        missingFields.push(fieldDef.label || fieldDef.key);
      }
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missingFields.join(', ')}`,
      );
    }

    // 3. Extract lead fields from submitted data
    const submittedData = dto.data;
    const contactName = submittedData['contactName'] || submittedData['name'] || '';

    if (!contactName) {
      throw new BadRequestException('contactName is required');
    }

    const company = submittedData['company'] || contactName;
    const email = submittedData['email'];
    const phone = submittedData['phone'];
    const notes = submittedData['notes'];
    const projectName = submittedData['projectName'];

    // 4 + 5. Create Lead + Submission atomically
    const { lead, submission } = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          contactName,
          company,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          projectName: projectName || null,
          stage: form.targetStage as LeadStage,
          assignedToId: form.assignToUserId || null,
          source: 'Web Form',
          channel: 'Website',
          expectedValue: 0,
          urgency: 'Medium',
          organizationId,
        },
      });

      const submission = await tx.leadFormSubmission.create({
        data: {
          formId: form.id,
          leadId: lead.id,
          data: submittedData as unknown as object,
          ipAddress: ipAddress || null,
          organizationId,
        },
      });

      await tx.leadForm.update({
        where: { id: form.id },
        data: { submissionsCount: { increment: 1 } },
      });

      return { lead, submission };
    });

    this.logger.log(
      `Form submission created: formId=${form.id}, leadId=${lead.id}, submissionId=${submission.id}`,
    );

    // 6. Send notification to assigned user if applicable
    if (form.assignToUserId) {
      try {
        const pref = await this.notificationsService.getPreferences(form.assignToUserId);
        if (pref.taskAssigned) {
          await this.notificationsService.create({
            userId: form.assignToUserId,
            organizationId,
            type: 'FORM_SUBMISSION',
            title: 'New lead from web form',
            message: `${contactName} submitted "${form.name}"`,
            entityType: 'LEAD',
            entityId: lead.id,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to send form submission notification: ${(err as Error).message}`,
        );
      }
    }

    return lead;
  }

  async getSubmissions(formId: string, organizationId: string) {
    await this.findOne(formId, organizationId);
    return this.prisma.leadFormSubmission.findMany({
      where: { formId, organizationId },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    });
  }

  async getAnalytics(id: string, organizationId: string) {
    const form = await this.findOne(id, organizationId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissions = await this.prisma.leadFormSubmission.findMany({
      where: {
        formId: form.id,
        organizationId,
        submittedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        leadId: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    const totalSubmissions = submissions.length;
    const leadIds = submissions
      .map((s) => s.leadId)
      .filter((id): id is string => id !== null);
    const totalLeads = leadIds.length;

    let wonLeads = 0;
    if (leadIds.length > 0) {
      wonLeads = await this.prisma.lead.count({
        where: { id: { in: leadIds }, organizationId, stage: 'Won' },
      });
    }

    const conversionRate =
      totalSubmissions > 0
        ? Math.round((wonLeads / totalSubmissions) * 100)
        : 0;

    const dailyMap = new Map<string, number>();
    for (const submission of submissions) {
      const dateKey = submission.submittedAt.toISOString().slice(0, 10);
      dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1);
    }

    const dailySubmissions = Array.from(dailyMap.entries()).map(
      ([date, count]) => ({ date, count }),
    );

    return {
      totalSubmissions,
      totalLeads,
      wonLeads,
      conversionRate,
      dailySubmissions,
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async validateTargetStage(stage: string, organizationId: string): Promise<void> {
    const exists = await this.prisma.pipelineStage.findFirst({
      where: { name: stage, pipelineType: 'prospective_project', organizationId },
    });
    if (!exists) {
      throw new BadRequestException(
        `Stage "${stage}" does not exist in the prospective project pipeline`,
      );
    }
  }

  private async validateUser(userId: string, organizationId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user) {
      throw new BadRequestException(`User with ID "${userId}" not found`);
    }
  }
}
