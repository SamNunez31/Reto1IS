import { agruparPorMes, escalaBonita } from './dashboard.component';

describe('Dashboard: agregaciones', () => {
  it('agrupa ventas por mes (12 meses, solo confirmadas/completadas)', () => {
    const hoy = new Date(2026, 9, 6); // 6 de octubre de 2026
    const meses = agruparPorMes(
      [
        { estado: 'CONFIRMADA', created_at: '2026-10-02T15:00:00Z', total: '100.50' as unknown as number },
        { estado: 'COMPLETADA', created_at: '2026-10-03T15:00:00Z', total: 49.5 },
        { estado: 'CANCELADA', created_at: '2026-10-03T15:00:00Z', total: 999 },
        { estado: 'CONFIRMADA', created_at: '2026-05-10T15:00:00Z', total: 10 },
        { estado: 'CONFIRMADA', created_at: '2024-01-10T15:00:00Z', total: 10 },
      ],
      hoy,
    );
    expect(meses.length).toBe(12);
    expect(meses[0].clave).toBe('2025-11');
    expect(meses[11]).toEqual(jasmine.objectContaining({ clave: '2026-10', reservas: 2, volumen: 150 }));
    expect(meses.find((m) => m.clave === '2026-05')?.volumen).toBe(10);
    expect(meses.reduce((s, m) => s + m.reservas, 0)).toBe(3);
  });

  it('escala del eje Y redonda y que cubre el máximo', () => {
    const e = escalaBonita(2298.39);
    expect(e.length).toBe(5);
    expect(e[0]).toBe(0);
    expect(e[4]).toBeGreaterThanOrEqual(2298.39);
    expect(escalaBonita(0)).toEqual([0, 25, 50, 75, 100]);
  });
});
