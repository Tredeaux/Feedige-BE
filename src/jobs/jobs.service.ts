import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobRunDto, PaginatedJobRunsDto } from './dto/job-run.dto';
import { JobSummaryDto } from './dto/job-summary.dto';
import { ListJobRunsQueryDto } from './dto/list-job-runs.query.dto';
import { JOB_DEFINITIONS, type JobDefinition } from './jobs.constants';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /** Live summary for every monitored job. */
  listJobs(): Promise<JobSummaryDto[]> {
    return Promise.all(
      Object.values(JOB_DEFINITIONS).map((def) => this.buildSummary(def)),
    );
  }

  /** Paginated run history for a single job (most recent first). */
  async listRuns(
    name: string,
    query: ListJobRunsQueryDto,
  ): Promise<PaginatedJobRunsDto> {
    if (!JOB_DEFINITIONS[name]) {
      throw new NotFoundException('Unknown job.');
    }
    const { page, pageSize, status } = query;
    const where = { jobName: name, ...(status ? { status } : {}) };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.jobRun.count({ where }),
      this.prisma.jobRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return PaginatedJobRunsDto.from(rows, { page, pageSize, total });
  }

  private async buildSummary(def: JobDefinition): Promise<JobSummaryDto> {
    const enabled = def.enabledConfigKey
      ? this.config.get<boolean>(def.enabledConfigKey, true)
      : true;
    const aiConfigured =
      !def.requiresAi || Boolean(this.config.get<string>('OPENAI_API_KEY'));
    const nextRunAt = this.nextRunAt(def.name);

    const [lastRun, statusRows, itemsAgg] = await this.prisma.$transaction([
      this.prisma.jobRun.findFirst({
        where: { jobName: def.name },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.$queryRaw<Array<{ status: string; count: number }>>(
        Prisma.sql`SELECT status, COUNT(*)::int AS count FROM job_run WHERE job_name = ${def.name} GROUP BY status`,
      ),
      this.prisma.jobRun.aggregate({
        where: { jobName: def.name },
        _sum: { itemsProcessed: true },
      }),
    ]);

    const counts = new Map(statusRows.map((r) => [r.status, r.count]));
    const totals = {
      total: statusRows.reduce((sum, r) => sum + r.count, 0),
      success: counts.get('success') ?? 0,
      noop: counts.get('noop') ?? 0,
      failed: counts.get('failed') ?? 0,
      itemsProcessed: itemsAgg._sum.itemsProcessed ?? 0,
    };

    let health: JobSummaryDto['health'];
    if (!enabled) {
      health = 'disabled';
    } else if (!aiConfigured) {
      health = 'idle';
    } else if (lastRun?.status === 'failed' || !nextRunAt) {
      health = 'degraded';
    } else {
      health = 'healthy';
    }

    return {
      name: def.name,
      displayName: def.displayName,
      description: def.description,
      schedule: def.schedule,
      cronExpression: def.cronExpression,
      enabled,
      aiConfigured,
      health,
      nextRunAt,
      lastRun: lastRun ? JobRunDto.fromEntity(lastRun) : null,
      totals,
    };
  }

  /** Next fire time from the scheduler, or null if the job isn't registered. */
  private nextRunAt(name: string): Date | null {
    try {
      const job = this.scheduler.getCronJob(name);
      const next: unknown = job.nextDate();
      // cron@4 returns a Luxon DateTime; guard in case of a plain Date.
      if (next instanceof Date) return next;
      if (
        next &&
        typeof (next as { toJSDate?: () => Date }).toJSDate === 'function'
      ) {
        return (next as { toJSDate: () => Date }).toJSDate();
      }
      return null;
    } catch {
      // Job not registered (e.g. scheduler disabled in tests).
      return null;
    }
  }
}
