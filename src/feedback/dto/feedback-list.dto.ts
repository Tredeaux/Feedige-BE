import { ApiProperty } from '@nestjs/swagger';
import type { Feedback, FeedbackAnalysis, User } from '@prisma/client';

class ListSubmitterDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty()
  email!: string;
}

class ListAnalysisDto {
  @ApiProperty({ example: 'negative' })
  sentiment!: string;

  @ApiProperty({ example: 'high' })
  priority!: string;

  @ApiProperty({ nullable: true })
  summary!: string | null;

  @ApiProperty({ example: 0.92 })
  confidence!: number;

  @ApiProperty({ type: [String] })
  keyThemes!: string[];

  @ApiProperty({ type: [String] })
  recommendedActions!: string[];

  @ApiProperty({ example: 'gpt-4o-mini' })
  modelUsed!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty()
  analyzedAt!: Date;
}

export class FeedbackListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  rawText!: string;

  @ApiProperty()
  source!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: ListSubmitterDto, nullable: true })
  submittedBy!: ListSubmitterDto | null;

  @ApiProperty({
    type: ListAnalysisDto,
    nullable: true,
    description: 'Most recent analysis, if any',
  })
  latestAnalysis!: ListAnalysisDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

type FeedbackWithRelations = Feedback & {
  submittedBy: User | null;
  analyses: FeedbackAnalysis[];
};

export class PaginatedFeedbackDto {
  @ApiProperty({ type: [FeedbackListItemDto] })
  data!: FeedbackListItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 137 })
  total!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;

  static from(
    rows: FeedbackWithRelations[],
    meta: { page: number; pageSize: number; total: number },
  ): PaginatedFeedbackDto {
    const dto = new PaginatedFeedbackDto();
    dto.data = rows.map((row) => toItem(row));
    dto.page = meta.page;
    dto.pageSize = meta.pageSize;
    dto.total = meta.total;
    dto.totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
    return dto;
  }
}

function toItem(row: FeedbackWithRelations): FeedbackListItemDto {
  const latest = row.analyses[0];
  return {
    id: row.id,
    rawText: row.rawText,
    source: row.source,
    status: row.status,
    submittedBy: row.submittedBy
      ? {
          id: row.submittedBy.id,
          name: row.submittedBy.name,
          email: row.submittedBy.email,
        }
      : null,
    latestAnalysis: latest
      ? {
          sentiment: latest.sentiment,
          priority: latest.priority,
          summary: latest.summary,
          confidence: Number(latest.confidence),
          keyThemes: latest.keyThemes,
          recommendedActions: latest.recommendedActions,
          modelUsed: latest.modelUsed,
          version: latest.version,
          analyzedAt: latest.analyzedAt,
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
