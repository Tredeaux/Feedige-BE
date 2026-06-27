import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { BacklogService } from './backlog.service';
import { openAiProvider } from './openai.provider';

@Module({
  controllers: [AnalysisController],
  providers: [AnalysisService, BacklogService, openAiProvider],
})
export class AnalysisModule {}
