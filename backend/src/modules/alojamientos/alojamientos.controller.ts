import {
  Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CorrelationId, Public, Scopes, UsuarioActual, UsuarioToken } from '../../common/auth/decorators';
import { IdempotencyKeyGuard } from '../../common/guards/idempotency-key.guard';
import { DeprecacionInterceptor } from '../../common/http/deprecacion.interceptor';
import { HeaderFingerprint } from '../../common/http/fingerprint.decorator';
import { Idempotente, IdempotenciaInterceptor } from '../../common/idempotencia/idempotencia.interceptor';
import { invalido } from '../../common/problem/problem';
import {
  AccommodationDetailsRequestDto, AvailabilityRequestDto, BulkAvailabilityRequestDto, ConstantsRequestDto,
  DetailsChangesRequestDto, ReviewsRequestDto, ReviewsScoresRequestDto, SearchAccommodationRequestDto,
} from './dto/catalogo.dto';
import { OrderCreateRequestDto, OrderModifyRequestDto, OrderPreviewRequestDto, WebhookSubscriptionDto } from './dto/ordenes.dto';
import {
  AccommodationDetailsResponse, AvailabilityResponse, BulkAvailabilityResponse, CancelacionResultado, ChainsResponse,
  ConstantsResponse, DetailsChangesResponse, OrderDetail, OrderPreviewResponse, ReviewsResponse, ReviewsScoresResponse,
  SearchAccommodationResponse, WebhookSubscription,
} from './dto/respuestas.dto';
import { CatalogoService } from './services/catalogo.service';
import { OrdenesService } from './services/ordenes.service';
import { WebhooksService } from './services/webhooks.service';

const ERR_400 = { status: 400, description: 'Petición inválida (ProblemDetails)' };
const ERR_401 = { status: 401, description: 'Falta token o es inválido (ProblemDetails)' };
const ERR_403 = { status: 403, description: 'Scope o rol insuficiente (ProblemDetails)' };
const ERR_404 = { status: 404, description: 'No encontrado (ProblemDetails)' };
const ERR_409 = { status: 409, description: 'Conflicto: ROOM_NO_LONGER_AVAILABLE, PRICE_CHANGED (+Retry-After)… (ProblemDetails)' };
const ERR_429 = { status: 429, description: 'Demasiadas peticiones (ProblemDetails + Retry-After)' };

// ─────────────────────────────────────────────────────────────────────────────
// Controlador de Alojamientos — Alineado 1:1 con contracts/alojamientos-openapi.yaml
// ─────────────────────────────────────────────────────────────────────────────

@Controller()
export class AlojamientosController {
  constructor(
    private readonly catalogo: CatalogoService,
    private readonly ordenes: OrdenesService,
    private readonly webhooks: WebhooksService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  Búsqueda y Catálogo
  // ══════════════════════════════════════════════════════════════════════════

  @Post('search')
  @Public()
  @HttpCode(200)
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({ summary: 'Búsqueda de alojamientos' })
  @ApiHeader({ name: 'X-Device-Fingerprint', required: true })
  @ApiOkResponse({ type: SearchAccommodationResponse, description: 'Alojamientos encontrados' })
  @ApiResponse(ERR_400)
  @ApiResponse(ERR_429)
  @Header('Cache-Control', 'public, max-age=300')
  @UseInterceptors(DeprecacionInterceptor)
  search(
    @HeaderFingerprint() _fingerprint: string,
    @Body() dto: SearchAccommodationRequestDto,
    @CorrelationId() requestId: string,
  ): Promise<SearchAccommodationResponse> {
    return this.catalogo.buscar(dto, requestId);
  }

  @Post('availability')
  @Public()
  @HttpCode(200)
  @ApiTags('Disponibilidad y Precios')
  @ApiOperation({ summary: 'Consultar disponibilidad y precio de un alojamiento' })
  @ApiOkResponse({ type: AvailabilityResponse, description: 'Disponibilidad y detalles del precio' })
  @ApiResponse(ERR_400)
  availability(@Body() dto: AvailabilityRequestDto, @CorrelationId() requestId: string): Promise<AvailabilityResponse> {
    return this.catalogo.disponibilidad(dto, requestId);
  }

  @Post('bulk-availability')
  @Public()
  @HttpCode(200)
  @ApiTags('Disponibilidad y Precios')
  @ApiOperation({ summary: 'Consultar disponibilidad múltiple de alojamientos', description: 'filters.meal_plan no está soportado y se ignora.' })
  @ApiOkResponse({ type: BulkAvailabilityResponse, description: 'Disponibilidad para múltiples alojamientos' })
  bulkAvailability(@Body() dto: BulkAvailabilityRequestDto, @CorrelationId() requestId: string): Promise<BulkAvailabilityResponse> {
    return this.catalogo.disponibilidadMultiple(dto, requestId);
  }

  @Post('details')
  @Public()
  @HttpCode(200)
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({ summary: 'Obtener detalles extendidos de los alojamientos' })
  @ApiOkResponse({ type: AccommodationDetailsResponse, description: 'Detalles de los alojamientos solicitados' })
  @Header('Cache-Control', 'public, max-age=300')
  @UseInterceptors(DeprecacionInterceptor)
  getDetails(@Body() dto: AccommodationDetailsRequestDto, @CorrelationId() requestId: string): Promise<AccommodationDetailsResponse> {
    return this.catalogo.detalles(dto, requestId);
  }

  @Post('details/changes')
  @HttpCode(200)
  @Scopes('alojamientos:read')
  @ApiTags('Búsqueda y Catálogo')
  @ApiSecurity('OAuth2Security', ['alojamientos:read'])
  @ApiOperation({ summary: 'Obtener alojamientos que han cambiado desde una fecha' })
  @ApiOkResponse({ type: DetailsChangesResponse, description: 'Lista de alojamientos modificados' })
  @ApiResponse(ERR_401)
  getDetailsChanges(@Body() dto: DetailsChangesRequestDto, @CorrelationId() requestId: string): Promise<DetailsChangesResponse> {
    return this.catalogo.cambios(dto, requestId);
  }

  @Post('chains')
  @Public()
  @HttpCode(200)
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({ summary: 'Listar cadenas hoteleras y sus marcas', description: 'El prototipo no maneja cadenas: devuelve [].' })
  @ApiOkResponse({ type: ChainsResponse, description: 'Lista de cadenas hoteleras' })
  @Header('Cache-Control', 'public, max-age=3600')
  @UseInterceptors(DeprecacionInterceptor)
  getChains(@CorrelationId() requestId: string): ChainsResponse {
    return this.catalogo.cadenas(requestId);
  }

  @Post('constants')
  @Public()
  @HttpCode(200)
  @ApiTags('Componentes Comunes')
  @ApiOperation({ summary: 'Consultar constantes del sistema (facilidades, tipos de cuartos, etc.)' })
  @ApiBody({ type: ConstantsRequestDto, required: false })
  @ApiOkResponse({ type: ConstantsResponse, description: 'Constantes del sistema' })
  @Header('Cache-Control', 'public, max-age=86400')
  @UseInterceptors(DeprecacionInterceptor)
  getConstants(@Body() dto: ConstantsRequestDto, @CorrelationId() requestId: string): Promise<ConstantsResponse> {
    return this.catalogo.constantes(dto ?? {}, requestId);
  }

  @Post('reviews')
  @Public()
  @HttpCode(200)
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({ summary: 'Obtener reseñas de alojamientos' })
  @ApiOkResponse({ type: ReviewsResponse, description: 'Reseñas de los alojamientos' })
  @Header('Cache-Control', 'public, max-age=600')
  @UseInterceptors(DeprecacionInterceptor)
  getReviews(@Body() dto: ReviewsRequestDto, @CorrelationId() requestId: string): Promise<ReviewsResponse> {
    return this.catalogo.resenas(dto, requestId);
  }

  @Post('reviews/scores')
  @Public()
  @HttpCode(200)
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({ summary: 'Obtener puntuaciones de reseñas' })
  @ApiOkResponse({ type: ReviewsScoresResponse, description: 'Puntuaciones desglosadas' })
  @Header('Cache-Control', 'public, max-age=600')
  @UseInterceptors(DeprecacionInterceptor)
  getReviewsScores(@Body() dto: ReviewsScoresRequestDto, @CorrelationId() requestId: string): Promise<ReviewsScoresResponse> {
    return this.catalogo.puntajes(dto, requestId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Gestión de Órdenes (Reservas)
  // ══════════════════════════════════════════════════════════════════════════

  @Post('orders/preview')
  @HttpCode(200)
  @Scopes('alojamientos:read')
  @ApiTags('Gestión de Órdenes (Reservas)')
  @ApiSecurity('OAuth2Security', ['alojamientos:read'])
  @ApiOperation({ summary: 'Previsualizar orden antes de confirmar', description: 'Congela el precio por 15 minutos.' })
  @ApiOkResponse({ type: OrderPreviewResponse, description: 'Detalles de la orden previsualizada y precios finales' })
  @ApiResponse(ERR_400)
  @ApiResponse(ERR_403)
  @ApiResponse(ERR_409)
  previewOrder(
    @Body() dto: OrderPreviewRequestDto,
    @UsuarioActual() user: UsuarioToken,
    @CorrelationId() requestId: string,
  ): Promise<OrderPreviewResponse> {
    return this.ordenes.previsualizar(dto, user, requestId);
  }

  @Post('orders/create')
  @Scopes('alojamientos:book')
  @ApiTags('Gestión de Órdenes (Reservas)')
  @ApiSecurity('OAuth2Security', ['alojamientos:book'])
  @ApiOperation({ summary: 'Crear reserva de alojamiento', description: 'Pago simulado: payment_reference ^PAY-[A-Z0-9]{6,}$; PAY-DECLINED… se rechaza (402 PAYMENT_NOT_AUTHORIZED).' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID v4 para evitar cobros duplicados' })
  @ApiResponse({ status: 201, type: OrderDetail, description: 'Orden creada exitosamente' })
  @ApiResponse(ERR_400)
  @ApiResponse({ status: 402, description: 'PAYMENT_NOT_AUTHORIZED (ProblemDetails)' })
  @ApiResponse(ERR_409)
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(IdempotencyKeyGuard)
  @Idempotente('orders.create')
  @UseInterceptors(IdempotenciaInterceptor)
  createOrder(@Body() dto: OrderCreateRequestDto, @UsuarioActual() user: UsuarioToken): Promise<OrderDetail> {
    return this.ordenes.crear(dto, user);
  }

  @Get('orders/:orderId')
  @Scopes('alojamientos:read')
  @ApiTags('Gestión de Órdenes (Reservas)')
  @ApiSecurity('OAuth2Security', ['alojamientos:read'])
  @ApiOperation({ summary: 'Obtener detalles de la orden' })
  @ApiParam({ name: 'orderId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ type: OrderDetail, description: 'Detalles completos de la orden' })
  @ApiResponse(ERR_404)
  getOrder(@Param('orderId', uuidPipe('orderId')) orderId: string, @UsuarioActual() user: UsuarioToken): Promise<OrderDetail> {
    return this.ordenes.obtener(orderId, user.sub);
  }

  @Post('orders/:orderId/modify')
  @HttpCode(200)
  @Scopes('alojamientos:book')
  @ApiTags('Gestión de Órdenes (Reservas)')
  @ApiSecurity('OAuth2Security', ['alojamientos:book'])
  @ApiOperation({ summary: 'Modificar una orden existente' })
  @ApiParam({ name: 'orderId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID v4 para evitar modificaciones duplicadas' })
  @ApiOkResponse({ type: OrderDetail, description: 'Orden modificada' })
  @ApiResponse(ERR_409)
  @UseGuards(IdempotencyKeyGuard)
  @Idempotente('orders.modify')
  @UseInterceptors(IdempotenciaInterceptor)
  modifyOrder(
    @Param('orderId', uuidPipe('orderId')) orderId: string,
    @Body() dto: OrderModifyRequestDto,
    @UsuarioActual() user: UsuarioToken,
  ): Promise<OrderDetail> {
    return this.ordenes.modificar(orderId, dto, user);
  }

  @Post('orders/:orderId/cancel')
  @HttpCode(200)
  @Scopes('alojamientos:cancel')
  @ApiTags('Gestión de Órdenes (Reservas)')
  @ApiSecurity('OAuth2Security', ['alojamientos:cancel'])
  @ApiOperation({ summary: 'Cancelar una orden' })
  @ApiParam({ name: 'orderId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID v4 para evitar cancelaciones duplicadas' })
  @ApiOkResponse({ type: CancelacionResultado, description: 'Cancelación procesada' })
  @ApiResponse(ERR_409)
  @UseGuards(IdempotencyKeyGuard)
  @Idempotente('orders.cancel')
  @UseInterceptors(IdempotenciaInterceptor)
  cancelOrder(@Param('orderId', uuidPipe('orderId')) orderId: string, @UsuarioActual() user: UsuarioToken): Promise<CancelacionResultado> {
    return this.ordenes.cancelar(orderId, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Webhooks (solo CRUD; la entrega es del Reto 2)
  // ══════════════════════════════════════════════════════════════════════════

  @Get('webhooks')
  @Scopes('alojamientos:webhooks')
  @ApiTags('Webhooks')
  @ApiSecurity('OAuth2Security', ['alojamientos:webhooks'])
  @ApiOperation({ summary: 'Listar suscripciones' })
  @ApiOkResponse({ type: WebhookSubscription, isArray: true, description: 'Suscripciones activas' })
  listWebhooks(@UsuarioActual() user: UsuarioToken): Promise<WebhookSubscription[]> {
    return this.webhooks.listar(user.sub);
  }

  @Post('webhooks')
  @Scopes('alojamientos:webhooks')
  @ApiTags('Webhooks')
  @ApiSecurity('OAuth2Security', ['alojamientos:webhooks'])
  @ApiOperation({ summary: 'Registrar webhook', description: 'Solo https. El secreto (32 bytes) se muestra únicamente en esta respuesta.' })
  @ApiResponse({ status: 201, type: WebhookSubscription, description: 'Webhook registrado' })
  @HttpCode(HttpStatus.CREATED)
  createWebhook(@Body() dto: WebhookSubscriptionDto, @UsuarioActual() user: UsuarioToken): Promise<WebhookSubscription> {
    return this.webhooks.crear(dto, user.sub);
  }

  @Delete('webhooks/:id')
  @Scopes('alojamientos:webhooks')
  @ApiTags('Webhooks')
  @ApiSecurity('OAuth2Security', ['alojamientos:webhooks'])
  @ApiOperation({ summary: 'Eliminar suscripción' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWebhook(@Param('id', uuidPipe('id')) id: string, @UsuarioActual() user: UsuarioToken): Promise<void> {
    return this.webhooks.eliminar(id, user.sub);
  }
}

/** ParseUUIDPipe con error en formato ProblemDetails. */
function uuidPipe(nombre: string): ParseUUIDPipe {
  return new ParseUUIDPipe({ exceptionFactory: () => invalido(`${nombre} debe ser un UUID`, [{ name: nombre, reason: 'formato UUID requerido' }]) });
}
