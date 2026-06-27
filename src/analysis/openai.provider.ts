import { ConfigService } from '@nestjs/config';
import type { Provider } from '@nestjs/common';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './analysis.constants';

/**
 * Provides the OpenAI client, or `null` when no API key is configured (so the
 * app still boots and non-AI features work). The analyze endpoint surfaces a
 * 503 when it's null. Built-in retries + timeout handle transient failures.
 */
export const openAiProvider: Provider = {
  provide: OPENAI_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): OpenAI | null => {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;
    return new OpenAI({ apiKey, maxRetries: 2, timeout: 30_000 });
  },
};
