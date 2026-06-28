import { CronExpression } from '@nestjs/schedule';

/** Cron name of the backlog screener (shared with the @Cron decorator). */
export const BACKLOG_SCREENER = 'backlog-screener';

/** Outcome statuses recorded for a job run. */
export const JOB_RUN_STATUSES = ['success', 'noop', 'failed'] as const;
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export interface JobDefinition {
  /** Cron name registered with SchedulerRegistry (and stored as job_run.jobName). */
  name: string;
  displayName: string;
  description: string;
  /** Human-readable cadence, e.g. "Every minute". */
  schedule: string;
  cronExpression: string;
  /** Config flag that enables/disables the job, if any. */
  enabledConfigKey?: string;
  /** Whether the job needs OpenAI configured to do work. */
  requiresAi?: boolean;
}

/** Registry of monitored background jobs. */
export const JOB_DEFINITIONS: Record<string, JobDefinition> = {
  [BACKLOG_SCREENER]: {
    name: BACKLOG_SCREENER,
    displayName: 'Backlog analysis screener',
    description:
      'Analyzes the oldest unanalyzed feedback item, one per run, until the backlog is clear.',
    schedule: 'Every minute',
    cronExpression: CronExpression.EVERY_MINUTE,
    enabledConfigKey: 'BACKLOG_ANALYSIS_ENABLED',
    requiresAi: true,
  },
};
