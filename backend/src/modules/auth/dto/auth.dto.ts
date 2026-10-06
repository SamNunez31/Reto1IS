import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsHexadecimal, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { DocumentoEcuador, MENSAJE_TELEFONO_EC, NormalizarTelefono, Sanitizar, TELEFONO_EC } from '../../../common/validation/validadores-ec';

const aMinusculas = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Política de clave: 8+ caracteres con mayúscula, minúscula y número. */
export const POLITICA_CLAVE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
const MENSAJE_CLAVE = 'la clave debe tener mínimo 8 caracteres, con mayúscula, minúscula y número';

/** Nombres y apellidos: letras (con tildes, ñ, ü) separadas por un espacio, guion o apóstrofe; sin dígitos. */
export const NOMBRE_PERSONA = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
export const MENSAJE_NOMBRE = 'solo puede contener letras, espacios, guion y apóstrofe (sin números)';

export enum TipoDocumento {
  CEDULA = 'CEDULA',
  RUC = 'RUC',
  PASAPORTE = 'PASAPORTE',
}

export class RegisterDto {
  @aMinusculas()
  @IsEmail({}, { message: 'correo inválido' })
  @MaxLength(160)
  email: string;

  @IsString()
  @Matches(POLITICA_CLAVE, { message: MENSAJE_CLAVE })
  password: string;

  @Sanitizar()
  @IsString()
  @Length(2, 80)
  @Matches(NOMBRE_PERSONA, { message: `nombres ${MENSAJE_NOMBRE}` })
  nombres: string;

  @Sanitizar()
  @IsString()
  @Length(2, 80)
  @Matches(NOMBRE_PERSONA, { message: `apellidos ${MENSAJE_NOMBRE}` })
  apellidos: string;

  @IsOptional()
  @NormalizarTelefono()
  @Matches(TELEFONO_EC, { message: MENSAJE_TELEFONO_EC })
  telefono?: string;

  @IsOptional()
  @IsEnum(TipoDocumento)
  tipo_documento?: TipoDocumento;

  @IsOptional()
  @DocumentoEcuador()
  numero_documento?: string;
}

export class LoginDto {
  @aMinusculas()
  @IsEmail({}, { message: 'correo inválido' })
  email: string;

  @IsString()
  @Length(1, 72)
  password: string;
}

export class ForgotPasswordDto {
  @aMinusculas()
  @IsEmail({}, { message: 'correo inválido' })
  email: string;
}

export class ResetPasswordDto {
  /** Token de 32 bytes en hexadecimal recibido por "correo" */
  @IsHexadecimal()
  @Length(64, 64)
  token: string;

  @IsString()
  @Matches(POLITICA_CLAVE, { message: MENSAJE_CLAVE })
  password: string;
}
