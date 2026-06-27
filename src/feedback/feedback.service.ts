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

interface LatestAnalysisRow {
  sentiment: string;
  priority: string;
  confidence: number;
  key_themes: string[];
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Aggregate analytics for the dashboard — based on the latest analysis per feedback. */
  async getStats(): Promise<FeedbackStatsDto> {
    const [total, statusGroups, latest] = await this.prisma.$transaction([
      this.prisma.feedback.count(),
      this.prisma.$queryRaw<Array<{ status: string; count: number }>>(
        Prisma.sql`SELECT status, COUNT(*)::int AS count FROM feedback GROUP BY status`,
      ),
      this.prisma.$queryRaw<LatestAnalysisRow[]>(Prisma.sql`
        SELECT DISTINCT ON (feedback_id)
          sentiment, priority, confidence::float8 AS confidence, key_themes
        FROM feedback_analysis
        ORDER BY feedback_id, version DESC
      `),
    ]);

    const statusCounts = new Map(statusGroups.map((g) => [g.status, g.count]));

    const sentimentCounts = countBy(latest, (r) => r.sentiment);
    const priorityCounts = countBy(latest, (r) => r.priority);

    const themeCounts = new Map<string, number>();
    for (const row of latest) {
      for (const theme of row.key_themes) {
        themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
      }
    }
    const topThemes = [...themeCounts.entries()]
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const averageConfidence =
      latest.length > 0
        ? latest.reduce((sum, r) => sum + r.confidence, 0) / latest.length
        : null;

    return {
      totalFeedback: total,
      analyzedFeedback: latest.length,
      unanalyzedFeedback: total - latest.length,
      averageConfidence:
        averageConfidence === null
          ? null
          : Math.round(averageConfidence * 100) / 100,
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

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}
