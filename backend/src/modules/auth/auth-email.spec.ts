import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { esEmailDuplicado, MENSAJE_EMAIL_DUPLICADO, normalizarEmail } from '../../common/validation/email';
import { ProblemException } from '../../common/problem/problem';
import { DbService } from '../../database/db.service';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const REGISTRO = { email: '  Ana.Paz@Gmail.COM ', password: 'Clave1234', nombres: 'Ana', apellidos: 'Paz' };

/** AuthService con la BD simulada: `uno` responde en orden con los valores dados (o lanza si es un Error). */
function servicio(...respuestas: unknown[]) {
  const llamadas: unknown[][] = [];
  const db = {
    uno: async (_sql: string, params: unknown[]) => {
      llamadas.push(params);
      const r = respuestas.shift();
      if (r instanceof Error) throw r;
      return r ?? null;
    },
  } as unknown as DbService;
  return { auth: new AuthService(db, {} as JwtService, {} as ConfigService), llamadas };
}

async function capturar(p: Promise<unknown>): Promise<ProblemException> {
  try {
    await p;
  } catch (e) {
    return e as ProblemException;
  }
  throw new Error('se esperaba un error');
}

describe('Correo: normalización y duplicados', () => {
  it('normaliza con trim y minúsculas (registro y login usan la misma regla)', () => {
    expect(normalizarEmail('  Ana.Paz@Gmail.COM ')).toBe('ana.paz@gmail.com');
    expect(plainToInstance(RegisterDto, REGISTRO).email).toBe('ana.paz@gmail.com');
    expect(plainToInstance(LoginDto, { email: 'ANA.PAZ@gmail.com ', password: 'x' }).email).toBe('ana.paz@gmail.com');
    expect(normalizarEmail(42)).toBe(42);
  });

  it('registro con un correo ya usado (otras mayúsculas) -> 409 "Ya existe una cuenta con este correo"', async () => {
    const { auth, llamadas } = servicio({ '?column?': 1 });
    const e = await capturar(auth.registrar(REGISTRO as RegisterDto));
    expect(e.getStatus()).toBe(409);
    expect(JSON.stringify(e.getResponse())).toContain(MENSAJE_EMAIL_DUPLICADO);
    expect(llamadas[0]).toEqual(['ana.paz@gmail.com']); // se busca el correo normalizado
  });

  it('dos registros simultáneos: la violación de uq_usuario_email también responde 409', async () => {
    const violacion = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_usuario_email' });
    expect(esEmailDuplicado(violacion)).toBe(true);
    expect(esEmailDuplicado({ code: '23505', constraint: 'uq_usuario_doc' })).toBe(false);
    const { auth } = servicio(null, violacion);
    const e = await capturar(auth.registrar(REGISTRO as RegisterDto));
    expect(e.getStatus()).toBe(409);
    expect(JSON.stringify(e.getResponse())).toContain(MENSAJE_EMAIL_DUPLICADO);
  });
});
