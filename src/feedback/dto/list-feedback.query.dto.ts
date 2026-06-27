import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const FEEDBACK_STATUSES = [
  'pending',
  'reviewed',
  'actioned',
  'archived',
] as const;

export const FEEDBACK_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'status',
] as const;

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ListFeedbackQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    enum: FEEDBACK_STATUSES,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsIn(FEEDBACK_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by source (e.g. web, email)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @ApiPropertyOptional({ description: 'Search feedback text and submitter' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: FEEDBACK_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(FEEDBACK_SORT_FIELDS)
  sortBy: (typeof FEEDBACK_SORT_FIELDS)[number] = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
