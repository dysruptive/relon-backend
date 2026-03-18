import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, data: { name?: string; industry?: string; size?: string; country?: string; currency?: string; logo?: string; timezone?: string }) {
    return this.prisma.organization.update({ where: { id }, data });
  }

  async uploadLogo(organizationId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_SIZE) {
      throw new ForbiddenException('Logo file must be under 2 MB');
    }
    const base64 = file.buffer.toString('base64');
    const logoValue = `data:${file.mimetype};base64,${base64}`;
    await this.prisma.organization.update({ where: { id: organizationId }, data: { logo: logoValue } });
    return { logo: logoValue };
  }

  async seedDemoData(organizationId: string, userId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    // Idempotent guard — uses dedicated flag so organic lead creation doesn't block demo seed
    if (org.demoDataSeeded) {
      return { leads: 0, clients: 0, projects: 0, activities: 0, skipped: true };
    }

    // CEO-role guard
    const requestingUser = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!requestingUser || requestingUser.role !== 'CEO') {
      throw new ForbiddenException('Only the account owner can seed demo data');
    }

    const now = new Date();
    const activityDate = now;
    const activityTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // 2 demo clients
      const clientA = await tx.client.create({
        data: {
          name: 'Greenfield Developments',
          email: 'contact@greenfield.example',
          phone: '+1-555-0101',
          segment: 'SMB',
          industry: 'Construction',
          organizationId,
        },
      });
      const clientB = await tx.client.create({
        data: {
          name: 'Apex Engineering Group',
          email: 'info@apexeng.example',
          phone: '+1-555-0202',
          segment: 'Mid-Market',
          industry: 'Engineering',
          organizationId,
        },
      });

      // 5 demo leads
      const LEAD_STAGES = ['New', 'Contacted', 'Quoted', 'Negotiation', 'New'] as const;
      const leadData = [
        { company: 'Horizon Properties', contactName: 'Sarah Mitchell', expectedValue: 85000, stage: LEAD_STAGES[0] },
        { company: 'Summit Builders', contactName: 'James Osei', expectedValue: 142000, stage: LEAD_STAGES[1] },
        { company: 'Crestview Corp', contactName: 'Amara Diallo', expectedValue: 37500, stage: LEAD_STAGES[2] },
        { company: 'BlueSky Projects', contactName: 'Tom Nakamura', expectedValue: 220000, stage: LEAD_STAGES[3] },
        { company: 'Urban Foundations', contactName: 'Priya Sharma', expectedValue: 95000, stage: LEAD_STAGES[4] },
      ];
      const leads = await Promise.all(
        leadData.map((ld) =>
          tx.lead.create({
            data: {
              company: ld.company,
              contactName: ld.contactName,
              expectedValue: ld.expectedValue,
              stage: ld.stage,
              urgency: 'Medium',
              organizationId,
            },
          }),
        ),
      );

      // 2 demo projects (linked to clients)
      const projectA = await tx.project.create({
        data: {
          name: 'Greenfield Phase 1 Renovation',
          status: 'Active',
          contractedValue: 85000,
          clientId: clientA.id,
          organizationId,
        },
      });
      const projectB = await tx.project.create({
        data: {
          name: 'Apex HQ Expansion',
          status: 'Planning',
          contractedValue: 142000,
          clientId: clientB.id,
          organizationId,
        },
      });

      // 4 demo activities (type must be 'call' or 'meeting')
      await tx.activity.create({
        data: {
          type: 'call',
          activityDate,
          activityTime,
          reason: 'Discovery call completed. Client interested in Q3 start.',
          leadId: leads[0].id,
          userId,
          organizationId,
        },
      });
      await tx.activity.create({
        data: {
          type: 'call',
          activityDate,
          activityTime,
          reason: 'Follow-up call — sent proposal PDF and timeline document.',
          leadId: leads[1].id,
          userId,
          organizationId,
        },
      });
      await tx.activity.create({
        data: {
          type: 'meeting',
          activityDate,
          activityTime,
          reason: 'Kickoff meeting scheduled. Awaiting contract sign-off.',
          meetingType: 'in-person',
          clientId: clientA.id,
          userId,
          organizationId,
        },
      });
      await tx.activity.create({
        data: {
          type: 'call',
          activityDate,
          activityTime,
          reason: 'Follow-up call to discuss revised scope and budget.',
          clientId: clientB.id,
          userId,
          organizationId,
        },
      });

      return { leads: leads.length, clients: 2, projects: 2, activities: 4, _projectA: projectA.id, _projectB: projectB.id };
    });

    await Promise.all([
      this.updateOnboarding(organizationId, 'addedLead'),
      this.prisma.organization.update({ where: { id: organizationId }, data: { demoDataSeeded: true } }),
    ]);

    return { leads: result.leads, clients: result.clients, projects: result.projects, activities: result.activities };
  }

  async updateOnboarding(id: string, step: 'addedLead' | 'invitedTeam' | 'setPipeline' | 'completed') {
    const fieldMap: Record<string, object> = {
      addedLead:   { onboardingAddedLead: true },
      invitedTeam: { onboardingInvitedTeam: true },
      setPipeline: { onboardingSetPipeline: true },
      completed:   { onboardingCompleted: true },
    };
    const data = fieldMap[step];
    if (!data) return;
    return this.prisma.organization.update({ where: { id }, data });
  }

  async getStats(organizationId: string) {
    const [userCount, leadCount, clientCount, projectCount] = await Promise.all([
      this.prisma.user.count({ where: { organizationId } }),
      this.prisma.lead.count({ where: { organizationId } }),
      this.prisma.client.count({ where: { organizationId } }),
      this.prisma.project.count({ where: { organizationId } }),
    ]);
    return { userCount, leadCount, clientCount, projectCount };
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    return slug;
  }
}
