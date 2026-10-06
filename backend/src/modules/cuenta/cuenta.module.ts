import { Module } from '@nestjs/common';
import { AlojamientosModule } from '../alojamientos/alojamientos.module';
import { CuentaController } from './cuenta.controller';
import { CuentaService } from './cuenta.service';

@Module({
  imports: [AlojamientosModule],
  controllers: [CuentaController],
  providers: [CuentaService],
  exports: [CuentaService],
})
export class CuentaModule {}
