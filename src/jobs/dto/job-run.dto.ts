import { ApiProperty } from '@nestjs/swagger';
import type { JobRun } from '@prisma/client';

export class JobRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'backlog-screener' })
  jobName!: string;

  @ApiProperty({ example: 'success', enum: ['success', 'noop', 'failed'] })
  status!: string;

  @ApiProperty()
  startedAt!: Date;

  @ApiProperty({ nullable: true })
  finishedAt!: Date | null;

  @ApiProperty({ nullable: true, example: 842 })
  durationMs!: number | null;

  @ApiProperty({ example: 1 })
  itemsProcessed!: number;

  @ApiProperty({ nullable: true })
  detail!: string | null;

  @ApiProperty({ nullable: true })
  error!: string | null;

  static fromEntity(run: JobRun): JobRunDto {
    const dto = new JobRunDto();
    dto.id = run.id;
    dto.jobName = run.jobName;
    dto.status = run.status;
    dto.startedAt = run.startedAt;
    dto.finishedAt = run.finishedAt;
    dto.durationMs = run.durationMs;
    dto.itemsProcessed = run.itemsProcessed;
    dto.detail = run.detail;
    dto.error = run.error;
    return dto;
  }
}

export class PaginatedJobRunsDto {
  @ApiProperty({ type: [JobRunDto] })
  data!: JobRunDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 137 })
  total!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;

  static from(
    rows: JobRun[],
    meta: { page: number; pageSize: number; total: number },
  ): PaginatedJobRunsDto {
    const dto = new PaginatedJobRunsDto();
    dto.data = rows.map((row) => JobRunDto.fromEntity(row));
    dto.page = meta.page;
    dto.pageSize = meta.pageSize;
    dto.total = meta.total;
    dto.totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
    return dto;
  }
}
