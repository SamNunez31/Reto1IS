import { Module } from '@nestjs/common';
import { AuditoriaConsumidor, BusEventos } from './bus-eventos';
import { JobsService } from './jobs.service';

@Module({
  providers: [BusEventos, AuditoriaConsumidor, JobsService],
  exports: [JobsService, BusEventos],
})
export class JobsModule {}
