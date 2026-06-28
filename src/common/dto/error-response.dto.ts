import { ApiProperty } from '@nestjs/swagger';

/**
 * The consistent error body produced by {@link AllExceptionsFilter}. Referenced
 * by the `@Api*Response` decorators so the OpenAPI docs show real error shapes.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 404, description: 'HTTP status code' })
  statusCode!: number;

  @ApiProperty({
    description:
      'Human-readable message. A string, or an array of strings for validation failures.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Resource not found.',
  })
  message!: string | string[];

  @ApiProperty({ example: '2026-06-28T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/feedback/123' })
  path!: string;
}
