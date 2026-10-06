import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DeprecacionInterceptor } from './http/deprecacion.interceptor';
import { IdempotenciaInterceptor } from './idempotencia/idempotencia.interceptor';

/** Piezas transversales: JWT (HS256), cabeceras del contrato e idempotencia. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256', expiresIn: config.get<string>('JWT_EXPIRES_IN') },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [DeprecacionInterceptor, IdempotenciaInterceptor],
  exports: [JwtModule, DeprecacionInterceptor, IdempotenciaInterceptor],
})
export class CommonModule {}
