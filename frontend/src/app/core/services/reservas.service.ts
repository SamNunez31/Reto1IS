import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  CancelacionResultado, EventoTraza, Factura, Huespedes, Liquidacion, Listado, MiOrden, OrderDetail, PreviewResponse,
  Producto, RespuestaApi,
} from '../models/api.models';
import { API, cabecerasIdempotentes } from './api-base';

/**
 * customer_details de /orders/create. first_name/last_name/email son del contrato; document_type, document_number
 * y business_name son la extensión opcional para la factura (no se guardan en el perfil del usuario).
 */
export interface DatosFactura {
  first_name?: string;
  last_name?: string;
  email?: string;
  document_type?: 'CEDULA' | 'RUC' | 'PASAPORTE' | 'CONSUMIDOR_FINAL';
  document_number?: string;
  business_name?: string;
}

/** Lo que el huésped eligió en el detalle y se lleva a la pantalla de reserva. */
export interface Seleccion {
  codigo: number;
  nombreAlojamiento: string;
  producto: Producto;
  checkin: string;
  checkout: string;
  guests: Huespedes;
  /** Hora de check-in del alojamiento ("14:00"): referencia de los plazos de cancelación. */
  horaCheckin?: string;
}

/** Órdenes del contrato (preview/create/get/modify/cancel) y rutas propias de "mis reservas". */
@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);

  readonly seleccion = signal<Seleccion | null>(null);

  previsualizar(codigo: number, productId: string, guests: Huespedes): Observable<PreviewResponse['data']> {
    return this.http
      .post<PreviewResponse>(`${API}/orders/preview`, { accommodation_id: codigo, product_id: productId, guests })
      .pipe(map((r) => r.data));
  }

  /**
   * Crea la orden. Tarjeta: solo la referencia PAY-… (nunca datos de la tarjeta). Efectivo (CASH, extensión del contrato):
   * sin referencia; la reserva queda confirmada con el pago pendiente.
   */
  crear(previewId: string, referenciaPago: string | null, cliente: DatosFactura, metodo: 'CARD' | 'CASH' = 'CARD'): Observable<OrderDetail> {
    const cuerpo = metodo === 'CASH'
      ? { order_preview_id: previewId, payment_method: 'CASH', customer_details: cliente }
      : { order_preview_id: previewId, payment_reference: referenciaPago, customer_details: cliente };
    return this.http.post<OrderDetail>(`${API}/orders/create`, cuerpo, { headers: cabecerasIdempotentes() });
  }

  obtener(id: string): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`${API}/orders/${id}`);
  }

  modificar(id: string, cambios: { checkin?: string; checkout?: string; guests?: Huespedes }): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(`${API}/orders/${id}/modify`, cambios, { headers: cabecerasIdempotentes() });
  }

  cancelar(id: string): Observable<CancelacionResultado> {
    return this.http.post<CancelacionResultado>(`${API}/orders/${id}/cancel`, null, { headers: cabecerasIdempotentes() });
  }

  misOrdenes(limit: number, offset: number): Observable<Listado<MiOrden>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<RespuestaApi<Listado<MiOrden>>>(`${API}/me/orders`, { params }).pipe(map((r) => r.data));
  }

  previsualizarCancelacion(id: string): Observable<Liquidacion> {
    return this.http.get<RespuestaApi<Liquidacion>>(`${API}/orders/${id}/cancel-preview`).pipe(map((r) => r.data));
  }

  factura(id: string): Observable<Factura> {
    return this.http.get<RespuestaApi<Factura>>(`${API}/orders/${id}/invoice`).pipe(map((r) => r.data));
  }

  timeline(id: string): Observable<EventoTraza[]> {
    return this.http.get<RespuestaApi<EventoTraza[]>>(`${API}/orders/${id}/timeline`).pipe(map((r) => r.data));
  }

  resenar(id: string, nota: number, comentario: string): Observable<{ id: string }> {
    return this.http
      .post<RespuestaApi<{ id: string }>>(`${API}/orders/${id}/review`, { nota_global: nota, ...(comentario ? { comentario } : {}) })
      .pipe(map((r) => r.data));
  }
}
