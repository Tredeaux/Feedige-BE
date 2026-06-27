import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type OpenAI from 'openai';
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

  @Cron(CronExpression.EVERY_MINUTE, { name: 'backlog-screener' })
  async screenNext(): Promise<void> {
    if (!this.enabled || !this.openai || this.running) {
      return;
    }
    this.running = true;
    try {
      const next = await this.prisma.feedback.findFirst({
        where: { analyses: { none: {} } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!next) {
        return;
      }

      this.logger.log(`Screening backlog feedback ${next.id}`);
      await this.analysis.analyzeFeedback(next.id, null);
    } catch (err) {
      // Log and move on — a failed item is retried on the next run.
      this.logger.error(
        'Backlog screening failed',
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.running = false;
    }
  }
}
