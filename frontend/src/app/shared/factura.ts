import { EventoTraza, Factura } from '../core/models/api.models';
import { fechaDia, fechaHora, textoPago, totalReembolsado, usd } from './historial';
import { fechaLarga, noches, plural } from './textos';

/*
 * Factura en PDF generada en el navegador con los datos que ya devuelve el API
 * (GET /orders/{id}/invoice, /me/orders, /orders/{id}/timeline y la política de /details).
 * armarFactura() es pura (se prueba sin PDF); generarFacturaPdf() solo dibuja.
 */

export interface DatosParaFactura {
  factura: Factura;
  orden: {
    locator: string;
    alojamiento: string;
    checkin: string;
    checkout: string;
    huespedes: number;
    unidades: { name: string; quantity: number }[];
    metodoPago: string | null;
    estadoPago: string | null;
  };
  horaCheckin?: string;
  horaCheckout?: string;
  /** Título de la política de cancelación ("Flexible"). */
  politica?: string | null;
  /** Historial de la reserva: de aquí sale el reembolso de una factura anulada. */
  eventos?: EventoTraza[];
}

export interface LineaFactura {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  importe: number;
}

export interface ModeloFactura {
  numero: string;
  anulada: boolean;
  fecha: string;
  anuladaEl: string | null;
  comprador: { nombre: string; documento: string; email: string };
  emisor: { nombre: string; identificacion: string | null };
  lineas: LineaFactura[];
  subtotal: number;
  ivaPct: number | null;
  iva: number;
  total: number;
  observaciones: string[];
  reembolso: { monto: number; texto: string } | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const NOMBRE_DOC: Record<string, string> = { CEDULA: 'Cédula', RUC: 'RUC', PASAPORTE: 'Pasaporte' };

export function documentoComprador(tipo: string | null | undefined, numero: string | null | undefined): string {
  if (!numero || tipo === 'CONSUMIDOR_FINAL' || /^9{10,13}$/.test(numero)) return 'Consumidor final';
  return `${NOMBRE_DOC[tipo ?? ''] ?? 'Identificación'} ${numero}`;
}

/** Arma los datos de la factura: líneas, totales y observaciones. */
export function armarFactura(d: DatosParaFactura): ModeloFactura {
  const f = d.factura;
  const o = d.orden;
  const n = Math.max(1, noches(o.checkin, o.checkout));
  const hospedaje = Number(f.subtotal_sin_impuestos);
  const servicio = Number(f.servicio) || 0;
  const unidades = o.unidades.map((u) => `${u.quantity} × ${u.name}`).join(', ');

  const lineas: LineaFactura[] = [
    { cantidad: n, descripcion: `Hospedaje en ${o.alojamiento}: ${unidades} (por noche)`, precioUnitario: r2(hospedaje / n), importe: hospedaje },
  ];
  if (servicio > 0) lineas.push({ cantidad: 1, descripcion: 'Cargo por servicio', precioUnitario: servicio, importe: servicio });

  const subtotal = r2(hospedaje + servicio);
  const iva = Number(f.iva) || 0;
  const pct = subtotal > 0 ? (iva / subtotal) * 100 : 0;
  const anulada = f.estado === 'ANULADA';

  const observaciones = [
    `Código de reserva: ${o.locator}`,
    `Entrada: ${fechaLarga(o.checkin)}${d.horaCheckin ? ` desde las ${d.horaCheckin}` : ''} · Salida: ${fechaLarga(o.checkout)}${d.horaCheckout ? ` hasta las ${d.horaCheckout}` : ''} (${plural(n, 'noche')})`,
    `Huéspedes: ${o.huespedes} · ${unidades}`,
    `Forma de pago: ${textoPago(o.metodoPago, o.estadoPago)}`,
    'El hospedaje incluye la tarifa de limpieza cuando el alojamiento la cobra.',
  ];

  let reembolso: ModeloFactura['reembolso'] = null;
  if (anulada) {
    const monto = r2(totalReembolsado(d.eventos ?? []));
    const motivo = o.metodoPago === 'EFECTIVO' && o.estadoPago === 'PENDIENTE' && monto === 0
      ? 'el pago en efectivo no se había realizado'
      : d.politica ? `según política ${d.politica}` : 'según la política de cancelación';
    reembolso = { monto, texto: `Reembolso registrado: ${usd(monto)} (${motivo})` };
  }

  return {
    numero: f.numero,
    anulada,
    fecha: fechaDia(f.emitida_en),
    anuladaEl: anulada && f.anulada_en ? fechaHora(f.anulada_en) : null,
    comprador: { nombre: f.comprador_nombre, documento: documentoComprador(f.comprador_tipo_documento, f.comprador_identificacion), email: f.comprador_email },
    emisor: { nombre: f.emisor_nombre, identificacion: f.emisor_identificacion },
    lineas,
    subtotal,
    ivaPct: Math.abs(pct - Math.round(pct)) < 0.05 ? Math.round(pct) : null,
    iva,
    total: Number(f.total),
    observaciones,
    reembolso,
  };
}

// ---------- PDF ----------
type Rgb = [number, number, number];
const C: Record<'marca' | 'marcaOsc' | 'marcaSuave' | 'acento' | 'texto' | 'suave' | 'borde' | 'peligro' | 'peligroSuave', Rgb> = {
  marca: [14, 79, 75], marcaOsc: [7, 53, 50], marcaSuave: [227, 240, 238], acento: [180, 83, 28],
  texto: [27, 37, 35], suave: [107, 119, 116], borde: [213, 219, 217], peligro: [179, 38, 30], peligroSuave: [251, 233, 231],
};

/** Dibuja la factura (A4) y la devuelve como Blob. jsPDF se carga solo cuando se pide una factura. */
export async function generarFacturaPdf(m: ModeloFactura): Promise<Blob> {
  const [{ jsPDF, GState }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  doc.setProperties({ title: `Factura ${m.numero}${m.anulada ? ' (anulada)' : ''} · Posada EC`, author: 'Posada EC', subject: 'Factura de reserva' });
  const color = (c: Rgb, que: 'text' | 'fill' | 'draw' = 'text') =>
    que === 'text' ? doc.setTextColor(...c) : que === 'fill' ? doc.setFillColor(...c) : doc.setDrawColor(...c);

  // Marca arriba a la izquierda
  color(C.marca, 'fill');
  doc.roundedRect(M, 14, 11, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(14);
  color([255, 255, 255]);
  doc.text('P', M + 5.5, 21.6, { align: 'center' });
  doc.setFontSize(18);
  color(C.marca);
  doc.text('Posada', M + 14, 21.5);
  color(C.acento);
  doc.text('EC', M + 14 + doc.getTextWidth('Posada') + 0.8, 21.5);
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  color(C.suave);
  doc.text('Marketplace de alojamientos · Ecuador', M, 31);

  // Título y datos de la factura a la derecha
  doc.setFont('helvetica', 'bold').setFontSize(24);
  color(C.marcaOsc);
  doc.text('FACTURA', W - M, 22, { align: 'right' });
  const datos: [string, string][] = [['Fecha', m.fecha], ['N.º de factura', m.numero], ['Estado', m.anulada ? 'Anulada' : 'Emitida']];
  const cajaX = W - M - 72;
  color(C.marcaSuave, 'fill');
  doc.roundedRect(cajaX, 27, 72, 21, 2, 2, 'F');
  datos.forEach(([k, v], i) => {
    const y = 33 + i * 6;
    doc.setFont('helvetica', 'normal').setFontSize(9);
    color(C.suave);
    doc.text(k, cajaX + 4, y);
    doc.setFont('helvetica', 'bold');
    color(k === 'Estado' && m.anulada ? C.peligro : C.texto);
    doc.text(v, cajaX + 68, y, { align: 'right' });
  });

  let y = 56;
  if (m.anulada && m.anuladaEl) {
    doc.setFont('helvetica', 'bold').setFontSize(10);
    color(C.peligro);
    doc.text(`Anulada el ${m.anuladaEl} por cancelación de la reserva`, M, y);
    y += 7;
  }
  color(C.borde, 'draw');
  doc.setLineWidth(0.3).line(M, y, W - M, y);
  y += 8;

  // Facturar a / Emisor
  const bloque = (x: number, titulo: string, lineas: string[]) => {
    doc.setFont('helvetica', 'bold').setFontSize(8.5);
    color(C.acento);
    doc.text(titulo.toUpperCase(), x, y);
    lineas.forEach((t, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal').setFontSize(i === 0 ? 11 : 9.5);
      color(i === 0 ? C.texto : C.suave);
      doc.text(t, x, y + 6 + i * 5);
    });
  };
  bloque(M, 'Facturar a', [m.comprador.nombre, m.comprador.documento, m.comprador.email].filter(Boolean));
  bloque(W / 2 + 6, 'Emisor', [m.emisor.nombre, m.emisor.identificacion ? `RUC/Cédula ${m.emisor.identificacion}` : 'Identificación no registrada']);
  y += 26;

  // Detalle
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Cantidad', 'Descripción', 'Precio unitario', 'Importe']],
    body: m.lineas.map((l) => [String(l.cantidad), l.descripcion, usd(l.precioUnitario), usd(l.importe)]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 3, textColor: C.texto, lineColor: C.borde },
    headStyles: { fillColor: C.marca, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 250, 249] },
    bodyStyles: { lineWidth: { bottom: 0.2 } },
    columnStyles: { 0: { halign: 'center', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 32 }, 3: { halign: 'right', cellWidth: 30 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Totales
  const tx = W - M - 72;
  const fila = (k: string, v: string) => {
    doc.setFont('helvetica', 'normal').setFontSize(10);
    color(C.suave);
    doc.text(k, tx + 4, y);
    color(C.texto);
    doc.text(v, W - M - 4, y, { align: 'right' });
    y += 6;
  };
  fila('Subtotal', usd(m.subtotal));
  fila(m.ivaPct !== null ? `IVA ${m.ivaPct} %` : 'IVA', usd(m.iva));
  color(m.anulada ? C.suave : C.marca, 'fill');
  doc.roundedRect(tx, y - 4, 72, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12);
  color([255, 255, 255]);
  doc.text('Total', tx + 4, y + 2.6);
  doc.text(usd(m.total), W - M - 4, y + 2.6, { align: 'right' });
  y += 16;

  // Reembolso (factura anulada)
  if (m.reembolso) {
    color(C.peligroSuave, 'fill');
    color(C.peligro, 'draw');
    doc.setLineWidth(0.4).roundedRect(M, y - 5, W - 2 * M, 11, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold').setFontSize(10);
    color(C.peligro);
    doc.text(m.reembolso.texto, M + 4, y + 1.8);
    y += 14;
  }

  // Observaciones
  doc.setFont('helvetica', 'bold').setFontSize(8.5);
  color(C.acento);
  doc.text('OBSERVACIONES', M, y);
  y += 5;
  doc.setFont('helvetica', 'normal').setFontSize(9.5);
  color(C.texto);
  for (const linea of m.observaciones) {
    const partes = doc.splitTextToSize(linea, W - 2 * M) as string[];
    doc.text(partes, M, y);
    y += partes.length * 5;
  }

  // Sello diagonal
  if (m.anulada) {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.18 }));
    doc.setFont('helvetica', 'bold').setFontSize(96);
    color(C.peligro);
    doc.text('ANULADA', W / 2, H / 2 + 10, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();
  }

  // Pie
  color(C.borde, 'draw');
  doc.setLineWidth(0.2).line(M, H - 18, W - M, H - 18);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  color(C.suave);
  doc.text('Prototipo académico, sin validez tributaria · Posada EC', W / 2, H - 12, { align: 'center' });

  return doc.output('blob');
}

/**
 * Abre la factura en una pestaña nueva (visor PDF del navegador). La pestaña se abre en el mismo clic
 * (si se abriera después de esperar al API, el navegador la bloquearía como ventana emergente).
 */
export async function abrirFacturaPdf(cargar: () => Promise<ModeloFactura>): Promise<void> {
  const pestana = window.open('', '_blank');
  pestana?.document.write('<p style="font-family:sans-serif;padding:2rem">Generando la factura…</p>');
  try {
    const modelo = await cargar();
    const url = URL.createObjectURL(await generarFacturaPdf(modelo));
    if (pestana) {
      pestana.location.href = url;
    } else {
      // Ventanas emergentes bloqueadas: se descarga el PDF en vez de abrirlo
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${modelo.numero}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    pestana?.close();
    throw e;
  }
}
