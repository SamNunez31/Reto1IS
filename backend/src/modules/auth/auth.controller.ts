import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../common/auth/decorators';
import { auditar, enmascararEmail } from '../../common/logging/auditoria';
import { ProblemException } from '../../common/problem/problem';
import { ok, RespuestaApi } from '../../common/http/respuestas';
import { AuthService, Sesion } from './auth.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

/** Límite estricto contra fuerza bruta: 5 intentos por minuto por IP. */
const LIMITE_ESTRICTO = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Autenticación')
@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle(LIMITE_ESTRICTO)
  @ApiOperation({ summary: 'Registrar cuenta (rol USUARIO)' })
  @ApiResponse({ status: 201, description: 'Cuenta creada y sesión iniciada' })
  async register(@Body() dto: RegisterDto): Promise<RespuestaApi<Sesion>> {
    return ok(await this.auth.registrar(dto), 'Cuenta creada');
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(LIMITE_ESTRICTO)
  @ApiOperation({ summary: 'Iniciar sesión: devuelve un JWT (Bearer) con claim scope' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<RespuestaApi<Sesion>> {
    try {
      const sesion = await this.auth.login(dto);
      auditar('login_ok', req, { usuario_id: sesion.user.id, rol: sesion.user.rol });
      return ok(sesion, 'Sesión iniciada');
    } catch (e) {
      if (e instanceof ProblemException && e.getStatus() === 401) {
        auditar('login_fallido', req, { email: enmascararEmail(dto.email) });
      }
      throw e;
    }
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle(LIMITE_ESTRICTO)
  @ApiOperation({ summary: 'Solicitar enlace de recuperación (respuesta siempre genérica)' })
  async forgot(@Body() dto: ForgotPasswordDto): Promise<RespuestaApi<{ enlace_simulado?: string }>> {
    const data = await this.auth.olvideClave(dto);
    return ok(data, 'Si el correo está registrado, te enviamos un enlace para restablecer la clave');
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(LIMITE_ESTRICTO)
  @ApiOperation({ summary: 'Restablecer la clave con el token recibido' })
  async reset(@Body() dto: ResetPasswordDto): Promise<RespuestaApi<null>> {
    await this.auth.restablecerClave(dto);
    return ok(null, 'Clave actualizada');
  }
}
