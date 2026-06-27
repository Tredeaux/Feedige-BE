import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { applyGlobalConfig } from './../src/app.config';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  // Unique email per run so repeated local runs don't collide.
  const email = `admin-${Date.now()}@feedige.dev`;
  const password = 'a-strong-password';

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

  it('registers, logs in, and returns the current user', async () => {
    let token = '';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Admin User', email, password })
      .expect(201)
      .expect((res) => {
        const body = res.body as {
          accessToken: string;
          user: { email: string; role: string };
        };
        expect(typeof body.accessToken).toBe('string');
        expect(body.user.email).toBe(email);
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
      .expect((res) => {
        const body = res.body as { accessToken: string };
        token = body.accessToken;
        expect(typeof body.accessToken).toBe('string');
      });

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as { email: string };
        expect(body.email).toBe(email);
      });
  });

  it('rejects duplicate registration with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Dupe', email, password })
      .expect(409);
  });

  it('rejects bad credentials with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('rejects /auth/me without a token (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
