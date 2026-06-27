import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let tx: {
    user: { upsert: jest.Mock };
    feedback: { create: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      user: { upsert: jest.fn() },
      feedback: { create: jest.fn() },
    };
    const prismaMock = {
      // Run the callback with our fake transactional client.
      $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(FeedbackService);
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
