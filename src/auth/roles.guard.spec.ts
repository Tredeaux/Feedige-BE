import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES } from './roles';

function contextWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => null,
    getClass: () => null,
  } as unknown as ExecutionContext;
}

function reflectorReturning(roles: unknown): Reflector {
  return { getAllAndOverride: () => roles } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('allows the request when no roles are required', () => {
    const guard = new RolesGuard(reflectorReturning(undefined));
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it('allows a user who has a required role', () => {
    const guard = new RolesGuard(
      reflectorReturning([ROLES.ADMIN, ROLES.TRIAGE]),
    );
    const ctx = contextWithUser({
      userId: 'u1',
      email: 'a@b.com',
      role: ROLES.TRIAGE,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies a user who lacks the required role', () => {
    const guard = new RolesGuard(reflectorReturning([ROLES.ADMIN]));
    const ctx = contextWithUser({
      userId: 'u1',
      email: 'a@b.com',
      role: ROLES.MEMBER,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
