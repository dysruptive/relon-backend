import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrgPlan, OrgPlanStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PLAN_LIMITS, PLAN_META, getPlanMeta, PAYSTACK_COUNTRIES } from './plans';
import { PaystackBillingService } from './paystack-billing.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private paystackService: PaystackBillingService,
    private emailService: EmailService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2026-01-28.clover',
    });
  }

  private isPaystackOrg(country: string | null | undefined): boolean {
    return !!country && country.toUpperCase() in PAYSTACK_COUNTRIES;
  }

  getPlans(currency = 'USD') {
    const meta = getPlanMeta(currency);
    return Object.entries(meta).map(([key, m]) => ({
      id: key,
      ...m,
      limits: PLAN_LIMITS[key as keyof typeof PLAN_LIMITS],
      priceId: this.config.get(`STRIPE_PRICE_ID_${key.toUpperCase()}`),
    }));
  }

  async getCurrentPlan(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    const limits = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.trial;
    const meta = PLAN_META[org.plan as keyof typeof PLAN_META] || PLAN_META.trial;

    // Compute current usage
    const [userCount, leadCount] = await Promise.all([
      this.prisma.user.count({ where: { organizationId } }),
      this.prisma.lead.count({ where: { organizationId } }),
    ]);

    const trialDaysLeft = org.trialEndsAt
      ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - Date.now()) / 86400000))
      : null;

    const daysPastDue = org.pastDueSince
      ? Math.floor((Date.now() - new Date(org.pastDueSince).getTime()) / 86400000)
      : null;

    return {
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
      trialDaysLeft,
      meta,
      limits,
      usage: { userCount, leadCount },
      stripeCustomerId: org.stripeCustomerId,
      hasStripeSubscription: !!org.stripeSubscriptionId,
      country: org.country,
      currency: org.currency || 'USD',
      provider: this.isPaystackOrg(org.country) ? 'paystack' : 'stripe',
      hasPaystackSubscription: !!org.paystackSubscriptionCode,
      daysPastDue,
    };
  }

  async createCheckoutSession(organizationId: string, planId: string, userId: string, interval: 'month' | 'year' = 'month') {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (this.isPaystackOrg(org.country)) {
      return this.paystackService.createCheckoutSession(organizationId, planId, userId);
    }

    // Stripe path
    if (planId === 'trial' || planId === 'free') {
      throw new BadRequestException('Cannot checkout for this plan');
    }

    const annualPriceId = interval === 'year'
      ? this.config.get(`STRIPE_PRICE_ID_${planId.toUpperCase()}_ANNUAL`)
      : null;
    const priceId = annualPriceId || this.config.get(`STRIPE_PRICE_ID_${planId.toUpperCase()}`);
    if (!priceId) throw new BadRequestException(`No Stripe price configured for plan: ${planId}`);

    // Get or create Stripe customer
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
      const customer = await this.stripe.customers.create({
        email: user?.email,
        name: org.name,
        metadata: { organizationId },
      });
      customerId = customer.id;
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    // If org already has an active subscription, update it instead of creating a new one
    // (prevents double-billing on plan changes)
    if (org.stripeSubscriptionId) {
      return this.updateExistingSubscription(org.stripeSubscriptionId, planId, priceId, organizationId);
    }

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/billing/success?plan=${planId}`,
      cancel_url: `${frontendUrl}/billing?cancelled=true`,
      metadata: { organizationId, planId },
      subscription_data: { metadata: { organizationId, planId } },
    });

    return { url: session.url };
  }

  private async updateExistingSubscription(
    subscriptionId: string,
    planId: string,
    priceId: string,
    organizationId: string,
  ) {
    // Retrieve the subscription to find the current item ID
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const itemId = subscription.items.data[0]?.id;

    if (!itemId) {
      throw new BadRequestException('Could not find subscription item to update.');
    }

    // Update the subscription with proration
    await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
      metadata: { organizationId, planId },
    });

    // Update local plan immediately (webhook will also update, this is for fast UI feedback)
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan: planId as OrgPlan },
    });

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    return { url: `${frontendUrl}/billing/success?plan=${planId}`, upgraded: true };
  }

  async createPortalSession(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (this.isPaystackOrg(org.country)) {
      return this.paystackService.createPortalSession(organizationId);
    }

    // Stripe path
    if (!org.stripeCustomerId) throw new BadRequestException('No billing account found. Please subscribe first.');

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${frontendUrl}/billing`,
    });
    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { organizationId, planId } = session.metadata || {};
        if (organizationId && planId) {
          await this.prisma.organization.update({
            where: { id: organizationId },
            data: {
              plan: planId as OrgPlan,
              planStatus: OrgPlanStatus.active,
              stripeSubscriptionId: session.subscription as string,
            },
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const { organizationId, planId } = sub.metadata || {};
        if (organizationId) {
          const newStatus: OrgPlanStatus = sub.status === 'active' ? OrgPlanStatus.active
            : sub.status === 'trialing' ? OrgPlanStatus.trialing
            : sub.status === 'past_due' ? OrgPlanStatus.past_due
            : sub.status === 'canceled' ? OrgPlanStatus.cancelled
            : sub.status === 'unpaid' ? OrgPlanStatus.suspended
            : sub.status === 'incomplete' ? OrgPlanStatus.past_due
            : sub.status === 'incomplete_expired' ? OrgPlanStatus.cancelled
            : OrgPlanStatus.suspended;

          // Track when org first went past_due (for grace period enforcement)
          const existingOrg = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { planStatus: true, pastDueSince: true },
          });
          const pastDueSince =
            newStatus === OrgPlanStatus.past_due && existingOrg?.planStatus !== OrgPlanStatus.past_due
              ? new Date()
              : newStatus !== OrgPlanStatus.past_due
              ? null
              : existingOrg?.pastDueSince;

          // Record period end for access-until-period-end on cancellation
          const subAny = sub as any;
          const currentPeriodEnd = subAny.current_period_end
            ? new Date(subAny.current_period_end * 1000)
            : undefined;

          await this.prisma.organization.update({
            where: { id: organizationId },
            data: {
              plan: planId ? (planId as OrgPlan) : undefined,
              planStatus: newStatus,
              pastDueSince,
              ...(currentPeriodEnd !== undefined ? { currentPeriodEnd } : {}),
            },
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const { organizationId } = sub.metadata || {};
        if (organizationId) {
          await this.prisma.organization.update({
            where: { id: organizationId },
            data: { plan: OrgPlan.trial, planStatus: OrgPlanStatus.cancelled, stripeSubscriptionId: null },
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const org = await this.prisma.organization.findFirst({ where: { stripeCustomerId: customerId } });
        if (org) {
          await this.prisma.organization.update({
            where: { id: org.id },
            data: { planStatus: OrgPlanStatus.past_due },
          });
          // Notify the CEO
          const ceo = await this.prisma.user.findFirst({
            where: { organizationId: org.id, role: 'CEO' },
          });
          if (ceo) {
            await this.emailService.sendPaymentFailedEmail(ceo.email, ceo.name || ceo.email).catch(() => {});
          }
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const org = await this.prisma.organization.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (org) {
          const wasInactive = org.planStatus === OrgPlanStatus.past_due || org.planStatus === OrgPlanStatus.suspended;
          if (wasInactive) {
            await this.prisma.organization.update({
              where: { id: org.id },
              data: { planStatus: OrgPlanStatus.active, pastDueSince: null },
            });
          }

          const ceo = await this.prisma.user.findFirst({
            where: { organizationId: org.id, role: 'CEO' },
          });
          if (ceo) {
            if (wasInactive) {
              await this.emailService.sendReactivationEmail(ceo.email, ceo.name || ceo.email, org.plan).catch(() => {});
            } else {
              const amount = invoice.amount_paid ? `${(invoice.amount_paid / 100).toFixed(2)}` : '—';
              const currency = (invoice.currency ?? 'USD').toUpperCase();
              const nextDate = invoice.period_end
                ? new Date(invoice.period_end * 1000).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
                : undefined;
              await this.emailService.sendPaymentConfirmationEmail(
                ceo.email,
                ceo.name || ceo.email,
                org.plan.charAt(0).toUpperCase() + org.plan.slice(1),
                amount,
                currency,
                nextDate,
              ).catch(() => {});
            }
          }
        }
        break;
      }
    }
  }

  async cancelSubscription(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (this.isPaystackOrg(org.country)) {
      // Paystack subscriptions are managed via their portal
      throw new BadRequestException('Use the Paystack portal to manage your subscription.');
    }

    // Stripe: cancel at period end
    if (!org.stripeSubscriptionId) throw new BadRequestException('No active subscription found.');
    await this.stripe.subscriptions.update(org.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await this.prisma.organization.update({
      where: { id: org.id },
      data: { planStatus: OrgPlanStatus.cancelling },
    });
    // Notify the CEO
    const ceo = await this.prisma.user.findFirst({
      where: { organizationId, role: 'CEO' },
    });
    if (ceo) {
      await this.emailService.sendSubscriptionCancelledEmail(ceo.email, ceo.name || ceo.email).catch(() => {});
    }
  }

  async checkPlanLimit(
    organizationId: string,
    resource: 'users' | 'leads' | 'clients' | 'projects',
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const plan = (org?.plan || 'trial') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;

    const limitMap = {
      users:    limits.maxUsers,
      leads:    limits.maxLeads,
      clients:  limits.maxClients,
      projects: limits.maxProjects,
    };
    const limit = limitMap[resource];
    if (limit === -1) return { allowed: true, current: 0, limit: -1 };

    const countMap = {
      users:    () => this.prisma.user.count({ where: { organizationId } }),
      leads:    () => this.prisma.lead.count({ where: { organizationId } }),
      clients:  () => this.prisma.client.count({ where: { organizationId } }),
      projects: () => this.prisma.project.count({ where: { organizationId } }),
    };
    const current = await countMap[resource]();

    return { allowed: current < limit, current, limit };
  }
}
