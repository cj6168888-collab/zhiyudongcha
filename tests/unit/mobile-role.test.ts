import { describe, expect, it } from 'vitest';
import { isMobileMasterRole } from '@/lib/mobile-role';

describe('isMobileMasterRole', () => {
  it('accepts current MASTER and legacy SOVEREIGN mobile roles', () => {
    expect(isMobileMasterRole('MASTER')).toBe(true);
    expect(isMobileMasterRole('SOVEREIGN')).toBe(true);
  });

  it('rejects node, guest, missing, and unknown roles', () => {
    expect(isMobileMasterRole('NODE')).toBe(false);
    expect(isMobileMasterRole('GUEST')).toBe(false);
    expect(isMobileMasterRole(null)).toBe(false);
    expect(isMobileMasterRole('OTHER')).toBe(false);
  });
});
