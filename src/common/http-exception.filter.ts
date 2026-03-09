import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponseBody {
  success: false;
  code: string;
  message: string;
  correlationId?: string;
  timestamp: string;
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.body?.id as string) ||
      (request.headers['x-correlation-id'] as string) ||
      undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'message' in res) {
        const msg = (res as { message?: string | string[] }).message;
        message = Array.isArray(msg) ? msg[0] ?? message : msg ?? message;
      } else if (typeof res === 'string') {
        message = res;
      }
      if (status === HttpStatus.UNAUTHORIZED) code = 'UNAUTHORIZED';
      else if (status === HttpStatus.BAD_REQUEST) code = 'BAD_REQUEST';
      else if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
      else code = 'HTTP_ERROR';
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    }

    const body: ErrorResponseBody = {
      success: false,
      code,
      message,
      ...(correlationId && { correlationId }),
      timestamp: new Date().toISOString(),
    };

    if (correlationId) {
      response.setHeader('X-Correlation-Id', correlationId);
    }

    response.status(status).json(body);
  }
}
