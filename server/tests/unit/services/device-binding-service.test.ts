import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../db', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../db';
import { deviceBindingService } from '../../../services/devices/DeviceBindingService';

function makeDb(rows: any[] = [], rowCount = 1) {
  return { execute: vi.fn().mockResolvedValue({ rows, rowCount }) };
}

const OWNER = 'user-001';
const IDENTITY = 'identity-001';

const DEVICE_ROW = {
  id: 'binding-001',
  owner_id: OWNER,
  identity_id: IDENTITY,
  device_id: 'dev-001',
  device_type: 'esp32_voice',
  provider: 'esp32_voice',
  display_name: '桌面小语',
  status: 'active',
  capabilities: {},
  allowed_modes: ['casual_chat', 'record_note'],
  risk_policy: {},
  last_seen_at: null,
  bound_at: new Date().toISOString(),
  revoked_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeviceBindingService.isAwakeningComplete', () => {
  it('returns true for default user (dev mode)', async () => {
    const result = await deviceBindingService.isAwakeningComplete('default');
    expect(result).toBe(true);
  });

  it('returns true when user_settings row exists', async () => {
    const db = makeDb([{ id: 'settings-001' }]);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const result = await deviceBindingService.isAwakeningComplete(OWNER);
    expect(result).toBe(true);
  });

  it('returns false when no user_settings row', async () => {
    const db = makeDb([]);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const result = await deviceBindingService.isAwakeningComplete(OWNER);
    expect(result).toBe(false);
  });

  it('returns true on DB error (graceful degradation)', async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error('table not found')) };
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const result = await deviceBindingService.isAwakeningComplete(OWNER);
    expect(result).toBe(true);
  });
});

describe('DeviceBindingService.generateBindCode', () => {
  it('generates a 6-digit code for awakened user', async () => {
    // default user is always awakened
    const entry = await deviceBindingService.generateBindCode('default', IDENTITY);
    expect(entry.code).toMatch(/^\d{6}$/);
    expect(entry.ownerId).toBe('default');
    expect(entry.expiresAt).toBeGreaterThan(Date.now());
  });

  it('throws AWAKENING_REQUIRED when not awakened', async () => {
    const db = makeDb([]); // no settings row → not awakened
    vi.mocked(getDatabase).mockReturnValue(db as any);
    await expect(deviceBindingService.generateBindCode(OWNER, IDENTITY)).rejects.toThrow('AWAKENING_REQUIRED');
  });
});

describe('DeviceBindingService.confirmBinding', () => {
  it('throws INVALID_OR_EXPIRED_CODE for unknown code', async () => {
    await expect(
      deviceBindingService.confirmBinding({
        code: '000000',
        deviceId: 'dev-x',
        deviceType: 'esp32_voice',
      })
    ).rejects.toThrow('INVALID_OR_EXPIRED_CODE');
  });

  it('creates binding record after valid code', async () => {
    // Generate a code first (default user always awake)
    const entry = await deviceBindingService.generateBindCode('default', IDENTITY);

    const db = makeDb([DEVICE_ROW]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await deviceBindingService.confirmBinding({
      code: entry.code,
      deviceId: 'dev-001',
      deviceType: 'esp32_voice',
      displayName: '桌面小语',
    });

    expect(result.deviceId).toBe('dev-001');
    expect(result.status).toBe('active');
    // Code should be consumed (second call should fail)
    await expect(
      deviceBindingService.confirmBinding({
        code: entry.code,
        deviceId: 'dev-001',
        deviceType: 'esp32_voice',
      })
    ).rejects.toThrow('INVALID_OR_EXPIRED_CODE');
  });
});

describe('DeviceBindingService.listDevices', () => {
  it('returns empty array when db unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await deviceBindingService.listDevices(OWNER);
    expect(result).toEqual([]);
  });

  it('returns mapped device list', async () => {
    const db = makeDb([DEVICE_ROW]);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const result = await deviceBindingService.listDevices(OWNER);
    expect(result).toHaveLength(1);
    expect(result[0].deviceId).toBe('dev-001');
    expect(result[0].allowedModes).toContain('casual_chat');
  });
});

describe('DeviceBindingService.revokeDevice', () => {
  it('returns false when db unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await deviceBindingService.revokeDevice('dev-001', OWNER);
    expect(result).toBe(false);
  });

  it('returns true on successful revoke', async () => {
    const db = makeDb([{ id: 'binding-001' }], 1);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const result = await deviceBindingService.revokeDevice('dev-001', OWNER);
    expect(result).toBe(true);
  });

  it('returns false when device not found', async () => {
    const db = makeDb([], 0);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const result = await deviceBindingService.revokeDevice('dev-x', OWNER);
    expect(result).toBe(false);
  });
});

describe('DeviceBindingService.validateDevice', () => {
  it('returns null when db unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await deviceBindingService.validateDevice('dev-001');
    expect(result).toBeNull();
  });

  it('returns device when found and active', async () => {
    const db = makeDb([DEVICE_ROW]);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const result = await deviceBindingService.validateDevice('dev-001');
    expect(result?.deviceId).toBe('dev-001');
    expect(result?.status).toBe('active');
  });
});
