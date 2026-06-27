import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { PaginatedFeedbackDto } from './dto/feedback-list.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback.query.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
