import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Dev-only admin credentials. Change these in any real environment.
const ADMIN_EMAIL = 'admin@feedige.dev';
const ADMIN_PASSWORD = 'admin12345';

/**
 * Idempotent seed for a fresh environment. Safe to run multiple times — it only
 * inserts sample data when the database is empty. Run with `npm run db:seed`
 * (also invoked automatically by `prisma migrate reset`).
 */
async function main(): Promise<void> {
  const existing = await prisma.feedback.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} feedback row(s) already present.`);
    return;
  }

  // A real admin that can sign in to the panel (role 'admin' + password).
  const triager = await prisma.user.create({
    data: {
      name: 'Alex Admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    },
  });
  // A plain submitter (no password, least-privileged role).
  const submitter = await prisma.user.create({
    data: { name: 'Sam Customer', email: 'sam@example.com', role: 'member' },
  });

  // A reviewed item with an analysis and an audit trail.
  await prisma.feedback.create({
    data: {
      rawText:
        'CSV export times out on large reports. This blocks my weekly workflow.',
      source: 'web',
      status: 'reviewed',
      submittedById: submitter.id,
      analyses: {
        create: {
          version: 1,
          sentiment: 'negative',
          priority: 'high',
          summary:
            'Customer is blocked by CSV export timeouts on large reports.',
          confidence: 0.92,
          keyThemes: ['export', 'performance', 'reliability'],
          recommendedActions: [
            'Investigate CSV export timeout on large datasets',
            'Add async export with download link',
          ],
          analyzedById: triager.id,
        },
      },
      auditLogs: {
        create: [
          {
            userId: triager.id,
            action: 'analysis_created',
            newValue: { version: 1, priority: 'high', sentiment: 'negative' },
          },
          {
            userId: triager.id,
            action: 'status_changed',
            oldValue: { status: 'pending' },
            newValue: { status: 'reviewed' },
          },
        ],
      },
    },
  });

  // A couple of pending items with no analysis yet.
  await prisma.feedback.createMany({
    data: [
      {
        rawText: 'Love the new dashboard — so much faster to navigate!',
        source: 'web',
        status: 'pending',
        submittedById: submitter.id,
      },
      {
        rawText:
          'Would really appreciate a dark theme for late-night sessions.',
        source: 'email',
        status: 'pending',
      },
    ],
  });

  const [users, feedback, analyses, logs] = await Promise.all([
    prisma.user.count(),
    prisma.feedback.count(),
    prisma.feedbackAnalysis.count(),
    prisma.auditLog.count(),
  ]);
  console.log(
    `Seed complete: ${users} users, ${feedback} feedback, ${analyses} analyses, ${logs} audit log(s).`,
  );
  console.log(`Admin login → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
