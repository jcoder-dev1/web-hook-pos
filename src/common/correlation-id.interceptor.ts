import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest<{ body?: { id?: string }; headers?: Record<string, string> }>();
    const correlationId =
      request.body?.id || request.headers?.['x-correlation-id'];
    return next.handle().pipe(
      tap((data: { webhookId?: string }) => {
        const id = correlationId || (data && typeof data === 'object' && data.webhookId);
        if (id && response.getHeader('X-Correlation-Id') == null) {
          response.setHeader('X-Correlation-Id', String(id));
        }
      }),
    );
  }
}
