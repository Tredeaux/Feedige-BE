import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { applyGlobalConfig } from './../src/app.config';
import { AppModule } from './../src/app.module';

describe('Analysis (e2e)', () => {
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

  it('POST /api/v1/feedback/:id/analyze requires authentication (401)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/feedback/00000000-0000-0000-0000-000000000000/analyze')
      .expect(401);
  });
});
