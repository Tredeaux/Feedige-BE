import type { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalysisService } from './analysis.service';
import { BacklogService } from './backlog.service';

interface Harness {
  service: BacklogService;
  analyze: jest.Mock;
  findFirst: jest.Mock;
}

function build(opts: {
  enabled: boolean;
  hasOpenai: boolean;
  nextId: string | null;
}): Harness {
  const analyze = jest.fn().mockResolvedValue({});
  const findFirst = jest
    .fn()
    .mockResolvedValue(opts.nextId ? { id: opts.nextId } : null);

  const config = {
    get: jest.fn().mockReturnValue(opts.enabled),
  } as unknown as ConfigService;
  const prisma = {
    feedback: { findFirst },
  } as unknown as PrismaService;
  const analysis = {
    analyzeFeedback: analyze,
  } as unknown as AnalysisService;
  const openai = (opts.hasOpenai ? {} : null) as OpenAI | null;

  const service = new BacklogService(openai, config, prisma, analysis);
  return { service, analyze, findFirst };
}

describe('BacklogService', () => {
  it('analyzes the oldest unscreened item (as a system run)', async () => {
    const { service, analyze } = build({
      enabled: true,
      hasOpenai: true,
      nextId: 'f1',
    });

    await service.screenNext();

    expect(analyze).toHaveBeenCalledWith('f1', null);
  });

  it('does nothing when the backlog is empty', async () => {
    const { service, analyze } = build({
      enabled: true,
      hasOpenai: true,
      nextId: null,
    });

    await service.screenNext();

    expect(analyze).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', async () => {
    const { service, analyze, findFirst } = build({
      enabled: false,
      hasOpenai: true,
      nextId: 'f1',
    });

    await service.screenNext();

    expect(findFirst).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
  });

  it('does nothing when OpenAI is not configured', async () => {
    const { service, analyze } = build({
      enabled: true,
      hasOpenai: false,
      nextId: 'f1',
    });

    await service.screenNext();

    expect(analyze).not.toHaveBeenCalled();
  });
});
