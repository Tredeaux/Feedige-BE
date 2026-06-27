import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OPENAI_CLIENT } from './analysis.constants';
import { AnalysisService } from './analysis.service';

const VALID_OUTPUT = {
  sentiment: 'negative',
  priority: 'high',
  summary: 'Customer is blocked by export timeouts.',
  confidence: 0.92,
  keyThemes: ['export', 'performance'],
  recommendedActions: ['Investigate export timeout'],
};

interface Mocks {
  openai: { chat: { completions: { create: jest.Mock } } };
  prisma: {
    feedback: { findUnique: jest.Mock };
    feedbackAnalysis: { findFirst: jest.Mock; create: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
}

async function buildService(
  openaiClient: unknown,
  mocks: Mocks,
): Promise<AnalysisService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AnalysisService,
      { provide: OPENAI_CLIENT, useValue: openaiClient },
      {
        provide: ConfigService,
        useValue: { get: (_k: string, d?: unknown) => d ?? 'gpt-4o-mini' },
      },
      { provide: PrismaService, useValue: mocks.prisma },
    ],
  }).compile();
  return moduleRef.get(AnalysisService);
}

function makeMocks(content: string): Mocks {
  const tx = {
    feedbackAnalysis: {
      create: jest.fn().mockResolvedValue({
        id: 'a1',
        feedbackId: 'f1',
        version: 1,
        sentiment: VALID_OUTPUT.sentiment,
        priority: VALID_OUTPUT.priority,
        summary: VALID_OUTPUT.summary,
        confidence: 0.92,
        keyThemes: VALID_OUTPUT.keyThemes,
        recommendedActions: VALID_OUTPUT.recommendedActions,
        modelUsed: 'gpt-4o-mini',
        analyzedAt: new Date('2026-01-01T00:00:00Z'),
        analyzedById: 'u1',
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    openai: {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content } }],
          }),
        },
      },
    },
    prisma: {
      feedback: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'f1', rawText: 'export is slow' }),
      },
      feedbackAnalysis: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
    },
  };
}

describe('AnalysisService', () => {
  it('analyzes feedback and persists a validated result', async () => {
    const mocks = makeMocks(JSON.stringify(VALID_OUTPUT));
    const service = await buildService(mocks.openai, mocks);

    const result = await service.analyzeFeedback('f1', 'u1');

    expect(mocks.openai.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      feedbackId: 'f1',
      version: 1,
      sentiment: 'negative',
      priority: 'high',
      confidence: 0.92,
    });
  });

  it('throws 503 when no OpenAI client is configured', async () => {
    const mocks = makeMocks(JSON.stringify(VALID_OUTPUT));
    const service = await buildService(null, mocks);

    await expect(service.analyzeFeedback('f1', 'u1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects an invalid model output (422)', async () => {
    const mocks = makeMocks(
      JSON.stringify({ ...VALID_OUTPUT, sentiment: 'furious' }),
    );
    const service = await buildService(mocks.openai, mocks);

    await expect(service.analyzeFeedback('f1', 'u1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
