import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

/** Error with a stable machine code, e.g. INVALID_CREDENTIALS, OUTSIDE_GEOFENCE. */
export class Api_Error extends HttpException {
  constructor(status: HttpStatus, readonly code: string, detail: string, readonly errors?: unknown[]) {
    super(detail, status);
  }
}

/** Every error leaves the API as RFC 9457 application/problem+json (spec section 10). */
@Catch()
export class Problem_Json_Filter implements ExceptionFilter {
  private readonly logger = new Logger('Problem_Json_Filter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let detail = 'Unexpected error';
    let errors: unknown[] | undefined;

    if (exception instanceof Api_Error) {
      status = exception.getStatus();
      code = exception.code;
      detail = exception.message;
      errors = exception.errors;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HttpStatus[status] ?? 'HTTP_ERROR';
      detail = exception.message;
    } else {
      // Logs must never contain personal data (spec section 3.7) - message only.
      this.logger.error((exception as Error)?.message ?? String(exception));
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({ type: `https://errors.carservices.app/${code}`, title: HttpStatus[status], status, code, detail, errors });
  }
}
