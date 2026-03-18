import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /** Liveness — proves the process is running */
  @Public()
  @Get('live')
  live() {
    return { status: 'ok', service: 'relon-crm-backend', timestamp: new Date().toISOString() };
  }

  /** Readiness — proves the process can serve traffic (DB reachable) */
  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'relon-crm-backend',
        timestamp: new Date().toISOString(),
        checks: { database: 'ok' },
      };
    } catch (err) {
      return {
        status: 'error',
        service: 'relon-crm-backend',
        timestamp: new Date().toISOString(),
        checks: { database: 'error' },
      };
    }
  }

  /** Legacy root — kept for backward compatibility */
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'relon-crm-backend', timestamp: new Date().toISOString() };
  }
}
