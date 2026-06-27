import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Request body for submitting feedback. Mirrors the frontend form contract
 * (`src/lib/feedback.ts` in Feedige-FE) — keep them in sync.
 */
export class CreateFeedbackDto {
  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 255 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example:
      'The CSV export times out on large reports and blocks my workflow.',
    minLength: 10,
    maxLength: 2000,
  })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ example: 'web', default: 'web', maxLength: 50 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  source?: string;
}
