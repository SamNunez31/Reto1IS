import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Observable } from 'rxjs';

/** Agrega X-API-Deprecation-Date (fecha prevista de baja de la versión) como pide el contrato. */
@Injectable()
export class DeprecacionInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    ctx.switchToHttp().getResponse<Response>().setHeader('X-API-Deprecation-Date', this.config.get<string>('API_DEPRECATION_DATE') ?? '');
    return next.handle();
  }
}
