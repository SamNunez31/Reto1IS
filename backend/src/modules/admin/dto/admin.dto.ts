import { IsBoolean, IsEmail, IsEnum, IsIn, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, IsInt } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';
import { LATITUD_EC, LONGITUD_EC, Sanitizar } from '../../../common/validation/validadores-ec';
import { FECHA, MSG_FECHA } from '../../alojamientos/dto/comunes.dto';
import { aMinusculas, MENSAJE_NOMBRE, NOMBRE_PERSONA, POLITICA_CLAVE } from '../../auth/dto/auth.dto';

export class EstadoAlojamientoDto {
  @IsIn(['PUBLICADO', 'SUSPENDIDO']) estado: 'PUBLICADO' | 'SUSPENDIDO';
}

export class FiltroUsuariosDto extends PaginacionDto {
  /** Busca en correo, nombres o apellidos */
  @IsOptional() @Sanitizar() @IsString() @MaxLength(80) q?: string;
}

export class FiltroAlojamientosDto extends PaginacionDto {
  @IsOptional() @IsIn(['BORRADOR', 'PUBLICADO', 'SUSPENDIDO']) estado?: string;
  /** Busca en nombre, ciudad o código */
  @IsOptional() @Sanitizar() @IsString() @MaxLength(80) q?: string;
}

export class EstadoUsuarioDto {
  @IsBoolean() activo: boolean;
}

/** Alta de usuario por el ADMIN: mismas reglas que el registro público. Siempre se crea ACTIVO con rol USUARIO (el rol no se recibe). */
export class CrearUsuarioDto {
  @aMinusculas() @IsEmail({}, { message: 'correo inválido' }) @MaxLength(160) email: string;
  @IsString() @Matches(POLITICA_CLAVE, { message: 'la clave debe tener mínimo 8 caracteres, con mayúscula, minúscula y número' }) password: string;
  @Sanitizar() @IsString() @Length(2, 80) @Matches(NOMBRE_PERSONA, { message: `nombres ${MENSAJE_NOMBRE}` }) nombres: string;
  @Sanitizar() @IsString() @Length(2, 80) @Matches(NOMBRE_PERSONA, { message: `apellidos ${MENSAJE_NOMBRE}` }) apellidos: string;
}

/** Solo se permite promover a ADMIN (no hay degradación desde la API). */
export class RolUsuarioDto {
  @IsIn(['ADMIN']) rol: 'ADMIN';
}

export class AmenidadDto {
  @Sanitizar() @IsString() @Length(2, 60) nombre: string;
  @Sanitizar() @IsString() @Length(2, 30) categoria: string;
}

export class CiudadDto {
  @IsString() @Length(3, 40) provincia: string;
  @Sanitizar() @IsString() @Length(2, 80) nombre: string;
  @IsOptional() @IsNumber() @Min(LATITUD_EC.min) @Max(LATITUD_EC.max) latitud?: number;
  @IsOptional() @IsNumber() @Min(LONGITUD_EC.min) @Max(LONGITUD_EC.max) longitud?: number;
}

export enum TipoImpuesto {
  IVA = 'IVA',
  SERVICIO = 'SERVICIO',
}

/** Tarifa de impuesto con vigencia. Un feriado con IVA reducido es una fila IVA con desde/hasta (aplica a todos los alojamientos). */
export class ImpuestoDto {
  @Sanitizar() @IsString() @Length(3, 80) nombre: string;
  @IsEnum(TipoImpuesto) tipo: TipoImpuesto;
  @IsNumber() @Min(0) @Max(100) porcentaje: number;
  @Matches(FECHA, { message: MSG_FECHA }) vigente_desde: string;
  @IsOptional() @Matches(FECHA, { message: MSG_FECHA }) vigente_hasta?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) estrellas_minimas?: number;
}

export class CerrarImpuestoDto {
  @Matches(FECHA, { message: MSG_FECHA }) vigente_hasta: string;
}

export class FiltroEventosDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(60) tipo?: string;
}
