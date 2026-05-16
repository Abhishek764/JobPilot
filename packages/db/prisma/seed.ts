import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.info('Seeding database...');

  const user = await prisma.user.upsert({
    where: { email: 'demo@jobpilot.ai' },
    update: {},
    create: {
      clerkId: 'seed_demo_user',
      email: 'demo@jobpilot.ai',
      firstName: 'Demo',
      lastName: 'User',
    },
  });

  await prisma.application.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: user.id,
        company: 'Stripe',
        title: 'Senior Software Engineer',
        location: 'Remote',
        status: 'APPLIED',
        appliedAt: new Date(),
        source: 'careers.stripe.com',
      },
      {
        userId: user.id,
        company: 'Vercel',
        title: 'Staff Engineer',
        location: 'Remote',
        status: 'INTERVIEW',
        appliedAt: new Date(),
        source: 'vercel.com/careers',
      },
    ],
  });

  console.info('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
