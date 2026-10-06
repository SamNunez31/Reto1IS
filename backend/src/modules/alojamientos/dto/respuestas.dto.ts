import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Respuestas con la forma de los esquemas del contrato. request_id = X-Correlation-Id.

export class ItemBusqueda {
  /** Código entero del alojamiento */
  id: number;
  url: string;
}

export class SearchAccommodationResponse {
  request_id: string;
  data: ItemBusqueda[];
  @ApiProperty({ type: String, nullable: true })
  next_page: string | null;
}

export class Precio {
  /** Hospedaje (noches x unidades) */
  base: number;
  service_fee: number;
  /** IVA total (incluye IVA de limpieza) */
  taxes: number;
  cleaning_fee: number;
  total: number;
}

export class ReglaCancelacion {
  hours_before: number;
  penalty_percent: number;
}

export class PoliticaCancelacion {
  name: string;
  description: string;
  rules: ReglaCancelacion[];
}

export class Producto {
  /** Opaco: base64url de unidad|checkin|checkout */
  id: string;
  name: string;
  max_occupancy: number;
  available_rooms: number;
  nights: number;
  price: Precio;
  cancellation_policy: PoliticaCancelacion;
}

export class DatosDisponibilidad {
  id: number;
  currency: string;
  products: Producto[];
  url: string;
}

export class AvailabilityResponse {
  request_id: string;
  data: DatosDisponibilidad;
}

export class DisponibilidadAlojamiento {
  id: number;
  currency: string;
  available: boolean;
  @ApiPropertyOptional({ type: Producto, nullable: true })
  cheapest_product: Producto | null;
  url: string;
}

export class BulkAvailabilityResponse {
  request_id: string;
  data: DisponibilidadAlojamiento[];
}

export class Facilidad {
  id: number;
  name: string;
  category: string;
}

export class Foto {
  url: string;
  order: number;
  cover: boolean;
}

export class Habitacion {
  name: string;
  max_occupancy: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  quantity: number;
  base_price_per_night: number;
}

export class Politicas {
  cancellation: PoliticaCancelacion;
  checkin_from: string;
  checkout_until: string;
  min_nights: number;
  max_nights: number;
  booking_mode: string;
  @ApiProperty({ type: String, nullable: true })
  house_rules: string | null;
}

export class CiudadRef {
  id: number;
  name: string;
  province: string;
}

export class Ubicacion {
  address: string;
  latitude: number;
  longitude: number;
}

export class Calificacion {
  @ApiProperty({ type: Number, nullable: true })
  score: number | null;
  reviews: number;
}

export class MetodosPago {
  methods: string[];
}

export class DetalleAlojamiento {
  id: number;
  name: string;
  type: string;
  url: string;
  country: string;
  city: CiudadRef;
  location: Ubicacion;
  @ApiProperty({ type: Number, nullable: true })
  stars: number | null;
  rating: Calificacion;
  @ApiProperty({ type: Number, nullable: true })
  price_from: number | null;
  currency: string;
  @ApiProperty({ type: String, nullable: true })
  cover_photo: string | null;
  description?: string;
  bundles?: object[];
  facilities?: Facilidad[];
  payment?: MetodosPago;
  photos?: Foto[];
  policies?: Politicas;
  rooms?: Habitacion[];
}

export class AccommodationDetailsResponse {
  request_id: string;
  data: DetalleAlojamiento[];
  @ApiProperty({ type: String, nullable: true })
  next_page: string | null;
}

export class CambioAlojamiento {
  id: number;
  status: string;
  updated_at: string;
}

export class ListaCambios {
  accommodations: CambioAlojamiento[];
}

export class DatosCambios {
  from: string;
  next: string;
  total_changes: number;
  changes: ListaCambios;
}

export class DetailsChangesResponse {
  request_id: string;
  data: DatosCambios;
}

export class Cadena {
  id: number;
  name: string;
  brands: object[];
}

export class ChainsResponse {
  request_id: string;
  data: Cadena[];
}

export class ConstantsResponse {
  request_id: string;
  /** Mapa constante -> lista de valores */
  data: Record<string, object[]>;
}

export class Resena {
  id: string;
  accommodation_id: number;
  score: number;
  @ApiProperty({ type: String, nullable: true })
  comment: string | null;
  author: string;
  created_at: string;
  @ApiProperty({ type: String, nullable: true })
  host_reply: string | null;
}

export class ReviewsResponse {
  request_id: string;
  data: Resena[];
  @ApiProperty({ type: String, nullable: true })
  next_page: string | null;
}

export class PuntajeAlojamiento {
  id: number;
  @ApiProperty({ type: Number, nullable: true })
  score: number | null;
  number_of_reviews: number;
  /** Cantidad de reseñas por nota (1-10) */
  distribution: Record<string, number>;
}

export class ReviewsScoresResponse {
  request_id: string;
  data: PuntajeAlojamiento[];
}

export class DatosPreview {
  order_preview_id: string;
  total_price: number;
  currency: string;
}

export class OrderPreviewResponse {
  request_id: string;
  data: DatosPreview;
}

export class UnidadOrden {
  name: string;
  quantity: number;
}

export class DetalleAlojamientoOrden {
  id: number;
  name: string;
  checkin: string;
  checkout: string;
  guests: number;
  units: UnidadOrden[];
  url: string;
}

export class OrderDetail {
  order_id: string;
  /** Localizador (PNR) */
  locator: string;
  @ApiProperty({ enum: ['CONFIRMED', 'CANCELLED', 'PENDING'] })
  status: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  accommodation_details: DetalleAlojamientoOrden;
  total_price: number;
  currency: string;
  creation_date: string;
  /** HATEOAS: self, modify y cancel según el estado */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string', format: 'uri' } })
  _links: Record<string, string>;
}

export class CancelacionResultado {
  order_id: string;
  status: 'CANCELLED';
  penalty: number;
  refund: number;
  currency: string;
}

export class WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  /** Solo se muestra al crear */
  secret?: string;
}
