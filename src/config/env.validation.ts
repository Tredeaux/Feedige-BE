import * as Joi from 'joi';

/**
 * Validation schema for environment variables. The app refuses to boot if
 * any required variable is missing or malformed (see ConfigModule in
 * `app.module.ts`).
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  CORS_ORIGIN: Joi.string().default('*'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  // Secret used to sign JWTs. Required — keep it long and random in real envs.
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  // AI analysis (OpenAI). Optional so the app boots without it; the analyze
  // endpoint returns 503 until a key is configured.
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
});
