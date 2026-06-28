import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type OpenAI from 'openai';
import { BACKLOG_SCREENER } from '../jobs/jobs.constants';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from './analysis.service';
import { OPENAI_CLIENT } from './analysis.constants';

/**
 * Screens the feedback backlog one item per run: finds the oldest feedback with
 * no analysis yet and analyzes it. A successful analysis creates a
 * `feedback_analysis` row, which removes the item from the backlog query — so
 * each item is screened once and the queue drains over time.
 *
 * No-ops when disabled or when OpenAI isn't configured. Single-instance only:
 * for multiple replicas, move this to a dedicated worker / distributed lock.
 */
@Injectable()
export class BacklogService {
  private readonly logger = new Logger(BacklogService.name);
  private readonly enabled: boolean;
  private running = false;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI | null,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly analysis: AnalysisService,
  ) {
    this.enabled = this.config.get<boolean>('BACKLOG_ANALYSIS_ENABLED', true);
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: BACKLOG_SCREENER })
  async screenNext(): Promise<void> {
    // Disabled / unconfigured / re-entrant ticks are not "runs" — they're not
    // recorded (the live job summary reports those states instead).
    if (!this.enabled || !this.openai || this.running) {
      return;
    }
    this.running = true;
    const startedAt = new Date();
    try {
      const next = await this.prisma.feedback.findFirst({
        where: { analyses: { none: {} } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!next) {
        await this.recordRun({
          startedAt,
          status: 'noop',
          itemsProcessed: 0,
          detail: 'No unanalyzed feedback in the backlog.',
        });
        return;
      }

      this.logger.log(`Screening backlog feedback ${next.id}`);
      const analysis = await this.analysis.analyzeFeedback(next.id, null);
      await this.recordRun({
        startedAt,
        status: 'success',
        itemsProcessed: 1,
        detail: `Analyzed feedback ${next.id} → ${analysis.sentiment} / ${analysis.priority}.`,
      });
    } catch (err) {
      // Log and move on — a failed item is retried on the next run.
      this.logger.error(
        'Backlog screening failed',
        err instanceof Error ? err.stack : String(err),
      );
      await this.recordRun({
        startedAt,
        status: 'failed',
        itemsProcessed: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.running = false;
    }
  }

  /** Persist a run record for the cron monitor. Never throws into the caller. */
  private async recordRun(run: {
    startedAt: Date;
    status: string;
    itemsProcessed: number;
    detail?: string;
    error?: string;
  }): Promise<void> {
    const finishedAt = new Date();
    try {
      await this.prisma.jobRun.create({
        data: {
          jobName: BACKLOG_SCREENER,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt,
          durationMs: finishedAt.getTime() - run.startedAt.getTime(),
          itemsProcessed: run.itemsProcessed,
          detail: run.detail ?? null,
          error: run.error ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        'Failed to record job run',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
