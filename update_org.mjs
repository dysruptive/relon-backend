import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const orgs = await prisma.organization.findMany({
  select: { id: true, name: true, plan: true, planStatus: true },
});
console.log('All orgs:', JSON.stringify(orgs, null, 2));

const target = orgs.find(o => o.name.toLowerCase().includes('dysruptive'));
if (!target) {
  console.log('Dysruptive Technologies not found');
  process.exit(1);
}

const updated = await prisma.organization.update({
  where: { id: target.id },
  data: { plan: 'scale', planStatus: 'active' },
  select: { id: true, name: true, plan: true, planStatus: true },
});
console.log('Updated:', JSON.stringify(updated, null, 2));
await prisma.$disconnect();
