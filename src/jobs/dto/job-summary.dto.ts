import { ApiProperty } from '@nestjs/swagger';
import { JobRunDto } from './job-run.dto';

export class JobTotalsDto {
  @ApiProperty({ example: 120 })
  total!: number;

  @ApiProperty({ example: 98 })
  success!: number;

  @ApiProperty({ example: 20 })
  noop!: number;

  @ApiProperty({ example: 2 })
  failed!: number;

  @ApiProperty({ example: 98 })
  itemsProcessed!: number;
}

/** Live status of a background job for the cron monitor. */
export class JobSummaryDto {
  @ApiProperty({ example: 'backlog-screener' })
  name!: string;

  @ApiProperty({ example: 'Backlog analysis screener' })
  displayName!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ example: 'Every minute' })
  schedule!: string;

  @ApiProperty({ example: '*/1 * * * *' })
  cronExpression!: string;

  @ApiProperty({ description: 'Whether the job is enabled by configuration' })
  enabled!: boolean;

  @ApiProperty({ description: 'Whether AI (OpenAI) is configured' })
  aiConfigured!: boolean;

  @ApiProperty({
    enum: ['healthy', 'degraded', 'disabled', 'idle'],
    description:
      'healthy = running and last run ok; degraded = last run failed; disabled = turned off; idle = enabled but AI not configured',
  })
  health!: string;

  @ApiProperty({ nullable: true, description: 'Next scheduled run (ISO)' })
  nextRunAt!: Date | null;

  @ApiProperty({ type: JobRunDto, nullable: true })
  lastRun!: JobRunDto | null;

  @ApiProperty({ type: JobTotalsDto })
  totals!: JobTotalsDto;
}
