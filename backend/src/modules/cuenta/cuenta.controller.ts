import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuarioActual, UsuarioToken } from '../../common/auth/decorators';
import { listado, ok, RespuestaApi, Listado } from '../../common/http/respuestas';
import { invalido } from '../../common/problem/problem';
import { CuentaService, EventoTraza, Liquidacion, MiOrden, Perfil } from './cuenta.service';
import { ActualizarPerfilDto, CrearResenaDto, MisOrdenesQueryDto } from './dto/cuenta.dto';

const uuid = (n: string) =>
  new ParseUUIDPipe({ exceptionFactory: () => invalido(`${n} debe ser un UUID`, [{ name: n, reason: 'formato UUID requerido' }]) });

/** Rutas propias del usuario autenticado (no forman parte del contrato). */
@ApiTags('Mi cuenta')
@ApiBearerAuth('bearer')
@Controller()
export class CuentaController {
  constructor(private readonly cuenta: CuentaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mi perfil' })
  async me(@UsuarioActual() user: UsuarioToken): Promise<RespuestaApi<Perfil>> {
    return ok(await this.cuenta.perfil(user.sub));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar mi perfil (datos de facturación incluidos)' })
  async actualizar(@UsuarioActual() user: UsuarioToken, @Body() dto: ActualizarPerfilDto): Promise<RespuestaApi<Perfil>> {
    return ok(await this.cuenta.actualizarPerfil(user.sub, dto), 'Perfil actualizado');
  }

  @Get('me/orders')
  @ApiOperation({ summary: 'Mis reservas' })
  async misOrdenes(@UsuarioActual() user: UsuarioToken, @Query() q: MisOrdenesQueryDto): Promise<RespuestaApi<Listado<MiOrden>>> {
    const r = await this.cuenta.misOrdenes(user.sub, q.limit, q.offset);
    return listado(r.items, r.total, r.limit, r.offset);
  }

  @Get('orders/:id/invoice')
  @ApiOperation({ summary: 'Factura simulada de la reserva (v_factura)' })
  async factura(@Param('id', uuid('id')) id: string, @UsuarioActual() user: UsuarioToken): Promise<RespuestaApi<Record<string, unknown>>> {
    return ok(await this.cuenta.factura(id, user));
  }

  @Get('orders/:id/timeline')
  @ApiOperation({ summary: 'Trazabilidad de la reserva (dueño, anfitrión o ADMIN)' })
  async timeline(@Param('id', uuid('id')) id: string, @UsuarioActual() user: UsuarioToken): Promise<RespuestaApi<EventoTraza[]>> {
    return ok(await this.cuenta.timeline(id, user));
  }

  @Get('orders/:id/cancel-preview')
  @ApiOperation({ summary: 'Previsualizar penalidad y reembolso de una cancelación' })
  async previewCancelacion(@Param('id', uuid('id')) id: string, @UsuarioActual() user: UsuarioToken): Promise<RespuestaApi<Liquidacion>> {
    return ok(await this.cuenta.previsualizarCancelacion(id, user));
  }

  @Post('orders/:id/review')
  @ApiOperation({ summary: 'Reseñar una estancia completada' })
  async resena(
    @Param('id', uuid('id')) id: string,
    @Body() dto: CrearResenaDto,
    @UsuarioActual() user: UsuarioToken,
  ): Promise<RespuestaApi<{ id: string }>> {
    return ok(await this.cuenta.crearResena(id, dto, user), 'Reseña publicada');
  }
}
