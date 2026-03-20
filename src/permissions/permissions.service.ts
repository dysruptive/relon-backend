import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_IMPLICATIONS,
} from './permissions.constants';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  // Cache key: `${organizationId}:${role}` -> Set<permission>
  private cache = new Map<string, Set<string>>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // No global seed — permissions are seeded per-org at registration
    await this.refreshCache();
  }

  async hasPermission(role: string, permission: string, organizationId?: string): Promise<boolean> {
    // CEO and SUPER_ADMIN always have all permissions
    if (role === 'CEO' || role === 'SUPER_ADMIN') return true;

    if (!organizationId) {
      // Fallback: check any org that has this role (legacy path)
      const cacheKey = role;
      const rolePerms = this.cache.get(cacheKey);
      return rolePerms ? rolePerms.has(permission) : false;
    }

    const cacheKey = `${organizationId}:${role}`;
    const rolePerms = this.cache.get(cacheKey);
    return rolePerms ? rolePerms.has(permission) : false;
  }

  async getPermissionsForRole(role: string, organizationId?: string): Promise<string[]> {
    if (role === 'CEO' || role === 'SUPER_ADMIN') {
      return ALL_PERMISSIONS.map((p) => p.key);
    }

    if (!organizationId) {
      const rolePerms = this.cache.get(role);
      return rolePerms ? Array.from(rolePerms) : [];
    }

    const cacheKey = `${organizationId}:${role}`;
    const rolePerms = this.cache.get(cacheKey);
    return rolePerms ? Array.from(rolePerms) : [];
  }

  async getMatrix(organizationId: string) {
    const roleRecords = await this.prisma.role.findMany({
      orderBy: [{ isBuiltIn: 'desc' }, { createdAt: 'asc' }],
    });
    const matrix: Record<string, string[]> = {};

    for (const role of roleRecords) {
      matrix[role.key] = await this.getPermissionsForRole(role.key, organizationId);
    }

    return {
      permissions: ALL_PERMISSIONS,
      roles: roleRecords.map((r) => ({
        key: r.key,
        label: r.label,
        color: r.color,
        isBuiltIn: r.isBuiltIn,
      })),
      matrix,
    };
  }

  async updateRolePermissions(
    role: string,
    permissions: string[],
    organizationId: string,
  ): Promise<void> {
    // Validate permission keys — accepts raw strings from callers (e.g. admin UI) and filters to known keys
    const validKeys = new Set<string>(ALL_PERMISSIONS.map((p) => p.key));
    const filtered = permissions.filter((p) => validKeys.has(p));

    // Delete existing permissions for this role within the org
    await this.prisma.rolePermission.deleteMany({
      where: { role, organizationId },
    });

    // Insert new permissions
    if (filtered.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: filtered.map((permission) => ({ role, permission, organizationId })),
      });
    }

    // Refresh cache
    await this.refreshCache();
  }

  /**
   * Seed default permissions for a newly created organization.
   * Called during registration.
   */
  async seedDefaultsForOrg(organizationId: string): Promise<void> {
    const existing = await this.prisma.rolePermission.count({
      where: { organizationId },
    });

    if (existing > 0) {
      this.logger.log(`Permissions already exist for org ${organizationId}, skipping.`);
      return;
    }

    this.logger.log(`Seeding default role permissions for org ${organizationId}...`);
    const data: { role: string; permission: string; organizationId: string }[] = [];

    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      // Skip CEO - hardcoded to have all permissions
      if (role === 'CEO') continue;
      for (const permission of permissions) {
        data.push({ role, permission, organizationId });
      }
    }

    await this.prisma.rolePermission.createMany({ data, skipDuplicates: true });
    this.logger.log(`Seeded ${data.length} default role permissions for org ${organizationId}.`);

    // Refresh cache to include new org permissions
    await this.refreshCache();
  }

  async refreshCachePublic(): Promise<void> {
    await this.refreshCache();
  }

  private async refreshCache(): Promise<void> {
    const allPerms = await this.prisma.rolePermission.findMany();
    this.cache.clear();

    for (const rp of allPerms) {
      const orgKey = `${rp.organizationId}:${rp.role}`;
      if (!this.cache.has(orgKey)) {
        this.cache.set(orgKey, new Set());
      }
      const set = this.cache.get(orgKey)!;
      set.add(rp.permission);

      // Apply implication rules: having a write permission grants its implied read permissions
      const implied = PERMISSION_IMPLICATIONS[rp.permission as keyof typeof PERMISSION_IMPLICATIONS];
      if (implied) {
        for (const p of implied) set.add(p);
      }
    }

    this.logger.log(`Permissions cache refreshed: ${allPerms.length} entries.`);
  }
}
