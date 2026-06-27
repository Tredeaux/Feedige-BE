import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackStatsDto } from './dto/feedback-stats.dto';
import { PaginatedFeedbackDto } from './dto/feedback-list.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import {
  FEEDBACK_STATUSES,
  ListFeedbackQueryDto,
} from './dto/list-feedback.query.dto';

const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;
const VOLUME_DAYS = 30;

interface DistRow {
  kind: string;
  key: string;
  count: number;
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Aggregate analytics for the dashboard. All aggregation runs in Postgres so
   * the payload stays small regardless of table size:
   *  - distributions over the *latest* analysis per feedback (DISTINCT ON uses
   *    the unique (feedback_id, version) index),
   *  - status grouping (total is derived from these, avoiding a second count),
   *  - a 30-day volume series filtered on the indexed created_at.
   */
  async getStats(): Promise<FeedbackStatsDto> {
    const [statusRows, distRows, aggRows, volumeRows] =
      await this.prisma.$transaction([
        this.prisma.$queryRaw<Array<{ status: string; count: number }>>(
          Prisma.sql`SELECT status, COUNT(*)::int AS count FROM feedback GROUP BY status`,
        ),
        this.prisma.$queryRaw<DistRow[]>(Prisma.sql`
          WITH latest AS (
            SELECT DISTINCT ON (feedback_id) feedback_id, sentiment, priority, key_themes
            FROM feedback_analysis
            ORDER BY feedback_id, version DESC
          )
          SELECT 'sentiment' AS kind, sentiment AS key, COUNT(*)::int AS count
            FROM latest GROUP BY sentiment
          UNION ALL
          SELECT 'priority', priority, COUNT(*)::int FROM latest GROUP BY priority
          UNION ALL
          SELECT 'theme', theme, COUNT(*)::int
            FROM latest, unnest(key_themes) AS theme GROUP BY theme
        `),
        this.prisma.$queryRaw<
          Array<{ analyzed: number; avg_confidence: number | null }>
        >(Prisma.sql`
          SELECT COUNT(*)::int AS analyzed, AVG(confidence)::float8 AS avg_confidence
          FROM (
            SELECT DISTINCT ON (feedback_id) confidence
            FROM feedback_analysis ORDER BY feedback_id, version DESC
          ) l
        `),
        this.prisma.$queryRaw<Array<{ day: string; count: number }>>(Prisma.sql`
          SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM feedback
          WHERE created_at >= now() - make_interval(days => ${VOLUME_DAYS - 1}::int)
          GROUP BY 1 ORDER BY 1
        `),
      ]);

    const statusCounts = new Map(statusRows.map((r) => [r.status, r.count]));
    const total = statusRows.reduce((sum, r) => sum + r.count, 0);

    const sentimentCounts = new Map<string, number>();
    const priorityCounts = new Map<string, number>();
    const themes: Array<{ theme: string; count: number }> = [];
    for (const row of distRows) {
      if (row.kind === 'sentiment') sentimentCounts.set(row.key, row.count);
      else if (row.kind === 'priority') priorityCounts.set(row.key, row.count);
      else themes.push({ theme: row.key, count: row.count });
    }
    const topThemes = themes.sort((a, b) => b.count - a.count).slice(0, 10);

    const analyzed = aggRows[0]?.analyzed ?? 0;
    const avg = aggRows[0]?.avg_confidence ?? null;

    return {
      totalFeedback: total,
      analyzedFeedback: analyzed,
      unanalyzedFeedback: total - analyzed,
      averageConfidence: avg === null ? null : Math.round(avg * 100) / 100,
      byStatus: FEEDBACK_STATUSES.map((label) => ({
        label,
        count: statusCounts.get(label) ?? 0,
      })),
      bySentiment: SENTIMENTS.map((label) => ({
        label,
        count: sentimentCounts.get(label) ?? 0,
      })),
      byPriority: PRIORITIES.map((label) => ({
        label,
        count: priorityCounts.get(label) ?? 0,
      })),
      topThemes,
      volumeByDay: fillVolumeDays(volumeRows, VOLUME_DAYS),
    };
  }

  /** Change a feedback item's triage status, recording the change in the audit log. */
  async updateStatus(
    id: string,
    status: string,
    userId: string,
  ): Promise<FeedbackResponseDto> {
    const existing = await this.prisma.feedback.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Feedback not found.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const feedback = await tx.feedback.update({
        where: { id },
        data: { status },
        include: { submittedBy: true },
      });
      await this.audit.record(
        {
          action: 'status_changed',
          feedbackId: id,
          userId,
          oldValue: { status: existing.status },
          newValue: { status },
        },
        tx,
      );
      return feedback;
    });

    return FeedbackResponseDto.fromEntity(updated);
  }

  /** Paginated, filtered, searchable, sortable list for the triage view. */
  async list(query: ListFeedbackQueryDto): Promise<PaginatedFeedbackDto> {
    const { page, pageSize, status, source, search, sortBy, sortOrder } = query;

    const where: Prisma.FeedbackWhereInput = {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(search
        ? {
            OR: [
              { rawText: { contains: search, mode: 'insensitive' } },
              {
                submittedBy: {
                  email: { contains: search, mode: 'insensitive' },
                },
              },
              {
                submittedBy: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          submittedBy: true,
          analyses: { orderBy: { version: 'desc' }, take: 1 },
        },
      }),
    ]);

    return PaginatedFeedbackDto.from(rows, { page, pageSize, total });
  }

  /**
   * Submit feedback. The submitter is identified by email: we upsert the user,
   * create the feedback, and record a creation entry in the audit log — all in a
   * single transaction so a partial write can never persist.
   */
  async create(dto: CreateFeedbackDto): Promise<FeedbackResponseDto> {
    const source = dto.source ?? 'web';

    const feedback = await this.prisma.$transaction(async (tx) => {
      // Find-or-create by email. We do NOT overwrite an existing user's name —
      // an anonymous submission must not be able to change a registered user's
      // identity. The name is only set when the user is first created.
      const user = await tx.user.upsert({
        where: { email: dto.email },
        update: {},
        create: { email: dto.email, name: dto.name },
      });

      return tx.feedback.create({
        data: {
          rawText: dto.message,
          source,
          submittedBy: { connect: { id: user.id } },
          auditLogs: {
            create: {
              user: { connect: { id: user.id } },
              action: 'feedback_created',
              newValue: { status: 'pending', source },
            },
          },
        },
        include: { submittedBy: true },
      });
    });

    return FeedbackResponseDto.fromEntity(feedback);
  }
}

/** Fill a continuous, gap-free series of the last `days` days (oldest → newest). */
function fillVolumeDays(
  rows: Array<{ day: string; count: number }>,
  days: number,
): Array<{ date: string; count: number }> {
  const counts = new Map(rows.map((r) => [r.day, r.count]));
  const out: Array<{ date: string; count: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return out;
}
