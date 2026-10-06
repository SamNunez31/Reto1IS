import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../app.module';
import { crearDocumentoOpenApi } from '../swagger';

/**
 * npm run docs:openapi -> ../docs/openapi.json
 * Usa el modo "preview" de Nest: arma las rutas sin instanciar proveedores (no se conecta a la BD).
 */
async function generar(): Promise<void> {
  process.env.DATABASE_URL ??= 'postgres://sin-conexion/preview';
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  const doc = crearDocumentoOpenApi(app);
  const destino = join(__dirname, '..', '..', '..', 'docs');
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'openapi.json'), JSON.stringify(doc, null, 2));
  console.log(`OpenAPI generado: ${Object.keys(doc.paths).length} rutas -> docs/openapi.json`);
  await app.close();
}

generar().catch((e) => {
  console.error(e);
  process.exit(1);
});
