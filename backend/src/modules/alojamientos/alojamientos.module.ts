import { Module } from '@nestjs/common';
import { AlojamientosController } from './alojamientos.controller';
import { CatalogoService } from './services/catalogo.service';
import { CotizacionService } from './services/cotizacion.service';
import { OrdenesService } from './services/ordenes.service';
import { WebhooksService } from './services/webhooks.service';

/** Contrato "GDS Alojamientos Core API". El acceso a datos va por DbService (módulo global). */
@Module({
  controllers: [AlojamientosController],
  providers: [CotizacionService, CatalogoService, OrdenesService, WebhooksService],
  exports: [CotizacionService, OrdenesService],
})
export class AlojamientosModule {}
