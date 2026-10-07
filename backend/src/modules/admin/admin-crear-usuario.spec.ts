import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminService } from './admin.service';
import { CrearUsuarioDto } from './dto/admin.dto';

type Fila = Record<string, unknown>;

function crear(opts: { existe?: boolean; errorInsert?: unknown } = {}) {
  const llamadas: { sql: string; params: unknown[] }[] = [];
  const db = {
    uno: jest.fn(async (sql: string, params: unknown[]) => {
      llamadas.push({ sql, params });
      if (sql.startsWith('SELECT 1')) return opts.existe ? ({ '?column?': 1 } as Fila) : null;
      if (opts.errorInsert) throw opts.errorInsert;
      return { id: 'u-1', email: params[0], nombres: params[2], apellidos: params[3], rol: 'USUARIO', activo: true } as Fila;
    }),
  };
  return { svc: new AdminService(db as never), llamadas };
}
const DTO = { email: 'Nuevo.Usuario@Gmail.com ', password: 'Clave1234', nombres: 'Ana María', apellidos: 'Paz' };

describe('AdminService.crearUsuario', () => {
  it('crea el usuario ACTIVO con rol USUARIO, correo normalizado y clave con bcrypt (sin devolver el hash)', async () => {
    const { svc, llamadas } = crear();
    const r = await svc.crearUsuario(DTO as never);
    expect(r).toMatchObject({ email: 'nuevo.usuario@gmail.com', rol: 'USUARIO', activo: true });
    expect(JSON.stringify(r)).not.toContain('password');
    const insert = llamadas[1];
    expect(insert.sql).toContain("'USUARIO', true");
    expect(String(insert.params[1])).toMatch(/^\$2[aby]\$12\$/); // bcrypt costo 12, nunca la clave en claro
    expect(insert.params).not.toContain('Clave1234');
  });

  it('ignora un "rol" enviado en el cuerpo: siempre crea USUARIO (no se puede crear un admin por esta ruta)', async () => {
    const { svc, llamadas } = crear();
    const r = await svc.crearUsuario({ ...DTO, rol: 'ADMIN' } as never);
    expect(r.rol).toBe('USUARIO');
    expect(llamadas[1].params).not.toContain('ADMIN');
  });

  it('409 si el correo ya existe (no inserta nada)', async () => {
    const { svc, llamadas } = crear({ existe: true });
    await expect(svc.crearUsuario(DTO as never)).rejects.toMatchObject({ status: 409 });
    expect(llamadas).toHaveLength(1);
  });

  it('409 si dos altas simultáneas chocan con uq_usuario_email', async () => {
    const violacion = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_usuario_email' });
    const { svc } = crear({ errorInsert: violacion });
    await expect(svc.crearUsuario(DTO as never)).rejects.toMatchObject({ status: 409 });
  });

  it('otros errores de la BD no se ocultan', async () => {
    const { svc } = crear({ errorInsert: new Error('boom') });
    await expect(svc.crearUsuario(DTO as never)).rejects.toThrow('boom');
  });
});

describe('CrearUsuarioDto (validación)', () => {
  const validar = async (o: Record<string, unknown>) => (await validate(plainToInstance(CrearUsuarioDto, o))).map((e) => e.property);

  it('acepta un alta válida y normaliza el correo', async () => {
    const dto = plainToInstance(CrearUsuarioDto, DTO);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('nuevo.usuario@gmail.com');
  });
  it('rechaza clave débil, correo inválido y nombres con números', async () => {
    expect(await validar({ ...DTO, password: 'abc' })).toContain('password');
    expect(await validar({ ...DTO, email: 'sin-arroba' })).toContain('email');
    expect(await validar({ ...DTO, nombres: 'Ana2' })).toContain('nombres');
    expect(await validar({ ...DTO, apellidos: '' })).toContain('apellidos');
  });
});
