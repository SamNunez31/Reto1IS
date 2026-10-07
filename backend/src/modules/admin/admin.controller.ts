import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual, UsuarioToken } from '../../common/auth/decorators';
import { listado, Listado, ok, RespuestaApi } from '../../common/http/respuestas';
import { invalido } from '../../common/problem/problem';
import { JobsService, ResultadoJob } from '../jobs/jobs.service';
import { AdminService } from './admin.service';
import {
  AmenidadDto, CerrarImpuestoDto, CiudadDto, EstadoAlojamientoDto, EstadoUsuarioDto, FiltroAlojamientosDto,
  FiltroEventosDto, FiltroUsuariosDto, ImpuestoDto, RolUsuarioDto,
} from './dto/admin.dto';

type Fila = Record<string, unknown>;
const uuid = (n: string) =>
  new ParseUUIDPipe({ exceptionFactory: () => invalido(`${n} debe ser un UUID`, [{ name: n, reason: 'formato UUID requerido' }]) });
const entero = (n: string) =>
  new ParseIntPipe({ exceptionFactory: () => invalido(`${n} debe ser un entero`, [{ name: n, reason: 'entero requerido' }]) });

const paginado = (r: Listado<Fila>) => listado(r.items, r.total, r.limit, r.offset);

@ApiTags('Administración')
@ApiBearerAuth('bearer')
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jobs: JobsService,
  ) {}

  @Get('indicators')
  @ApiOperation({ summary: 'Indicadores generales (v_admin_indicadores)' })
  async indicadores(): Promise<RespuestaApi<Fila>> {
    return ok(await this.admin.indicadores());
  }

  @Get('sales-by-city')
  @ApiOperation({ summary: 'Ventas por ciudad (v_ventas_por_ciudad)' })
  async ventas(): Promise<RespuestaApi<Fila[]>> {
    return ok(await this.admin.ventasPorCiudad());
  }

  @Get('top-accommodations')
  @ApiOperation({ summary: 'Top 10 alojamientos (v_top_alojamientos)' })
  async top(): Promise<RespuestaApi<Fila[]>> {
    return ok(await this.admin.topAlojamientos());
  }

  @Get('accommodations')
  @ApiOperation({ summary: 'Todos los alojamientos (filtro por estado y búsqueda por nombre, ciudad o código)' })
  async alojamientos(@Query() f: FiltroAlojamientosDto): Promise<RespuestaApi<Listado<Fila>>> {
    return paginado(await this.admin.alojamientos(f));
  }

  @Patch('accommodations/:codigo/status')
  @ApiOperation({ summary: 'Suspender o reactivar un alojamiento' })
  async estadoAlojamiento(@Param('codigo', entero('codigo')) codigo: number, @Body() dto: EstadoAlojamientoDto): Promise<RespuestaApi<{ codigo: number; estado: string }>> {
    return ok(await this.admin.estadoAlojamiento(codigo, dto.estado), 'Estado actualizado');
  }

  @Get('users')
  @ApiOperation({ summary: 'Usuarios' })
  async usuarios(@Query() f: FiltroUsuariosDto): Promise<RespuestaApi<Listado<Fila>>> {
    return paginado(await this.admin.usuarios(f));
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activar o desactivar un usuario' })
  async estadoUsuario(@Param('id', uuid('id')) id: string, @Body() dto: EstadoUsuarioDto, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<{ id: string; activo: boolean }>> {
    return ok(await this.admin.estadoUsuario(id, dto.activo, u), dto.activo ? 'Usuario activado' : 'Usuario desactivado');
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Asignar el rol de administrador a otro usuario (el usuario debe volver a iniciar sesión)' })
  async rolUsuario(@Param('id', uuid('id')) id: string, @Body() dto: RolUsuarioDto, @UsuarioActual() u: UsuarioToken): Promise<RespuestaApi<{ id: string; rol: string }>> {
    return ok(await this.admin.asignarRol(id, dto.rol, u), 'Rol actualizado: el usuario debe volver a iniciar sesión para ver el panel de administración');
  }

  @Get('catalogs')
  @ApiOperation({ summary: 'Catálogos: tipos, amenidades, políticas, ciudades' })
  async catalogos(): Promise<RespuestaApi<Record<string, Fila[]>>> {
    return ok(await this.admin.catalogos());
  }

  @Post('catalogs/amenities')
  @ApiOperation({ summary: 'Agregar amenidad' })
  async amenidad(@Body() d: AmenidadDto): Promise<RespuestaApi<Fila | null>> {
    return ok(await this.admin.crearAmenidad(d), 'Amenidad creada');
  }

  @Post('catalogs/cities')
  @ApiOperation({ summary: 'Agregar ciudad' })
  async ciudad(@Body() d: CiudadDto): Promise<RespuestaApi<Fila | null>> {
    return ok(await this.admin.crearCiudad(d), 'Ciudad creada');
  }

  @Get('taxes')
  @ApiOperation({ summary: 'Tarifas de IVA/servicio y feriados' })
  async impuestos(): Promise<RespuestaApi<Fila[]>> {
    return ok(await this.admin.impuestos());
  }

  @Post('taxes')
  @ApiOperation({ summary: 'Registrar tarifa (p. ej. feriado con IVA reducido: aplica a todos los alojamientos en esas fechas)' })
  async crearImpuesto(@Body() d: ImpuestoDto): Promise<RespuestaApi<Fila | null>> {
    return ok(await this.admin.crearImpuesto(d), 'Tarifa registrada');
  }

  @Patch('taxes/:id')
  @ApiOperation({ summary: 'Cerrar la vigencia de una tarifa' })
  async cerrarImpuesto(@Param('id', entero('id')) id: number, @Body() d: CerrarImpuestoDto): Promise<RespuestaApi<{ id: number; vigente_hasta: string }>> {
    return ok(await this.admin.cerrarImpuesto(id, d.vigente_hasta), 'Vigencia cerrada');
  }

  @Get('events')
  @ApiOperation({ summary: 'Eventos de negocio (outbox)' })
  async eventos(@Query() f: FiltroEventosDto): Promise<RespuestaApi<Listado<Fila>>> {
    return paginado(await this.admin.eventos(f));
  }

  @Post('jobs/:nombre/ejecutar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ejecutar un job: completar-estancias, publicar-outbox, purgar-idempotencia' })
  async ejecutar(@Param('nombre') nombre: string): Promise<RespuestaApi<ResultadoJob>> {
    return ok(await this.jobs.ejecutar(nombre), 'Job ejecutado');
  }
}
