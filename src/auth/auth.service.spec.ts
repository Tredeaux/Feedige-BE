import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('registers a new user and returns a token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      name: 'Jane Admin',
      email: 'jane@feedige.dev',
      role: 'triage',
      passwordHash: 'hashed',
    });

    const result = await service.register({
      name: 'Jane Admin',
      email: 'jane@feedige.dev',
      password: 'a-strong-password',
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toMatchObject({
      id: 'u1',
      email: 'jane@feedige.dev',
      role: 'triage',
    });
    // The plaintext password must never be persisted.
    const createArg = prisma.user.create.mock.calls[0] as [
      { data: { passwordHash: string } },
    ];
    expect(createArg[0].data.passwordHash).not.toBe('a-strong-password');
  });

  it('rejects registration when a password account already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'x' });

    await expect(
      service.register({
        name: 'Jane',
        email: 'jane@feedige.dev',
        password: 'a-strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('a-strong-password', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Jane',
      email: 'jane@feedige.dev',
      role: 'triage',
      passwordHash,
    });

    const result = await service.login({
      email: 'jane@feedige.dev',
      password: 'a-strong-password',
    });

    expect(result.accessToken).toBe('signed.jwt.token');
  });

  it('rejects login with a wrong password', async () => {
    const passwordHash = await bcrypt.hash('the-real-password', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'jane@feedige.dev',
      role: 'triage',
      passwordHash,
    });

    await expect(
      service.login({ email: 'jane@feedige.dev', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
