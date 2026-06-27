import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';

/**
 * Applies the HTTP contract shared by the running app and e2e tests: global
 * `/api` prefix, URI versioning, and the global ValidationPipe. Server-only
 * concerns (Helmet, CORS, Swagger, logging) stay in `main.ts`.
 */
export function applyGlobalConfig(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
