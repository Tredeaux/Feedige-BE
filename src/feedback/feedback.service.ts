import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit feedback. The submitter is identified by email: we upsert the user,
   * create the feedback, and record a creation entry in the audit log — all in a
   * single transaction so a partial write can never persist.
   */
  async create(dto: CreateFeedbackDto): Promise<FeedbackResponseDto> {
    const source = dto.source ?? 'web';

    const feedback = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: dto.email },
        update: { name: dto.name },
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
