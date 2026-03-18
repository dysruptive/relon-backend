import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  const password = 'Pass123$1';
  const hashedPassword = await bcrypt.hash(password, 10);

  // ── Create demo organization ──────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'relon-demo' },
    update: {},
    create: {
      name: 'Relon Demo',
      slug: 'relon-demo',
      industry: 'Construction',
      size: '11-50',
      plan: 'scale',
      planStatus: 'active',
    },
  });
  console.log('✅ Created Organization:', org.name);

  const orgId = org.id;

  // ── Create users ──────────────────────────────────────────────────────────
  const ceo = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: 'ceo@relon.com' } },
    update: {},
    create: {
      email: 'ceo@relon.com',
      password: hashedPassword,
      name: 'CEO User',
      role: 'CEO',
      status: 'Active',
      isEmailVerified: true,
      organizationId: orgId,
    },
  });
  console.log('✅ Created CEO:', ceo.email);

  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: 'admin@relon.com' } },
    update: {},
    create: {
      email: 'admin@relon.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      status: 'Active',
      isEmailVerified: true,
      organizationId: orgId,
    },
  });
  console.log('✅ Created Admin:', admin.email);

  const manager = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: 'manager@relon.com' } },
    update: {},
    create: {
      email: 'manager@relon.com',
      password: hashedPassword,
      name: 'BDM User',
      role: 'BDM',
      status: 'Active',
      isEmailVerified: true,
      organizationId: orgId,
    },
  });
  console.log('✅ Created BDM:', manager.email);

  const manager2 = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: 'manager2@relon.com' } },
    update: {},
    create: {
      email: 'manager2@relon.com',
      password: hashedPassword,
      name: 'BDM 2',
      role: 'BDM',
      status: 'Active',
      isEmailVerified: true,
      organizationId: orgId,
    },
  });
  console.log('✅ Created BDM 2:', manager2.email);

  // ── Create teams ──────────────────────────────────────────────────────────
  const teamA = await prisma.team.upsert({
    where: { id: 'seed-team-a' },
    update: { managerId: manager.id },
    create: {
      id: 'seed-team-a',
      name: 'Sales Team A',
      description: 'Primary sales team',
      type: 'SALES',
      managerId: manager.id,
      organizationId: orgId,
    },
  });
  console.log('✅ Created Team:', teamA.name);

  const teamB = await prisma.team.upsert({
    where: { id: 'seed-team-b' },
    update: { managerId: manager2.id },
    create: {
      id: 'seed-team-b',
      name: 'Sales Team B',
      description: 'Secondary sales team',
      type: 'SALES',
      managerId: manager2.id,
      organizationId: orgId,
    },
  });
  console.log('✅ Created Team:', teamB.name);

  // Assign managers to their teams
  await prisma.user.update({
    where: { id: manager.id },
    data: { teamId: teamA.id, teamName: 'Sales Team A' },
  });
  await prisma.user.update({
    where: { id: manager2.id },
    data: { teamId: teamB.id, teamName: 'Sales Team B' },
  });

  const sales1 = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: 'sales@relon.com' } },
    update: { teamId: teamA.id, teamName: 'Sales Team A', managerId: manager.id },
    create: {
      email: 'sales@relon.com',
      password: hashedPassword,
      name: 'Sales Executive 1',
      role: 'SALES',
      status: 'Active',
      isEmailVerified: true,
      teamName: 'Sales Team A',
      teamId: teamA.id,
      managerId: manager.id,
      organizationId: orgId,
    },
  });
  console.log('✅ Created Sales 1 (Team A):', sales1.email);

  const sales2 = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: 'sales2@relon.com' } },
    update: { teamId: teamB.id, teamName: 'Sales Team B', managerId: manager2.id },
    create: {
      email: 'sales2@relon.com',
      password: hashedPassword,
      name: 'Sales Executive 2',
      role: 'SALES',
      status: 'Active',
      isEmailVerified: true,
      teamName: 'Sales Team B',
      teamId: teamB.id,
      managerId: manager2.id,
      organizationId: orgId,
    },
  });
  console.log('✅ Created Sales 2 (Team B):', sales2.email);

  const sales3 = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: 'sales3@relon.com' } },
    update: { teamId: teamB.id, teamName: 'Sales Team B', managerId: manager2.id },
    create: {
      email: 'sales3@relon.com',
      password: hashedPassword,
      name: 'Sales Executive 3',
      role: 'SALES',
      status: 'Active',
      isEmailVerified: true,
      teamName: 'Sales Team B',
      teamId: teamB.id,
      managerId: manager2.id,
      organizationId: orgId,
    },
  });
  console.log('✅ Created Sales 3 (Team B):', sales3.email);

  // ── Seed pipeline stages ──────────────────────────────────────────────────
  const defaultStages = [
    { name: 'New', pipelineType: 'prospective_project', color: 'bg-gray-500', lightColor: 'bg-gray-50', border: 'border-gray-200', probability: 10, sortOrder: 0, isSystem: false },
    { name: 'Contacted', pipelineType: 'prospective_project', color: 'bg-blue-500', lightColor: 'bg-blue-50', border: 'border-blue-200', probability: 30, sortOrder: 1, isSystem: false },
    { name: 'Quoted', pipelineType: 'prospective_project', color: 'bg-purple-500', lightColor: 'bg-purple-50', border: 'border-purple-200', probability: 50, sortOrder: 2, isSystem: false },
    { name: 'Negotiation', pipelineType: 'prospective_project', color: 'bg-orange-500', lightColor: 'bg-orange-50', border: 'border-orange-200', probability: 80, sortOrder: 3, isSystem: false },
    { name: 'Won', pipelineType: 'prospective_project', color: 'bg-green-500', lightColor: 'bg-green-50', border: 'border-green-200', probability: 100, sortOrder: 4, isSystem: true },
    { name: 'Lost', pipelineType: 'prospective_project', color: 'bg-red-500', lightColor: 'bg-red-50', border: 'border-red-200', probability: 0, sortOrder: 5, isSystem: true },
    { name: 'Planning', pipelineType: 'project', color: 'bg-blue-500', lightColor: 'bg-blue-50', border: 'border-blue-200', probability: 0, sortOrder: 0, isSystem: true },
    { name: 'Active', pipelineType: 'project', color: 'bg-green-500', lightColor: 'bg-green-50', border: 'border-green-200', probability: 50, sortOrder: 1, isSystem: true },
    { name: 'On Hold', pipelineType: 'project', color: 'bg-yellow-500', lightColor: 'bg-yellow-50', border: 'border-yellow-200', probability: 0, sortOrder: 2, isSystem: false },
    { name: 'Completed', pipelineType: 'project', color: 'bg-gray-400', lightColor: 'bg-gray-50', border: 'border-gray-200', probability: 100, sortOrder: 3, isSystem: true },
    { name: 'Cancelled', pipelineType: 'project', color: 'bg-red-500', lightColor: 'bg-red-50', border: 'border-red-200', probability: 0, sortOrder: 4, isSystem: false },
  ];

  for (const stage of defaultStages) {
    await prisma.pipelineStage.upsert({
      where: { organizationId_name_pipelineType: { organizationId: orgId, name: stage.name, pipelineType: stage.pipelineType } },
      update: {},
      create: { ...stage, organizationId: orgId },
    });
  }
  console.log('✅ Seeded 11 default pipeline stages');

  // ── Seed role permissions ─────────────────────────────────────────────────
  const { DEFAULT_ROLE_PERMISSIONS } = await import('../src/permissions/permissions.constants');

  const permData: { role: string; permission: string; organizationId: string }[] = [];
  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (role === 'CEO') continue;
    for (const permission of permissions) {
      permData.push({ role, permission, organizationId: orgId });
    }
  }

  // Add report permissions
  permData.push(
    { role: 'ADMIN', permission: 'reports:view', organizationId: orgId },
    { role: 'ADMIN', permission: 'reports:export', organizationId: orgId },
    { role: 'BDM', permission: 'reports:view', organizationId: orgId },
    { role: 'BDM', permission: 'reports:export', organizationId: orgId },
    { role: 'SALES', permission: 'reports:view', organizationId: orgId },
  );

  for (const perm of permData) {
    await prisma.rolePermission.upsert({
      where: {
        organizationId_role_permission: {
          organizationId: orgId,
          role: perm.role,
          permission: perm.permission,
        },
      },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ Seeded ${permData.length} role permissions`);

  // ── Seed AI Settings ──────────────────────────────────────────────────────
  await prisma.aISettings.upsert({
    where: { organizationId: orgId },
    update: {},
    create: {
      organizationId: orgId,
      defaultProvider: 'anthropic',
    },
  });
  console.log('✅ Seeded AI settings');

  console.log('\n📊 Seed Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏢 Organization: Relon Demo (slug: relon-demo)');
  console.log('🔐 All users have password: Pass123$1\n');
  console.log('1️⃣  CEO:    ceo@relon.com');
  console.log('2️⃣  Admin:  admin@relon.com');
  console.log('3️⃣  BDM A:  manager@relon.com');
  console.log('4️⃣  Sales1: sales@relon.com   (Team A)');
  console.log('5️⃣  BDM B:  manager2@relon.com');
  console.log('6️⃣  Sales2: sales2@relon.com  (Team B)');
  console.log('7️⃣  Sales3: sales3@relon.com  (Team B)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
