// Tipos de la API. Los del contrato usan snake_case como el YAML.

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  invalidParams?: InvalidParam[];
}

/** Respuesta de las rutas propias. */
export interface RespuestaApi<T> {
  status: 'success';
  message: string;
  data: T;
}

export interface Listado<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------- Auth ----------
export type Rol = 'USUARIO' | 'ADMIN';

export interface Usuario {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  es_anfitrion: boolean;
}

export interface Sesion {
  access_token: string;
  token_type: 'Bearer';
  expires_in: string;
  scope: string;
  user: Usuario;
}

export interface RegistroDatos {
  email: string;
  password: string;
  nombres: string;
  apellidos: string;
  telefono?: string;
  tipo_documento?: 'CEDULA' | 'RUC' | 'PASAPORTE';
  numero_documento?: string;
}

// ---------- Contrato: catálogo ----------
export interface Huespedes {
  number_of_adults: number;
  number_of_rooms: number;
  children?: number[];
}

export interface CriteriosBusqueda {
  checkin: string;
  checkout: string;
  guests: Huespedes;
  city?: number;
  province?: string;
  accommodation_type?: number;
  max_price?: number;
  min_stars?: number;
  sort_by?: 'relevancia' | 'precio_asc' | 'precio_desc' | 'calificacion';
}

export interface SearchResponse {
  request_id: string;
  data: { id: number; url: string }[];
  next_page: string | null;
}

export interface Precio {
  base: number;
  service_fee: number;
  taxes: number;
  cleaning_fee: number;
  total: number;
}

export interface PoliticaCancelacion {
  name: string;
  description: string;
  rules: { hours_before: number; penalty_percent: number }[];
}

export interface Producto {
  id: string;
  name: string;
  max_occupancy: number;
  available_rooms: number;
  nights: number;
  price: Precio;
  cancellation_policy: PoliticaCancelacion;
}

export interface AvailabilityResponse {
  request_id: string;
  data: { id: number; currency: string; products: Producto[]; url: string };
}

export interface DetalleAlojamiento {
  id: number;
  name: string;
  type: string;
  url: string;
  country: string;
  city: { id: number; name: string; province: string };
  location: { address: string; latitude: number; longitude: number };
  stars: number | null;
  rating: { score: number | null; reviews: number };
  price_from: number | null;
  currency: string;
  cover_photo: string | null;
  description?: string;
  facilities?: { id: number; name: string; category: string }[];
  payment?: { methods: string[] };
  photos?: { url: string; order: number; cover: boolean }[];
  policies?: {
    cancellation: PoliticaCancelacion;
    checkin_from: string;
    checkout_until: string;
    min_nights: number;
    max_nights: number;
    booking_mode: string;
    house_rules: string | null;
  };
  rooms?: {
    name: string;
    max_occupancy: number;
    bedrooms: number;
    beds: number;
    bathrooms: number;
    quantity: number;
    base_price_per_night: number;
  }[];
}

export interface DetailsResponse {
  request_id: string;
  data: DetalleAlojamiento[];
  next_page: string | null;
}

export interface Resena {
  id: string;
  accommodation_id: number;
  score: number;
  comment: string | null;
  author: string;
  created_at: string;
  host_reply: string | null;
}

export interface ReviewsResponse {
  request_id: string;
  data: Resena[];
  next_page: string | null;
}

export interface Puntaje {
  id: number;
  score: number | null;
  number_of_reviews: number;
  distribution: Record<string, number>;
}

export interface Constantes {
  accommodation_types: { id: number; name: string }[];
  facilities: { id: number; name: string; category: string }[];
  cancellation_policies: { id: number; name: string; description: string }[];
  provinces: { name: string }[];
  cities: { id: number; name: string; province: string }[];
  booking_statuses: { name: string }[];
}

// ---------- Contrato: órdenes ----------
export interface PreviewResponse {
  request_id: string;
  data: { order_preview_id: string; total_price: number; currency: string };
}

export interface OrderDetail {
  order_id: string;
  locator: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  accommodation_details: {
    id: number;
    name: string;
    checkin: string;
    checkout: string;
    guests: number;
    units: { name: string; quantity: number }[];
    url: string;
  };
  total_price: number;
  currency: string;
  creation_date: string;
  _links: Record<string, string>;
}

export interface CancelacionResultado {
  order_id: string;
  status: 'CANCELLED';
  penalty: number;
  refund: number;
  currency: string;
}

// ---------- Rutas propias: cuenta ----------
export interface MiOrden extends OrderDetail {
  estado_interno: string;
  portada: string | null;
  tiene_resena: boolean;
  /** TARJETA | EFECTIVO */
  metodo_pago: string | null;
  /** PENDIENTE (efectivo aún no recibido) | APROBADO */
  estado_pago: string | null;
}

export interface Liquidacion {
  order_id: string;
  simulada: boolean;
  horas_anticipacion: number;
  porcentaje_aplicado: number;
  penalty: number;
  refund: number;
  currency: string;
}

export interface Factura {
  id: string;
  numero: string;
  estado: string;
  emitida_en: string;
  anulada_en: string | null;
  reserva_codigo: string;
  emisor_nombre: string;
  emisor_identificacion: string | null;
  comprador_nombre: string;
  /** CEDULA | RUC | PASAPORTE | CONSUMIDOR_FINAL */
  comprador_tipo_documento?: string | null;
  comprador_identificacion: string;
  comprador_email: string;
  subtotal_sin_impuestos: number;
  servicio: number;
  iva: number;
  total: number;
}

export interface EventoTraza {
  evento_id: number;
  tipo: string;
  agregado: string;
  created_at: string;
  publicado_en: string | null;
  payload: Record<string, unknown>;
}
