import { ApiProperty } from '@nestjs/swagger';
import type { Feedback, User } from '@prisma/client';

class SubmitterDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, example: 'Jane Doe' })
  name!: string | null;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;
}

/** Shape returned to clients after submitting feedback. */
export class FeedbackResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'The CSV export times out on large reports.' })
  rawText!: string;

  @ApiProperty({ example: 'web' })
  source!: string;

  @ApiProperty({ example: 'pending' })
  status!: string;

  @ApiProperty({ type: SubmitterDto, nullable: true })
  submittedBy!: SubmitterDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(
    feedback: Feedback & { submittedBy: User | null },
  ): FeedbackResponseDto {
    const dto = new FeedbackResponseDto();
    dto.id = feedback.id;
    dto.rawText = feedback.rawText;
    dto.source = feedback.source;
    dto.status = feedback.status;
    dto.createdAt = feedback.createdAt;
    dto.updatedAt = feedback.updatedAt;
    dto.submittedBy = feedback.submittedBy
      ? {
          id: feedback.submittedBy.id,
          name: feedback.submittedBy.name,
          email: feedback.submittedBy.email,
        }
      : null;
    return dto;
  }
}
