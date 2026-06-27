import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { applyGlobalConfig } from './../src/app.config';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyGlobalConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/health (GET) reports status', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect((res) => {
        expect([200, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('status');
      });
  });
});
