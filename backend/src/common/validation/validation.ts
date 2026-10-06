import { ValidationError, ValidationPipe } from '@nestjs/common';
import { InvalidParam, ProblemException } from '../problem/problem';

/** Aplana el árbol de errores de class-validator a invalidParams [{name: 'guests.number_of_adults', reason}] */
function aplanar(errores: ValidationError[], prefijo = ''): InvalidParam[] {
  const salida: InvalidParam[] = [];
  for (const e of errores) {
    const nombre = prefijo ? `${prefijo}.${e.property}` : e.property;
    if (e.constraints) {
      for (const razon of Object.values(e.constraints)) salida.push({ name: nombre, reason: razon });
    }
    if (e.children?.length) salida.push(...aplanar(e.children, nombre));
  }
  return salida;
}

/** ValidationPipe global: whitelist + forbidNonWhitelisted + transform, errores como ProblemDetails. */
export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errores) =>
      new ProblemException(400, 'VALIDATION_FAILED', 'La petición tiene datos inválidos', aplanar(errores)),
  });
}
