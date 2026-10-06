import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ProblemException, prohibido } from '../problem/problem';
import { ES_PUBLICO, Rol, ROLES, Scope, SCOPES, UsuarioToken } from './decorators';

/** Guard global: exige un Bearer JWT HS256 válido salvo en rutas @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [ctx.getHandler(), ctx.getClass()]);
    if (publico) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const [tipo, token] = (req.header('authorization') ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new ProblemException(401, 'VALIDATION_FAILED', 'Falta el token de acceso');
    try {
      req.user = await this.jwt.verifyAsync<UsuarioToken>(token, { algorithms: ['HS256'] });
    } catch {
      throw new ProblemException(401, 'VALIDATION_FAILED', 'Token inválido o expirado');
    }
    return true;
  }
}

/** Verifica el rol declarado con @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user || !roles.includes(user.rol)) throw prohibido('Tu rol no permite esta operación');
    return true;
  }
}

/** Verifica que el claim `scope` del JWT contenga los scopes de @Scopes(). */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<Scope[]>(SCOPES, [ctx.getHandler(), ctx.getClass()]);
    if (!requeridos?.length) return true;
    const user = ctx.switchToHttp().getRequest<Request>().user;
    const concedidos = (user?.scope ?? '').split(' ');
    const faltan = requeridos.filter((s) => !concedidos.includes(s));
    if (faltan.length) throw prohibido(`Falta el scope: ${faltan.join(', ')}`);
    return true;
  }
}
