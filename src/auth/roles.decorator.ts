import { SetMetadata } from '@nestjs/common';
import type { Role } from './roles';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to the given roles. Use together with `RolesGuard` (and a
 * preceding `JwtAuthGuard` so `request.user` is populated). Example:
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(ROLES.ADMIN, ROLES.TRIAGE)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
