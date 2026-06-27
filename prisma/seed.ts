import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Idempotent seed for a fresh environment. Safe to run multiple times — it only
 * inserts sample data when the table is empty. Run with `npm run db:seed`
 * (also invoked automatically by `prisma migrate reset`).
 */
async function main(): Promise<void> {
  const existing = await prisma.feedback.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} feedback row(s) already present.`);
    return;
  }

  await prisma.feedback.createMany({
    data: [
      {
        title: 'Love the new dashboard',
        body: 'The redesign is so much faster and easier to navigate. Great work!',
        status: 'NEW',
      },
      {
        title: 'Export keeps failing',
        body: 'CSV export times out on large reports. This is blocking my weekly workflow.',
        status: 'TRIAGED',
      },
      {
        title: 'Dark mode please',
        body: 'Would really appreciate a dark theme for late-night sessions.',
        status: 'NEW',
      },
    ],
  });

  const total = await prisma.feedback.count();
  console.log(`Seed complete: ${total} feedback row(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
