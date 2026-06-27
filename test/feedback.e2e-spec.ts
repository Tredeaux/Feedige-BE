import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { applyGlobalConfig } from './../src/app.config';
import { AppModule } from './../src/app.module';

describe('Feedback (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyGlobalConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/feedback creates feedback and the submitting user', () => {
    return request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send({
        name: 'E2E Tester',
        email: 'e2e-tester@example.com',
        message: 'This is an end-to-end test feedback message.',
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as {
          id: string;
          rawText: string;
          source: string;
          status: string;
          submittedBy: { name: string | null; email: string };
        };
        expect(typeof body.id).toBe('string');
        expect(body).toMatchObject({
          rawText: 'This is an end-to-end test feedback message.',
          source: 'web',
          status: 'pending',
          submittedBy: { email: 'e2e-tester@example.com', name: 'E2E Tester' },
        });
      });
  });

  it('rejects an invalid payload with 400', () => {
    return request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send({ name: 'X', email: 'not-an-email', message: 'short' })
      .expect(400);
  });

  it('rejects unknown properties with 400 (whitelist)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send({
        name: 'Jane Doe',
        email: 'jane2@example.com',
        message: 'A perfectly valid feedback message here.',
        role: 'admin', // not allowed
      })
      .expect(400);
  });
});
