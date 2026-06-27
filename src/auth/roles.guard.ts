import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import type { Role } from './roles';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * Authorizes a request against the roles declared via `@Roles(...)`. Routes with
 * no `@Roles` metadata are allowed (authentication is handled separately by
 * `JwtAuthGuard`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || !required.includes(user.role as Role)) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return true;
  }
}
