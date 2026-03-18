import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PLAN_LIMITS } from '../../billing/plans';

@Injectable()
export class ReportsPlanGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organizationId = request.user?.organizationId;
    if (!organizationId) return false;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    const limits =
      PLAN_LIMITS[(org?.plan as keyof typeof PLAN_LIMITS) || 'trial'] ||
      PLAN_LIMITS.trial;

    if (!limits.reportsEnabled) {
      throw new ForbiddenException(
        'Reports are not available on your current plan. Please upgrade to Starter or higher.',
      );
    }

    return true;
  }
}
