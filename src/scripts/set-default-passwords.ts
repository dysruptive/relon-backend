import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function setDefaultPasswords() {
  console.log('Setting default passwords for existing users...');

  const users = await prisma.user.findMany({
    where: {
      password: null,
    },
  });

  if (users.length === 0) {
    console.log('No users without passwords found.');
    return;
  }

  console.log(`Found ${users.length} users without passwords.`);

  for (const user of users) {
    // Generate a temporary password: Welcome@2026
    const defaultPassword = 'Welcome@2026';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log(`✓ Set default password for ${user.email}`);
  }

  console.log('\n=================================');
  console.log('✓ All users now have passwords!');
  console.log('=================================');
  console.log('\nDefault credentials:');
  console.log('Password: Welcome@2026');
  console.log('\n⚠️  Users should change their password on first login!');
  console.log('=================================\n');

  await prisma.$disconnect();
}

setDefaultPasswords()
  .catch((error) => {
    console.error('Error setting default passwords:', error);
    process.exit(1);
  });
