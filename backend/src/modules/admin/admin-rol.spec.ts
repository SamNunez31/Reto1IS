import { AdminService } from './admin.service';

type Fila = Record<string, unknown>;

/** DbService falso: devuelve en orden las respuestas indicadas y registra las consultas. */
function crear(respuestas: Fila[][]) {
  const consultas: { sql: string; params?: unknown[] }[] = [];
  const db = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      consultas.push({ sql, params });
      return respuestas.shift() ?? [];
    }),
  };
  const svc = new AdminService(db as never);
  return { svc, consultas };
}
const admin = { sub: 'a0000000-0000-4000-8000-000000000001', rol: 'ADMIN' } as never;
const ID = 'b0000000-0000-4000-8000-000000000002';

describe('AdminService.asignarRol (promover a ADMIN)', () => {
  it('promueve a un usuario activo', async () => {
    const { svc, consultas } = crear([[{ rol: 'USUARIO', activo: true }], [{ id: ID }]]);
    await expect(svc.asignarRol(ID, 'ADMIN', admin)).resolves.toEqual({ id: ID, rol: 'ADMIN' });
    expect(consultas[1].sql).toContain("rol = 'USUARIO'"); // UPDATE condicional (anti-carrera)
  });

  it('404 si el usuario no existe', async () => {
    const { svc } = crear([[]]);
    await expect(svc.asignarRol(ID, 'ADMIN', admin)).rejects.toMatchObject({ status: 404 });
  });

  it('409 si ya es administrador', async () => {
    const { svc } = crear([[{ rol: 'ADMIN', activo: true }]]);
    await expect(svc.asignarRol(ID, 'ADMIN', admin)).rejects.toMatchObject({ status: 409 });
  });

  it('409 si el usuario está desactivado (y no modifica nada)', async () => {
    const { svc, consultas } = crear([[{ rol: 'USUARIO', activo: false }]]);
    await expect(svc.asignarRol(ID, 'ADMIN', admin)).rejects.toMatchObject({ status: 409 });
    expect(consultas).toHaveLength(1);
  });

  it('409 si el admin intenta asignarse a sí mismo (sin consultar la BD)', async () => {
    const { svc, consultas } = crear([]);
    await expect(svc.asignarRol((admin as { sub: string }).sub, 'ADMIN', admin)).rejects.toMatchObject({ status: 409 });
    expect(consultas).toHaveLength(0);
  });

  it('409 si otro admin lo promovió entre la lectura y el UPDATE', async () => {
    const { svc } = crear([[{ rol: 'USUARIO', activo: true }], []]);
    await expect(svc.asignarRol(ID, 'ADMIN', admin)).rejects.toMatchObject({ status: 409 });
  });
});
