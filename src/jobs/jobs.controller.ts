import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuthErrors } from '../common/api-auth-errors.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES } from '../auth/roles';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginatedJobRunsDto } from './dto/job-run.dto';
import { JobSummaryDto } from './dto/job-summary.dto';
import { ListJobRunsQueryDto } from './dto/list-job-runs.query.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@ApiAuthErrors()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.TRIAGE)
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'List background jobs with live status' })
  @ApiOkResponse({ type: [JobSummaryDto] })
  list(): Promise<JobSummaryDto[]> {
    return this.jobs.listJobs();
  }

  @Get(':name/runs')
  @ApiOperation({ summary: 'Run history for a job (paginated, newest first)' })
  @ApiOkResponse({ type: PaginatedJobRunsDto })
  runs(
    @Param('name') name: string,
    @Query() query: ListJobRunsQueryDto,
  ): Promise<PaginatedJobRunsDto> {
    return this.jobs.listRuns(name, query);
  }
}
