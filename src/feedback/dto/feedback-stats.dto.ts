import { ApiProperty } from '@nestjs/swagger';

class CountBucket {
  @ApiProperty({ example: 'pending' })
  label!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

class ThemeCount {
  @ApiProperty({ example: 'performance' })
  theme!: string;

  @ApiProperty({ example: 7 })
  count!: number;
}

export class FeedbackStatsDto {
  @ApiProperty({ example: 137 })
  totalFeedback!: number;

  @ApiProperty({ example: 90 })
  analyzedFeedback!: number;

  @ApiProperty({ example: 47 })
  unanalyzedFeedback!: number;

  @ApiProperty({ nullable: true, example: 0.81 })
  averageConfidence!: number | null;

  @ApiProperty({ type: [CountBucket] })
  byStatus!: CountBucket[];

  @ApiProperty({ type: [CountBucket] })
  bySentiment!: CountBucket[];

  @ApiProperty({ type: [CountBucket] })
  byPriority!: CountBucket[];

  @ApiProperty({ type: [ThemeCount] })
  topThemes!: ThemeCount[];
}
