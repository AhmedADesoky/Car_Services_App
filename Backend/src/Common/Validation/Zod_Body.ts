import { HttpStatus } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { Api_Error } from '../Errors/Problem_Json_Filter';

/** Parse a request body with zod; invalid input becomes a 400 VALIDATION_FAILED problem. */
export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Api_Error(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Request body is invalid',
      result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
