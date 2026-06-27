import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { applyGlobalConfig } from './app.config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino as the application logger.
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const corsOrigin = config.get<string>('CORS_ORIGIN', '*');

  // Security headers.
  app.use(helmet());

  // CORS — explicit allow-list in real environments (set CORS_ORIGIN). "*"
  // reflects any origin and is intended for local dev only. Credentials are not
  // enabled because auth uses Bearer tokens, not cookies — so "*" here does not
  // expose credentialed cross-origin requests.
  app.enableCors({
    origin:
      corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
  });

  // Routing (/api prefix, URI versioning) + global ValidationPipe.
  applyGlobalConfig(app);

  // Flush Prisma connections etc. on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // OpenAPI / Swagger at /api/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Feedige API')
    .setDescription('Feedige backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
}

void bootstrap();
