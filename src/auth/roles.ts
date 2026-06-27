/** Application roles. Stored as VARCHAR on `users.role`. */
export const ROLES = {
  ADMIN: 'admin',
  TRIAGE: 'triage',
  MEMBER: 'member',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles allowed to use the triage/admin surface. */
export const PANEL_ROLES: readonly Role[] = [ROLES.ADMIN, ROLES.TRIAGE];
