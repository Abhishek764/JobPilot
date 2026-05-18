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

  const sources: Array<{
    platform: 'LINKEDIN' | 'WELLFOUND' | 'INDEED' | 'NAUKRI';
    cron: string;
    rateLimitPerMin: number;
    searchQueries: string[];
    locations: string[];
  }> = [
    {
      platform: 'LINKEDIN',
      cron: '*/30 * * * *',
      rateLimitPerMin: 15,
      searchQueries: ['software engineer', 'frontend engineer'],
      locations: ['United States', 'Remote'],
    },
    {
      platform: 'WELLFOUND',
      cron: '0 */2 * * *',
      rateLimitPerMin: 15,
      searchQueries: ['backend-engineer', 'fullstack-engineer'],
      locations: [],
    },
    {
      platform: 'INDEED',
      cron: '*/45 * * * *',
      rateLimitPerMin: 12,
      searchQueries: ['software engineer'],
      locations: ['Remote'],
    },
    {
      platform: 'NAUKRI',
      cron: '0 */3 * * *',
      rateLimitPerMin: 15,
      searchQueries: ['software developer'],
      locations: ['bangalore', 'hyderabad'],
    },
  ];

  for (const s of sources) {
    await prisma.scrapeSource.upsert({
      where: { platform: s.platform },
      update: {},
      create: { ...s, enabled: false },
    });
  }

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
