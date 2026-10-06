import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual, UsuarioToken } from '../../common/auth/decorators';
import { listado, Listado, ok, RespuestaApi } from '../../common/http/respuestas';
import { invalido } from '../../common/problem/problem';
import {
  ActualizarAlojamientoDto, ActualizarUnidadDto, CalendarioDto, CrearAlojamientoDto, FiltroReservasHostDto, RangoFechasDto,
  ResponderResenaDto, ResponderSolicitudDto, UnidadDto,
} from './dto/host.dto';
import { HostService, ResumenAlojamiento, SolicitudHost, UnidadHost } from './host.service';

const uuid = (n: string) =>
  new ParseUUIDPipe({ exceptionFactory: () => invalido(`${n} debe ser un UUID`, [{ name: n, reason: 'formato UUID requerido' }]) });
const entero = (n: string) =>
  new ParseIntPipe({ exceptionFactory: () => invalido(`${n} debe ser un entero`, [{ name: n, reason: 'entero requerido' }]) });

/**
 * Gestión del catálogo (ruta propia, fuera del contrato). Posada EC administra su catálogo:
 * solo el ADMIN entra aquí y opera sobre cualquier alojamiento. El portal de anfitriones externos es evolución futura.
 */
@ApiTags('Catálogo (ADMIN)')
@ApiBearerAuth('bearer')
@Roles('ADMIN')
@Controller('host')
export class HostController {
  constructor(private readonly host: HostService) {}

  @Get('accommodations')
  @ApiOperation({ summary: 'Mis alojamientos' })
  async lista(@UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<ResumenAlojamiento[]>> {
    return ok(await this.host.misAlojamientos(u));
  }

  @Post('accommodations')
  @ApiOperation({ summary: 'Crear alojamiento (queda en BORRADOR)' })
  async crear(@Body() dto: CrearAlojamientoDto, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<{ codigo: number }>> {
    return ok(await this.host.crear(dto, u), 'Alojamiento creado en borrador');
  }

  @Get('accommodations/:codigo')
  @ApiOperation({ summary: 'Detalle editable de mi alojamiento' })
  async obtener(@Param('codigo', entero('codigo')) codigo: number, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<Record<string, unknown>>> {
    return ok(await this.host.obtener(codigo, u));
  }

  @Patch('accommodations/:codigo')
  @ApiOperation({ summary: 'Editar mi alojamiento' })
  async actualizar(
    @Param('codigo', entero('codigo')) codigo: number,
    @Body() dto: ActualizarAlojamientoDto,
    @UsuarioActual() u: UsuarioToken,
  ): Promise<RespuestaApi<Record<string, unknown>>> {
    return ok(await this.host.actualizar(codigo, dto, u), 'Alojamiento actualizado');
  }

  @Post('accommodations/:codigo/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publicar (requiere unidad activa y foto)' })
  async publicar(@Param('codigo', entero('codigo')) codigo: number, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<{ estado: string }>> {
    return ok(await this.host.cambiarPublicacion(codigo, true, u), 'Alojamiento publicado');
  }

  @Post('accommodations/:codigo/unpublish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Despublicar (vuelve a BORRADOR)' })
  async despublicar(@Param('codigo', entero('codigo')) codigo: number, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<{ estado: string }>> {
    return ok(await this.host.cambiarPublicacion(codigo, false, u), 'Alojamiento despublicado');
  }

  @Get('accommodations/:codigo/units')
  @ApiOperation({ summary: 'Unidades (habitaciones/tipos) de mi alojamiento' })
  async unidades(@Param('codigo', entero('codigo')) codigo: number, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<UnidadHost[]>> {
    return ok(await this.host.unidades(codigo, u));
  }

  @Post('accommodations/:codigo/units')
  @ApiOperation({ summary: 'Agregar unidad' })
  async crearUnidad(
    @Param('codigo', entero('codigo')) codigo: number,
    @Body() dto: UnidadDto,
    @UsuarioActual() u: UsuarioToken,
  ): Promise<RespuestaApi<UnidadHost>> {
    return ok(await this.host.crearUnidad(codigo, dto, u), 'Unidad creada');
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'Editar o desactivar una unidad' })
  async actualizarUnidad(@Param('id', uuid('id')) id: string, @Body() dto: ActualizarUnidadDto, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<UnidadHost>> {
    return ok(await this.host.actualizarUnidad(id, dto, u), 'Unidad actualizada');
  }

  @Get('units/:id/calendar')
  @ApiOperation({ summary: 'Calendario de precio y cupo (máx. 93 días)' })
  async calendario(
    @Param('id', uuid('id')) id: string,
    @Query() r: RangoFechasDto,
    @UsuarioActual() u: UsuarioToken,
  ): Promise<RespuestaApi<Record<string, unknown>[]>> {
    return ok(await this.host.calendario(id, r.desde, r.hasta, u));
  }

  @Put('units/:id/calendar')
  @ApiOperation({ summary: 'Guardar precios especiales / cupo por día' })
  async guardarCalendario(@Param('id', uuid('id')) id: string, @Body() dto: CalendarioDto, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<{ dias: number }>> {
    return ok(await this.host.guardarCalendario(id, dto, u), 'Calendario actualizado');
  }

  @Get('orders')
  @ApiOperation({ summary: 'Reservas y solicitudes de mis alojamientos' })
  async reservas(@Query() f: FiltroReservasHostDto, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<Listado<SolicitudHost>>> {
    const r = await this.host.reservas(u, f);
    return listado(r.items, r.total, r.limit, r.offset);
  }

  @Post('orders/:id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceptar o rechazar una solicitud (fn_responder_solicitud)' })
  async responder(
    @Param('id', uuid('id')) id: string,
    @Body() dto: ResponderSolicitudDto,
    @UsuarioActual() u: UsuarioToken,
  ): Promise<RespuestaApi<{ estado: string }>> {
    return ok(await this.host.responder(id, dto.acepta, u), dto.acepta ? 'Solicitud aceptada' : 'Solicitud rechazada');
  }

  @Get('income')
  @ApiOperation({ summary: 'Ingresos por mes (v_ingresos_anfitrion)' })
  async ingresos(@UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<{ mes: string; estancias: number; ingreso_sin_iva: number }[]>> {
    return ok(await this.host.ingresos(u));
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Reseñas de mis alojamientos' })
  async resenas(@UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<Record<string, unknown>[]>> {
    return ok(await this.host.resenas(u));
  }

  @Post('reviews/:id/reply')
  @ApiOperation({ summary: 'Responder una reseña' })
  async responderResena(
    @Param('id', uuid('id')) id: string,
    @Body() dto: ResponderResenaDto,
    @UsuarioActual() u: UsuarioToken,
  ): Promise<RespuestaApi<{ id: string }>> {
    return ok(await this.host.responderResena(id, dto.respuesta, u), 'Respuesta publicada');
  }
}
