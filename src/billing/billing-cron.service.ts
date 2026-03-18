import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrgPlanStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Runs daily at 1am UTC.
   * 1. Locks orgs whose trial has expired (sets planStatus to 'expired').
   * 2. Sends a 3-day warning email to orgs whose trial expires within 3 days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleTrialExpiry() {
    this.logger.log('Running trial expiry check...');

    // ── 1. Expire trials that have ended ────────────────────────────────────
    const expiredOrgs = await this.prisma.organization.findMany({
      where: {
        plan: 'trial',
        planStatus: OrgPlanStatus.active,
        trialEndsAt: { lt: new Date() },
      },
      select: { id: true },
    });

    if (expiredOrgs.length > 0) {
      await this.prisma.organization.updateMany({
        where: { id: { in: expiredOrgs.map(o => o.id) } },
        data: { planStatus: OrgPlanStatus.expired },
      });
      this.logger.log(`Expired ${expiredOrgs.length} trial organization(s).`);
    }

    // ── 2. 3-day warning emails ──────────────────────────────────────────────
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringOrgs = await this.prisma.organization.findMany({
      where: {
        plan: 'trial',
        planStatus: OrgPlanStatus.active,
        trialEndsAt: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      select: { id: true, trialEndsAt: true },
    });

    for (const org of expiringOrgs) {
      const daysLeft = org.trialEndsAt
        ? Math.max(1, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86400000))
        : 1;

      const ceo = await this.prisma.user.findFirst({
        where: { organizationId: org.id, role: 'CEO' },
        select: { email: true, name: true },
      });

      if (ceo) {
        await this.emailService
          .sendTrialExpiringEmail(ceo.email, ceo.name || ceo.email, daysLeft)
          .catch(err => this.logger.error(`Failed to send trial expiry warning to ${ceo.email}:`, err));
      }
    }

    if (expiringOrgs.length > 0) {
      this.logger.log(`Sent trial expiry warnings for ${expiringOrgs.length} organization(s).`);
    }
  }

  /**
   * Runs daily at 9am UTC.
   * Sends onboarding drip emails at day 1, 3, and 7 of the trial.
   */
  @Cron('0 9 * * *') // 9:00 AM UTC
  async runOnboardingDrip() {
    this.logger.log('Running onboarding drip...');
    const now = new Date();

    const trialOrgs = await this.prisma.organization.findMany({
      where: {
        plan: 'trial',
        planStatus: OrgPlanStatus.active,
        trialEndsAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        trialEndsAt: true,
        emailSentDay1: true,
        emailSentDay3: true,
        emailSentDay7: true,
      },
    });

    for (const org of trialOrgs) {
      if (!org.trialEndsAt) continue;
      const daysLeft = Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86400000);
      const daysSinceStart = 14 - daysLeft;

      const ceo = await this.prisma.user.findFirst({
        where: { organizationId: org.id, role: 'CEO' },
        select: { email: true, name: true },
      });
      if (!ceo) continue;

      const name = ceo.name || ceo.email;

      if (daysSinceStart >= 1 && daysSinceStart < 2 && !org.emailSentDay1) {
        await this.emailService.sendOnboardingDripDay1(ceo.email, name, org.name).catch(() => {});
        await this.prisma.organization.update({ where: { id: org.id }, data: { emailSentDay1: true } });
      } else if (daysSinceStart >= 3 && daysSinceStart < 4 && !org.emailSentDay3) {
        await this.emailService.sendOnboardingDripDay3(ceo.email, name, org.name).catch(() => {});
        await this.prisma.organization.update({ where: { id: org.id }, data: { emailSentDay3: true } });
      } else if (daysSinceStart >= 7 && daysSinceStart < 8 && !org.emailSentDay7) {
        await this.emailService.sendOnboardingDripDay7(ceo.email, name).catch(() => {});
        await this.prisma.organization.update({ where: { id: org.id }, data: { emailSentDay7: true } });
      }
    }
  }

  /**
   * Runs daily at 2am UTC.
   * Escalating dunning sequence for past_due orgs based on pastDueSince:
   *   Day 1  → already sent by the invoice.payment_failed webhook handler
   *   Day 3  → reminder email
   *   Day 5  → urgent email (service at risk)
   *   Day 7  → final warning + suspend if still unpaid
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDunningSequence() {
    this.logger.log('Running dunning sequence...');

    const now = new Date();
    const pastDueOrgs = await this.prisma.organization.findMany({
      where: { planStatus: 'past_due', pastDueSince: { not: null } },
      select: { id: true, pastDueSince: true },
    });

    for (const org of pastDueOrgs) {
      if (!org.pastDueSince) continue;
      const daysPastDue = Math.floor(
        (now.getTime() - org.pastDueSince.getTime()) / (1000 * 60 * 60 * 24),
      );

      const ceo = await this.prisma.user.findFirst({
        where: { organizationId: org.id, role: 'CEO' },
        select: { email: true, name: true },
      });
      if (!ceo) continue;

      const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;
      const name = ceo.name || ceo.email;

      if (daysPastDue === 3) {
        await this.emailService
          .sendPaymentReminderEmail(ceo.email, name, 4, billingUrl)
          .catch(err => this.logger.error(`Dunning day-3 failed for ${ceo.email}:`, err));
      } else if (daysPastDue === 5) {
        await this.emailService
          .sendPaymentReminderEmail(ceo.email, name, 2, billingUrl)
          .catch(err => this.logger.error(`Dunning day-5 failed for ${ceo.email}:`, err));
      } else if (daysPastDue >= 7) {
        // Suspend the org
        await this.prisma.organization.update({
          where: { id: org.id },
          data: { planStatus: OrgPlanStatus.suspended },
        });
        await this.emailService
          .sendPaymentFinalEmail(ceo.email, name, billingUrl)
          .catch(err => this.logger.error(`Dunning final email failed for ${ceo.email}:`, err));
        this.logger.warn(`Suspended org ${org.id} after ${daysPastDue} days past_due.`);
      }
    }
  }
}
