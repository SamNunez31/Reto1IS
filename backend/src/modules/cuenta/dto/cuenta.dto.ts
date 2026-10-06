import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { DocumentoEcuador, MENSAJE_TELEFONO_EC, NormalizarTelefono, Sanitizar, TELEFONO_EC } from '../../../common/validation/validadores-ec';
import { MENSAJE_NOMBRE, NOMBRE_PERSONA, TipoDocumento } from '../../auth/dto/auth.dto';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

export class ActualizarPerfilDto {
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(2, 80)
  @Matches(NOMBRE_PERSONA, { message: `nombres ${MENSAJE_NOMBRE}` })
  nombres?: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(2, 80)
  @Matches(NOMBRE_PERSONA, { message: `apellidos ${MENSAJE_NOMBRE}` })
  apellidos?: string;

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

  @IsOptional()
  @Sanitizar()
  @IsString()
  @MaxLength(160)
  razon_social?: string;
}

export class CrearResenaDto {
  /** Nota global de 1 a 10 */
  @IsInt()
  @Min(1)
  @Max(10)
  nota_global: number;

  /**
   * Comentario opcional (10 a 1000 caracteres). Se valida automáticamente en el servicio:
   * sin un mismo carácter 4+ veces seguidas, sin enlaces, correos ni teléfonos y sin groserías.
   */
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(10, 1000, { message: 'El comentario debe tener entre 10 y 1000 caracteres' })
  comentario?: string;
}

export class MisOrdenesQueryDto extends PaginacionDto {}
