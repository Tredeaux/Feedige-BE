import { ApiProperty } from '@nestjs/swagger';
import type { AuditLog, Feedback, User } from '@prisma/client';

const EXCERPT_LENGTH = 80;

class AuditActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty()
  email!: string;
}

class AuditFeedbackRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Truncated feedback text' })
  excerpt!: string;
}

export class AuditLogItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'status_changed' })
  action!: string;

  @ApiProperty({ type: AuditActorDto, nullable: true })
  user!: AuditActorDto | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  feedbackId!: string | null;

  @ApiProperty({ type: AuditFeedbackRefDto, nullable: true })
  feedback!: AuditFeedbackRefDto | null;

  @ApiProperty({ nullable: true, type: Object, description: 'Previous value' })
  oldValue!: unknown;

  @ApiProperty({ nullable: true, type: Object, description: 'New value' })
  newValue!: unknown;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

type AuditWithRelations = AuditLog & {
  user: User | null;
  feedback: Pick<Feedback, 'id' | 'rawText'> | null;
};

export class PaginatedAuditDto {
  @ApiProperty({ type: [AuditLogItemDto] })
  data!: AuditLogItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 137 })
  total!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;

  static from(
    rows: AuditWithRelations[],
    meta: { page: number; pageSize: number; total: number },
  ): PaginatedAuditDto {
    const dto = new PaginatedAuditDto();
    dto.data = rows.map(toItem);
    dto.page = meta.page;
    dto.pageSize = meta.pageSize;
    dto.total = meta.total;
    dto.totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
    return dto;
  }
}

function toItem(row: AuditWithRelations): AuditLogItemDto {
  return {
    id: row.id,
    action: row.action,
    user: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
    feedbackId: row.feedbackId,
    feedback: row.feedback
      ? { id: row.feedback.id, excerpt: excerpt(row.feedback.rawText) }
      : null,
    oldValue: row.oldValue,
    newValue: row.newValue,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function excerpt(text: string): string {
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : text;
}
