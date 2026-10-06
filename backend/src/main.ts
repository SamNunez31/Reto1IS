import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { crearValidationPipe } from './common/validation/validation';
import { correlacionMiddleware, errorParserMiddleware, redireccionHttpsMiddleware } from './common/middleware/http-middlewares';
import { esProduccion, origenesCors } from './config/entorno';
import { montarSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const produccion = esProduccion();

  app.set('trust proxy', 1); // Render/Vercel están detrás de un proxy: IP real para el rate limit
  app.use(correlacionMiddleware);
  if (produccion) app.use(redireccionHttpsMiddleware);
  app.use(
    helmet({
      hsts: produccion ? { maxAge: 15_552_000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(errorParserMiddleware);

  app.enableCors({
    origin: origenesCors(),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Device-Fingerprint', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id', 'Retry-After', 'Idempotent-Replayed', 'X-API-Deprecation-Date'],
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(crearValidationPipe());
  app.enableShutdownHooks();
  montarSwagger(app);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
