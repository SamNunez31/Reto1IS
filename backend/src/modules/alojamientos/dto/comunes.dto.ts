import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested,
} from 'class-validator';

/** Fecha YYYY-MM-DD (format: date del contrato). */
export const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const MSG_FECHA = 'debe ser una fecha YYYY-MM-DD';

export enum Plataforma {
  android = 'android',
  desktop = 'desktop',
  ios = 'ios',
  mobile = 'mobile',
  tablet = 'tablet',
}

export enum PropositoViaje {
  business = 'business',
  leisure = 'leisure',
}

/** Esquema Booker del contrato. Este prototipo solo opera en Ecuador (country = "ec"). */
export class BookerDto {
  /** Código ISO 3166-1 alpha-2 del país del comprador (solo "ec") */
  @Matches(/^[a-z]{2}$/)
  @IsIn(['ec'], { message: 'solo se admite country = ec' })
  country: string;

  @IsEnum(Plataforma)
  platform: Plataforma;

  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  state?: string;

  @IsOptional()
  @IsEnum(PropositoViaje)
  travel_purpose?: PropositoViaje;

  @IsOptional()
  @IsArray()
  @IsIn(['authenticated'], { each: true })
  user_groups?: string[];
}

export class AsignacionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  adults?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  children?: number[];
}

/** Esquema AccommodationsGuests del contrato. */
export class HuespedesDto {
  @IsInt()
  @Min(1)
  @Max(30)
  number_of_adults: number;

  @IsInt()
  @Min(1)
  @Max(20)
  number_of_rooms: number;

  /** Edades de los niños */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  children?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignacionDto)
  allocation?: AsignacionDto[];
}

/** Moneda: patrón del contrato, pero solo USD. */
export class ConMonedaDto {
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  @IsIn(['USD'], { message: 'solo se admite currency = USD' })
  currency?: string;
}

export const totalHuespedes = (g: HuespedesDto): number => g.number_of_adults + (g.children?.length ?? 0);

export class IdiomasDto {
  /** Solo "es" */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}
