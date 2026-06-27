import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let tx: {
    user: { upsert: jest.Mock };
    feedback: { create: jest.Mock };
  };
  let prisma: {
    feedback: { count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      user: { upsert: jest.fn() },
      feedback: { create: jest.fn() },
    };
    prisma = {
      feedback: { count: jest.fn(), findMany: jest.fn() },
      // Support both forms: callback (create) and array (list).
      $transaction: jest.fn((arg: unknown) =>
        Array.isArray(arg)
          ? Promise.all(arg)
          : (arg as (client: typeof tx) => unknown)(tx),
      ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(FeedbackService);
  });

  it('lists feedback with pagination, search, and sort applied', async () => {
    prisma.feedback.count.mockResolvedValue(42);
    prisma.feedback.findMany.mockResolvedValue([]);

    const result = await service.list({
      page: 2,
      pageSize: 20,
      status: 'pending',
      search: 'export',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const findArg = prisma.feedback.findMany.mock.calls[0] as [
      { skip: number; take: number; orderBy: Record<string, string> },
    ];
    expect(findArg[0].skip).toBe(20); // (page-1) * pageSize
    expect(findArg[0].take).toBe(20);
    expect(findArg[0].orderBy).toEqual({ createdAt: 'desc' });
    expect(result).toMatchObject({
      page: 2,
      pageSize: 20,
      total: 42,
      totalPages: 3,
      data: [],
    });
  });

  it('upserts the user and creates feedback, returning a mapped response', async () => {
    const dto: CreateFeedbackDto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      message: 'The export keeps timing out on large reports.',
    };

    tx.user.upsert.mockResolvedValue({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    tx.feedback.create.mockResolvedValue({
      id: 'fb-1',
      rawText: dto.message,
      source: 'web',
      status: 'pending',
      submittedById: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      submittedBy: {
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
    });

    const result = await service.create(dto);

    expect(tx.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'jane@example.com' } }),
    );
    const createCalls = tx.feedback.create.mock.calls as Array<
      [{ data: { rawText: string; source: string } }]
    >;
    expect(createCalls[0][0].data).toMatchObject({
      rawText: dto.message,
      source: 'web',
    });
    expect(result).toMatchObject({
      id: 'fb-1',
      rawText: dto.message,
      status: 'pending',
      source: 'web',
      submittedBy: { id: 'user-1', email: 'jane@example.com' },
    });
  });

  it('defaults the source to "web" when not provided', async () => {
    tx.user.upsert.mockResolvedValue({ id: 'u', name: null, email: 'a@b.com' });
    tx.feedback.create.mockResolvedValue({
      id: 'f',
      rawText: 'some message body',
      source: 'web',
      status: 'pending',
      submittedById: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedBy: { id: 'u', name: null, email: 'a@b.com' },
    });

    await service.create({
      name: 'Ab',
      email: 'a@b.com',
      message: 'some message body',
    });

    const createCalls = tx.feedback.create.mock.calls as Array<
      [{ data: { source: string } }]
    >;
    expect(createCalls[0][0].data.source).toBe('web');
  });
});
