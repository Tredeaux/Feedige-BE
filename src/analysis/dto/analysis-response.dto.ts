import { ApiProperty } from '@nestjs/swagger';
import type { FeedbackAnalysis } from '@prisma/client';

export class AnalysisResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  feedbackId!: string;

  @ApiProperty({ example: 1 })
  version!: number;

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

  @ApiProperty()
  analyzedAt!: Date;

  static fromEntity(a: FeedbackAnalysis): AnalysisResponseDto {
    const dto = new AnalysisResponseDto();
    dto.id = a.id;
    dto.feedbackId = a.feedbackId;
    dto.version = a.version;
    dto.sentiment = a.sentiment;
    dto.priority = a.priority;
    dto.summary = a.summary;
    dto.confidence = Number(a.confidence); // Prisma Decimal -> number
    dto.keyThemes = a.keyThemes;
    dto.recommendedActions = a.recommendedActions;
    dto.modelUsed = a.modelUsed;
    dto.analyzedAt = a.analyzedAt;
    return dto;
  }
}
