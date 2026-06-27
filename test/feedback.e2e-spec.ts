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

  it('GET /api/v1/feedback requires authentication (401)', () => {
    return request(app.getHttpServer()).get('/api/v1/feedback').expect(401);
  });

  it('GET /api/v1/feedback/stats requires authentication (401)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/feedback/stats')
      .expect(401);
  });

  it('GET /api/v1/feedback/stats returns aggregate analytics for a triager', async () => {
    let token = '';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Stats Triager',
        email: `stats-${Date.now()}@feedige.dev`,
        password: 'a-strong-password',
      })
      .expect(201)
      .expect((res) => {
        token = (res.body as { accessToken: string }).accessToken;
      });

    await request(app.getHttpServer())
      .get('/api/v1/feedback/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          totalFeedback: number;
          byStatus: unknown[];
          bySentiment: unknown[];
          byPriority: unknown[];
          topThemes: unknown[];
        };
        expect(typeof body.totalFeedback).toBe('number');
        expect(Array.isArray(body.byStatus)).toBe(true);
        expect(Array.isArray(body.bySentiment)).toBe(true);
        expect(Array.isArray(body.byPriority)).toBe(true);
        expect(Array.isArray(body.topThemes)).toBe(true);
      });
  });

  it('PATCH /api/v1/feedback/:id/status requires authentication (401)', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/feedback/00000000-0000-0000-0000-000000000000/status')
      .send({ status: 'reviewed' })
      .expect(401);
  });

  it('updates feedback status for a triager', async () => {
    let token = '';
    let feedbackId = '';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Status Triager',
        email: `status-${Date.now()}@feedige.dev`,
        password: 'a-strong-password',
      })
      .expect(201)
      .expect((res) => {
        token = (res.body as { accessToken: string }).accessToken;
      });

    await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send({
        name: 'Reporter',
        email: `reporter-${Date.now()}@example.com`,
        message: 'Status change end-to-end test message.',
      })
      .expect(201)
      .expect((res) => {
        feedbackId = (res.body as { id: string }).id;
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/feedback/${feedbackId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'reviewed' })
      .expect(200)
      .expect((res) => {
        expect((res.body as { status: string }).status).toBe('reviewed');
      });
  });

  it('GET /api/v1/feedback returns a paginated list for a triager', async () => {
    // Registering grants the triage role.
    const email = `triager-${Date.now()}@feedige.dev`;
    let token = '';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Triager', email, password: 'a-strong-password' })
      .expect(201)
      .expect((res) => {
        token = (res.body as { accessToken: string }).accessToken;
      });

    await request(app.getHttpServer())
      .get(
        '/api/v1/feedback?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          data: unknown[];
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.page).toBe(1);
        expect(body.pageSize).toBe(20);
        expect(typeof body.total).toBe('number');
        expect(typeof body.totalPages).toBe('number');
      });
  });
});
