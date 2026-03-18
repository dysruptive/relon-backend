import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';

// Routes decorated with @PlanBypass() skip plan-status enforcement
export const PLAN_BYPASS_KEY = 'planBypass';

// Paths that must always be accessible so users can manage their subscription
const ALWAYS_ALLOWED_PREFIXES = ['/api/billing', '/api/auth', '/api/health'];

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface OrgStatusCache {
  planStatus: string;
  trialEndsAt: string | null; // ISO string — stored in Redis/cache as JSON
  pastDueSince: string | null;
  currentPeriodEnd: string | null;
}

@Injectable()
export class PlanStatusGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public routes — JWT guard hasn't run yet for these
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user means JWT guard will deny the request; let it
    if (!user?.organizationId) return true;

    // Always allow billing/auth/health paths so users can upgrade or re-authenticate
    const path: string = request.path || '';
    if (ALWAYS_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return true;
    }

    const org = await this.getOrgStatus(user.organizationId);
    if (!org) return true; // Org not found — JWT strategy already validates user exists

    const { planStatus, trialEndsAt, pastDueSince, currentPeriodEnd } = org;
    const now = new Date();

    if (planStatus === 'active') return true;

    if (planStatus === 'trialing') {
      if (trialEndsAt && new Date(trialEndsAt) < now) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'TrialExpired',
          message: 'Your trial has expired. Please upgrade to continue.',
        });
      }
      return true;
    }

    if (planStatus === 'past_due') {
      // Allow 7-day grace period after first going past_due
      if (pastDueSince && now.getTime() - new Date(pastDueSince).getTime() > GRACE_PERIOD_MS) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'PaymentOverdue',
          message: 'Your payment is overdue. Please update your billing information to continue.',
        });
      }
      return true;
    }

    if (planStatus === 'cancelling') {
      // Access allowed until end of current billing period
      if (currentPeriodEnd && new Date(currentPeriodEnd) < now) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'SubscriptionEnded',
          message: 'Your subscription has ended. Please resubscribe to continue.',
        });
      }
      return true;
    }

    if (planStatus === 'cancelled' || planStatus === 'suspended') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SubscriptionInactive',
        message: 'Your subscription is inactive. Please visit billing to reactivate.',
      });
    }

    // Unknown status: allow conservatively rather than locking users out
    return true;
  }

  private async getOrgStatus(organizationId: string): Promise<OrgStatusCache | null> {
    const cacheKey = `plan-status:${organizationId}`;
    const cached = await this.cache.get<OrgStatusCache>(cacheKey);
    if (cached) return cached;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { planStatus: true, trialEndsAt: true, pastDueSince: true, currentPeriodEnd: true },
    });

    if (!org) return null;

    const entry: OrgStatusCache = {
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
      pastDueSince: org.pastDueSince?.toISOString() ?? null,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
    };
    await this.cache.set(cacheKey, entry, 30);
    return entry;
  }
}
