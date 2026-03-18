import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgPlan, OrgPlanStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PLAN_LIMITS, getPlanMeta } from './plans';
import axios from 'axios';

@Injectable()
export class PaystackBillingService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {
    this.secretKey = this.config.get('PAYSTACK_SECRET_KEY') || '';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async paystackGet<T>(path: string): Promise<T> {
    const res = await axios.get(`${this.baseUrl}${path}`, { headers: this.headers });
    return res.data.data;
  }

  private async paystackPost<T>(path: string, body: object): Promise<T> {
    const res = await axios.post(`${this.baseUrl}${path}`, body, { headers: this.headers });
    return res.data.data;
  }

  // Determine the Paystack plan code from env vars based on plan + currency
  private getPlanCode(planId: string, currency: string): string {
    const key = `PAYSTACK_PLAN_CODE_${planId.toUpperCase()}_${currency.toUpperCase()}`;
    const code = this.config.get(key);
    if (!code) throw new BadRequestException(`No Paystack plan configured for ${planId} (${currency}). Set ${key} env var.`);
    return code;
  }

  async getOrCreateCustomer(org: any, userEmail: string): Promise<string> {
    if (org.paystackCustomerId) return org.paystackCustomerId;

    const customer: any = await this.paystackPost('/customer', {
      email: userEmail,
      first_name: org.name,
      metadata: { organizationId: org.id },
    });

    await this.prisma.organization.update({
      where: { id: org.id },
      data: { paystackCustomerId: customer.customer_code },
    });
    return customer.customer_code;
  }

  async createCheckoutSession(organizationId: string, planId: string, userId: string): Promise<{ url: string }> {
    if (planId === 'trial') throw new BadRequestException('Cannot checkout for this plan');

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const currency = org.currency || 'GHS';
    const planMeta = getPlanMeta(currency);
    const meta = planMeta[planId as keyof typeof planMeta];
    if (!meta) throw new BadRequestException(`Invalid plan: ${planId}`);

    const planCode = this.getPlanCode(planId, currency);
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) throw new NotFoundException('User not found');

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';

    // Paystack initialize transaction with plan (creates subscription on success)
    const result: any = await this.paystackPost('/transaction/initialize', {
      email: user.email,
      amount: meta.price * 100, // convert to pesewas/kobo
      currency,
      plan: planCode,
      callback_url: `${frontendUrl}/billing?success=true`,
      metadata: {
        organizationId,
        planId,
        cancel_action: `${frontendUrl}/billing?cancelled=true`,
      },
    });

    return { url: result.authorization_url };
  }

  async createPortalSession(organizationId: string): Promise<{ url: string; instructions: string }> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org?.paystackCustomerId) {
      throw new BadRequestException('No billing account found. Please subscribe first.');
    }
    // Paystack doesn't have a hosted portal like Stripe.
    // Direct customers to Paystack's customer portal with their email.
    return {
      url: `https://paystack.com/manage`,
      instructions: 'You will be redirected to Paystack to manage your subscription. Use the email address associated with your account.',
    };
  }

  async cancelSubscription(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org?.paystackSubscriptionCode) throw new BadRequestException('No active subscription found.');

    // Get subscription to get email_token needed for disable
    const sub: any = await this.paystackGet(`/subscription/${org.paystackSubscriptionCode}`);
    await this.paystackPost('/subscription/disable', {
      code: org.paystackSubscriptionCode,
      token: sub.email_token,
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan: OrgPlan.trial, planStatus: OrgPlanStatus.cancelled, paystackSubscriptionCode: null },
    });
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const secret = this.config.get('PAYSTACK_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('Paystack webhook secret is not configured');
    }
    // Verify Paystack webhook signature (HMAC-SHA512)
    const crypto = await import('crypto');
    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    if (hash !== signature) {
      throw new BadRequestException('Invalid Paystack webhook signature');
    }

    const event = JSON.parse(payload.toString());
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'subscription.create': {
        // data.customer.metadata.organizationId, data.plan.plan_code, data.subscription_code
        const orgId = data.customer?.metadata?.organizationId;
        const planCode = data.plan?.plan_code;
        if (!orgId) break;

        // Match plan code back to plan ID
        const planId = await this.resolvePlanIdFromCode(planCode);
        const resolvedPlan = (planId || 'starter') as OrgPlan;

        await this.prisma.organization.update({
          where: { id: orgId },
          data: {
            plan: resolvedPlan,
            planStatus: OrgPlanStatus.active,
            paystackSubscriptionCode: data.subscription_code,
          },
        });

        // Send payment confirmation email (FIX-14)
        const ceoSub = await this.prisma.user.findFirst({
          where: { organizationId: orgId, role: 'CEO' },
        });
        if (ceoSub) {
          const planName = resolvedPlan.charAt(0).toUpperCase() + resolvedPlan.slice(1);
          await this.emailService.sendPaymentConfirmationEmail(
            ceoSub.email,
            ceoSub.name || ceoSub.email,
            planName,
            '—',
            data.plan?.currency?.toUpperCase() ?? 'GHS',
          ).catch(() => {});
        }
        break;
      }

      case 'subscription.disable': {
        const orgId = data.customer?.metadata?.organizationId;
        if (!orgId) break;
        await this.prisma.organization.update({
          where: { id: orgId },
          data: { plan: OrgPlan.trial, planStatus: OrgPlanStatus.cancelled, paystackSubscriptionCode: null },
        });
        break;
      }

      case 'invoice.update': {
        if (data.status === 'failed') {
          const orgId = data.customer?.metadata?.organizationId;
          if (!orgId) break;
          await this.prisma.organization.update({
            where: { id: orgId },
            data: { planStatus: OrgPlanStatus.past_due, pastDueSince: new Date() },
          });
          // Send payment failure email (FIX-15)
          const ceoFail = await this.prisma.user.findFirst({
            where: { organizationId: orgId, role: 'CEO' },
          });
          if (ceoFail) {
            await this.emailService.sendPaymentFailedEmail(
              ceoFail.email,
              ceoFail.name || ceoFail.email,
            ).catch(() => {});
          }
        }
        break;
      }

      case 'charge.success': {
        // After a subscription payment succeeds, reactivate if past_due
        const orgId = data.metadata?.organizationId;
        if (orgId) {
          const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
          if (org?.planStatus === OrgPlanStatus.past_due || org?.planStatus === OrgPlanStatus.suspended) {
            await this.prisma.organization.update({
              where: { id: orgId },
              data: { planStatus: OrgPlanStatus.active, pastDueSince: null },
            });
            // Send reactivation email (FIX-16)
            const ceoReact = await this.prisma.user.findFirst({
              where: { organizationId: orgId, role: 'CEO' },
            });
            if (ceoReact) {
              const planName = org.plan.charAt(0).toUpperCase() + org.plan.slice(1);
              await this.emailService.sendReactivationEmail(
                ceoReact.email,
                ceoReact.name || ceoReact.email,
                planName,
              ).catch(() => {});
            }
          }
        }
        break;
      }
    }
  }

  private async resolvePlanIdFromCode(planCode: string): Promise<string | null> {
    // Check env vars for matching plan code
    for (const planId of ['starter', 'growth', 'scale']) {
      for (const currency of ['GHS', 'NGN', 'KES', 'ZAR']) {
        const key = `PAYSTACK_PLAN_CODE_${planId.toUpperCase()}_${currency}`;
        if (this.config.get(key) === planCode) return planId;
      }
    }
    return null;
  }
}
