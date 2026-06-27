import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import type OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANALYSIS_JSON_SCHEMA,
  ANALYSIS_PRIORITIES,
  ANALYSIS_SENTIMENTS,
  ANALYSIS_SYSTEM_PROMPT,
  type AnalysisResult,
  OPENAI_CLIENT,
} from './analysis.constants';
import { AnalysisResponseDto } from './dto/analysis-response.dto';

// Validate what the model returns before trusting/persisting it.
const analysisResultSchema = Joi.object<AnalysisResult>({
  sentiment: Joi.string()
    .valid(...ANALYSIS_SENTIMENTS)
    .required(),
  priority: Joi.string()
    .valid(...ANALYSIS_PRIORITIES)
    .required(),
  summary: Joi.string().allow('').max(1000).required(),
  confidence: Joi.number().min(0).max(1).required(),
  keyThemes: Joi.array().items(Joi.string().max(60)).max(10).required(),
  recommendedActions: Joi.array()
    .items(Joi.string().max(280))
    .max(10)
    .required(),
});

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI | null,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Run AI analysis on a feedback item and persist a new analysis version.
   * `analyzedById` is null for system/automated runs (the backlog screener).
   */
  async analyzeFeedback(
    feedbackId: string,
    analyzedById: string | null,
  ): Promise<AnalysisResponseDto> {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: { id: true, rawText: true },
    });
    if (!feedback) {
      throw new NotFoundException('Feedback not found.');
    }

    const result = await this.runModel(feedback.rawText);
    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

    // Re-analyses are kept as new versions.
    const last = await this.prisma.feedbackAnalysis.findFirst({
      where: { feedbackId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    const analysis = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feedbackAnalysis.create({
        data: {
          feedbackId,
          version,
          sentiment: result.sentiment,
          priority: result.priority,
          summary: result.summary,
          confidence: result.confidence,
          keyThemes: result.keyThemes,
          recommendedActions: result.recommendedActions,
          modelUsed: model,
          analyzedById,
        },
      });
      await tx.auditLog.create({
        data: {
          feedbackId,
          userId: analyzedById,
          action: version === 1 ? 'analysis_created' : 're_analyzed',
          newValue: {
            version,
            sentiment: result.sentiment,
            priority: result.priority,
            model,
          },
        },
      });
      return created;
    });

    return AnalysisResponseDto.fromEntity(analysis);
  }

  private async runModel(text: string): Promise<AnalysisResult> {
    if (!this.openai) {
      throw new ServiceUnavailableException(
        'AI analysis is not configured. Set OPENAI_API_KEY.',
      );
    }

    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    let content: string | null;
    try {
      const completion = await this.openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: ANALYSIS_JSON_SCHEMA,
        },
      });
      content = completion.choices[0]?.message?.content ?? null;
    } catch (err) {
      this.logger.error(
        'OpenAI request failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw new ServiceUnavailableException(
        'AI analysis failed. Please try again.',
      );
    }

    if (!content) {
      throw new ServiceUnavailableException('AI analysis returned no content.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new UnprocessableEntityException('AI returned malformed output.');
    }

    const validation: Joi.ValidationResult<AnalysisResult> =
      analysisResultSchema.validate(parsed, {
        stripUnknown: true,
        convert: true,
      });
    if (validation.error) {
      this.logger.error(
        `AI output failed validation: ${validation.error.message}`,
      );
      throw new UnprocessableEntityException(
        'AI returned an unexpected response shape.',
      );
    }
    return validation.value;
  }
}
