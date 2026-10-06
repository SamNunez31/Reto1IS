import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString,
  Length, Matches, Max, Min, ValidateNested,
} from 'class-validator';
import { BookerDto, ConMonedaDto, FECHA, HuespedesDto, IdiomasDto, MSG_FECHA } from './comunes.dto';

export enum ExtraBusqueda {
  extra_charges = 'extra_charges',
  products = 'products',
}

export enum OrdenBusqueda {
  relevancia = 'relevancia',
  precio_asc = 'precio_asc',
  precio_desc = 'precio_desc',
  calificacion = 'calificacion',
}

/** SearchAccommodationRequest (+ filtros opcionales de extensión, ver docs/SUPUESTOS.md). */
export class SearchAccommodationRequestDto extends ConMonedaDto {
  @ValidateNested()
  @Type(() => BookerDto)
  booker: BookerDto;

  @Matches(FECHA, { message: MSG_FECHA })
  checkin: string;

  @Matches(FECHA, { message: MSG_FECHA })
  checkout: string;

  /** Id de ciudad (catálogo /constants) */
  @IsOptional()
  @IsInt()
  @Min(1)
  city?: number;

  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  @IsIn(['ec'], { message: 'solo se admite country = ec' })
  country?: string;

  @ValidateNested()
  @Type(() => HuespedesDto)
  guests: HuespedesDto;

  @IsOptional()
  @IsArray()
  @IsEnum(ExtraBusqueda, { each: true })
  extras?: ExtraBusqueda[];

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100)
  rows?: number = 100;

  /** Cursor opaco devuelto en next_page */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  page?: string;

  // ---- Extensiones opcionales (no rompen el contrato: el esquema admite propiedades adicionales) ----
  /** Extensión: provincia (nombre exacto, ver /constants provinces) */
  @IsOptional()
  @IsString()
  @Length(3, 40)
  province?: string;

  /** Extensión: id de tipo de alojamiento */
  @IsOptional()
  @IsInt()
  @Min(1)
  accommodation_type?: number;

  /** Extensión: precio máximo por noche (USD) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_price?: number;

  /** Extensión: estrellas mínimas */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  min_stars?: number;

  /** Extensión: criterio de orden */
  @IsOptional()
  @IsEnum(OrdenBusqueda)
  sort_by?: OrdenBusqueda;
}

export enum ExtraDisponibilidad {
  extra_charges = 'extra_charges',
  include_bundle_variants = 'include_bundle_variants',
}

/** AvailabilityRequest */
export class AvailabilityRequestDto extends ConMonedaDto {
  /** Código entero del alojamiento */
  @IsInt()
  @Min(1)
  accommodation: number;

  @ValidateNested()
  @Type(() => BookerDto)
  booker: BookerDto;

  @Matches(FECHA, { message: MSG_FECHA })
  checkin: string;

  @Matches(FECHA, { message: MSG_FECHA })
  checkout: string;

  @ValidateNested()
  @Type(() => HuespedesDto)
  guests: HuespedesDto;

  @IsOptional()
  @IsArray()
  @IsEnum(ExtraDisponibilidad, { each: true })
  extras?: ExtraDisponibilidad[];
}

export class FiltrosBulkDto {
  /** No soportado: el prototipo no maneja planes de comida (se ignora) */
  @IsOptional()
  @IsString()
  meal_plan?: string;

  /** Nombre de política: FLEXIBLE, MODERADA o NO_REEMBOLSABLE */
  @IsOptional()
  @IsString()
  cancellation_type?: string;
}

/** BulkAvailabilityRequest */
export class BulkAvailabilityRequestDto extends ConMonedaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  accommodations: number[];

  @ValidateNested()
  @Type(() => BookerDto)
  booker: BookerDto;

  @Matches(FECHA, { message: MSG_FECHA })
  checkin: string;

  @Matches(FECHA, { message: MSG_FECHA })
  checkout: string;

  @ValidateNested()
  @Type(() => HuespedesDto)
  guests: HuespedesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FiltrosBulkDto)
  filters?: FiltrosBulkDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extras?: string[];
}

export enum ExtraDetalle {
  description = 'description',
  bundles = 'bundles',
  facilities = 'facilities',
  payment = 'payment',
  photos = 'photos',
  policies = 'policies',
  rooms = 'rooms',
}

/** AccommodationDetailsRequest (+ page/rows de extensión para paginar) */
export class AccommodationDetailsRequestDto extends IdiomasDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  accommodations?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  city?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ExtraDetalle, { each: true })
  extras?: ExtraDetalle[];

  /** Extensión: cursor de página */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  page?: string;

  /** Extensión: filas por página (1-100, por defecto 20) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rows?: number;
}

export class FiltrosCambiosDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  cities?: number[];
}

/** DetailsChangesRequest */
export class DetailsChangesRequestDto {
  @IsISO8601({ strict: true })
  last_change: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FiltrosCambiosDto)
  filters?: FiltrosCambiosDto;
}

/** ConstantsRequest */
export class ConstantsRequestDto extends IdiomasDto {
  /** accommodation_types, facilities, cancellation_policies, provinces, cities, booking_statuses */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  constants?: string[];
}

/** ReviewsRequest */
export class ReviewsRequestDto extends IdiomasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  accommodations: number[];

  @IsOptional()
  @IsString()
  @Length(1, 200)
  page?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rows?: number;
}

/** ReviewsScoresRequest */
export class ReviewsScoresRequestDto extends IdiomasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  accommodations: number[];
}
