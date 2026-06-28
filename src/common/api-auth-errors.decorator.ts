import { applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './dto/error-response.dto';

/**
 * Standard 401/403 responses for routes behind `JwtAuthGuard` + `RolesGuard`.
 * Applies to a controller class or a single handler.
 */
export function ApiAuthErrors(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Missing or invalid bearer token',
      type: ErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: 'Authenticated but lacks the required role',
      type: ErrorResponseDto,
    }),
  );
}
