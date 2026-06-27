import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { FEEDBACK_STATUSES } from './list-feedback.query.dto';

export class UpdateFeedbackStatusDto {
  @ApiProperty({ enum: FEEDBACK_STATUSES, example: 'reviewed' })
  @IsIn(FEEDBACK_STATUSES)
  status!: (typeof FEEDBACK_STATUSES)[number];
}
