import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | object;
  timestamp: string;
  path: string;
}

/**
 * Catch-all exception filter: consistent error shape, Prisma errors mapped to
 * sensible HTTP statuses, and 5xx internals logged server-side but never leaked
 * to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message } = mapPrismaError(exception));
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      // Don't leak internals for unexpected 5xx errors.
      message:
        status >= HttpStatus.INTERNAL_SERVER_ERROR &&
        !(exception instanceof HttpException)
          ? 'Internal server error'
          : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
  status: number;
  message: string;
} {
  switch (error.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        message: 'Resource already exists.',
      };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found.' };
    default:
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request.' };
  }
}
