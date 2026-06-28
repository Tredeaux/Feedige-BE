import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { JobRun } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from './jobs.service';

function buildLastRun(status: string): JobRun {
  return {
    id: 'run-1',
    jobName: 'backlog-screener',
    status,
    startedAt: new Date('2026-06-28T12:00:00Z'),
    finishedAt: new Date('2026-06-28T12:00:01Z'),
    durationMs: 1000,
    itemsProcessed: status === 'success' ? 1 : 0,
    detail: null,
    error: null,
    createdAt: new Date('2026-06-28T12:00:01Z'),
  };
}

interface Mocks {
  enabled?: boolean;
  aiKey?: string;
  lastRun?: JobRun | null;
  statusRows?: Array<{ status: string; count: number }>;
  items?: number | null;
  nextDate?: Date | null;
}

function makeService(m: Mocks) {
  const prisma = {
    $transaction: jest
      .fn()
      .mockResolvedValue([
        m.lastRun ?? null,
        m.statusRows ?? [],
        { _sum: { itemsProcessed: m.items ?? null } },
      ]),
    jobRun: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'OPENAI_API_KEY'
        ? (m.aiKey ?? 'sk-test')
        : (m.enabled ?? fallback),
    ),
  } as unknown as ConfigService;

  const scheduler = {
    getCronJob: jest.fn(() => ({
      nextDate: () => ({
        toJSDate: () => m.nextDate ?? new Date('2026-06-28T12:01:00Z'),
      }),
    })),
  } as unknown as SchedulerRegistry;

  return new JobsService(prisma, config, scheduler);
}

describe('JobsService', () => {
  it('reports healthy and aggregates totals when enabled, configured, and last run ok', async () => {
    const service = makeService({
      enabled: true,
      aiKey: 'sk-test',
      lastRun: buildLastRun('success'),
      statusRows: [
        { status: 'success', count: 2 },
        { status: 'noop', count: 5 },
      ],
      items: 2,
    });

    const [job] = await service.listJobs();

    expect(job.health).toBe('healthy');
    expect(job.enabled).toBe(true);
    expect(job.aiConfigured).toBe(true);
    expect(job.totals).toEqual({
      total: 7,
      success: 2,
      noop: 5,
      failed: 0,
      itemsProcessed: 2,
    });
    expect(job.nextRunAt).toEqual(new Date('2026-06-28T12:01:00Z'));
    expect(job.lastRun?.status).toBe('success');
  });

  it('is disabled when the enable flag is off', async () => {
    const service = makeService({ enabled: false });
    const [job] = await service.listJobs();
    expect(job.health).toBe('disabled');
    expect(job.enabled).toBe(false);
  });

  it('is idle when AI is not configured', async () => {
    const service = makeService({ enabled: true, aiKey: '' });
    const [job] = await service.listJobs();
    expect(job.health).toBe('idle');
    expect(job.aiConfigured).toBe(false);
  });

  it('is degraded when the last run failed', async () => {
    const service = makeService({
      enabled: true,
      aiKey: 'sk-test',
      lastRun: buildLastRun('failed'),
      statusRows: [{ status: 'failed', count: 1 }],
    });
    const [job] = await service.listJobs();
    expect(job.health).toBe('degraded');
  });
});
