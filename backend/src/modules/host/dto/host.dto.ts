import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUrl, Length, Matches, Max,
  MaxLength, Min, ValidateNested,
} from 'class-validator';
import { LATITUD_EC, LONGITUD_EC, MENSAJE_TELEFONO_EC, NormalizarTelefono, Sanitizar, TELEFONO_EC } from '../../../common/validation/validadores-ec';
import { SinRepeticiones } from '../../../common/validation/texto-libre';
import { FECHA, MSG_FECHA } from '../../alojamientos/dto/comunes.dto';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Posada EC confirma cada reserva al aprobarse el pago: solo se admite INSTANTANEA.
 * (El valor SOLICITUD sigue en el enum de la BD por historia, pero ya no se puede elegir.)
 */
export enum ModoReserva {
  INSTANTANEA = 'INSTANTANEA',
}

export class ImagenDto {
  /** URL https de la imagen */
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsBoolean()
  es_portada?: boolean;
}

export class AeropuertoCercanoDto {
  @IsInt()
  @Min(1)
  aeropuerto_id: number;

  @IsNumber()
  @Min(0)
  @Max(9999)
  distancia_km: number;

  @IsInt()
  @Min(0)
  @Max(3000)
  tiempo_min: number;

  @IsOptional()
  @IsBoolean()
  ofrece_transfer?: boolean;
}

export class CrearAlojamientoDto {
  @IsInt() @Min(1) tipo_id: number;
  @IsInt() @Min(1) ciudad_id: number;
  @IsInt() @Min(1) politica_id: number;

  @Sanitizar() @IsString() @Length(3, 140) @SinRepeticiones() nombre: string;
  @Sanitizar() @IsString() @Length(20, 5000) @SinRepeticiones() descripcion: string;
  @Sanitizar() @IsString() @Length(5, 200) direccion: string;

  /** Latitud dentro de Ecuador (-5 a 2) */
  @IsNumber() @Min(LATITUD_EC.min) @Max(LATITUD_EC.max) latitud: number;
  /** Longitud dentro de Ecuador (-93 a -75, incluye Galápagos) */
  @IsNumber() @Min(LONGITUD_EC.min) @Max(LONGITUD_EC.max) longitud: number;

  @IsOptional() @NormalizarTelefono() @Matches(TELEFONO_EC, { message: MENSAJE_TELEFONO_EC }) telefono_contacto?: string;
  @IsOptional() @Matches(HORA, { message: 'formato HH:MM' }) hora_checkin?: string;
  @IsOptional() @Matches(HORA, { message: 'formato HH:MM' }) hora_checkout?: string;
  @IsOptional() @IsInt() @Min(1) @Max(365) noches_min?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) noches_max?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) tarifa_limpieza?: number;
  @IsOptional() @IsEnum(ModoReserva, { message: 'modo_reserva: solo se admite reserva inmediata (INSTANTANEA)' }) modo_reserva?: ModoReserva;
  @IsOptional() @Sanitizar() @IsString() @MaxLength(3000) reglas_casa?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) categoria_estrellas?: number;
  @IsOptional() @Sanitizar() @IsString() @MaxLength(30) registro_turismo?: string;
  @IsOptional() @Sanitizar() @IsString() @MaxLength(30) luaf?: string;

  /** Ids de amenidades (reemplaza la lista completa) */
  @IsOptional() @IsArray() @ArrayMaxSize(80) @IsInt({ each: true }) amenidades?: number[];

  /** Imágenes (reemplaza la lista completa) */
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ImagenDto) imagenes?: ImagenDto[];

  /** Aeropuertos cercanos (reemplaza la lista completa) */
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AeropuertoCercanoDto)
  aeropuertos?: AeropuertoCercanoDto[];
}

export class ActualizarAlojamientoDto extends PartialType(CrearAlojamientoDto) {}

export class UnidadDto {
  @Sanitizar() @IsString() @Length(2, 100) nombre: string;
  @IsInt() @Min(1) @Max(30) capacidad_huespedes: number;
  @IsOptional() @IsInt() @Min(0) @Max(50) num_habitaciones?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) num_camas?: number;
  @IsOptional() @IsInt() @Min(0) @Max(50) num_banos?: number;
  /** Unidades iguales a la venta (habitaciones de ese tipo) */
  @IsOptional() @IsInt() @Min(1) @Max(500) cantidad?: number;
  @IsNumber() @Min(1) @Max(100000) precio_noche_base: number;
  @IsOptional() @IsBoolean() activa?: boolean;
}

export class ActualizarUnidadDto extends PartialType(UnidadDto) {}

export class DiaCalendarioDto {
  @Matches(FECHA, { message: MSG_FECHA })
  fecha: string;

  /** Precio especial; null = precio base */
  @IsOptional() @IsNumber() @Min(1) precio_noche?: number | null;

  /** Unidades a la venta ese día; 0 = cerrado; null = cantidad base */
  @IsOptional() @IsInt() @Min(0) cantidad_a_la_venta?: number | null;
}

export class CalendarioDto {
  @IsArray()
  @ArrayMaxSize(366)
  @ValidateNested({ each: true })
  @Type(() => DiaCalendarioDto)
  dias: DiaCalendarioDto[];
}

export class RangoFechasDto {
  @Matches(FECHA, { message: MSG_FECHA }) desde: string;
  @Matches(FECHA, { message: MSG_FECHA }) hasta: string;
}

export class ResponderSolicitudDto {
  @IsBoolean()
  acepta: boolean;
}

export class ResponderResenaDto {
  @Sanitizar() @IsString() @Length(2, 2000) respuesta: string;
}

export enum EstadoReservaFiltro {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  CANCELADA = 'CANCELADA',
  RECHAZADA = 'RECHAZADA',
  EXPIRADA = 'EXPIRADA',
  COMPLETADA = 'COMPLETADA',
}

export class FiltroReservasHostDto extends PaginacionDto {
  @IsOptional() @IsEnum(EstadoReservaFiltro) estado?: EstadoReservaFiltro;
}
