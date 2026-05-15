export type MobileStoredRole = 'MASTER' | 'SOVEREIGN' | 'NODE' | 'GUEST' | string | null;

export function isMobileMasterRole(role: MobileStoredRole): boolean {
  return role === 'MASTER' || role === 'SOVEREIGN';
}
