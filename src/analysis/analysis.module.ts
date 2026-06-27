import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { openAiProvider } from './openai.provider';

@Module({
  controllers: [AnalysisController],
  providers: [AnalysisService, openAiProvider],
})
export class AnalysisModule {}
