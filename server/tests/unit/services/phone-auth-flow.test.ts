import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InsertUser, User } from '../../../../shared/schema';

const userStore = vi.hoisted(() => new Map<string, User>());
const idStore = vi.hoisted(() => new Map<string, User>());
const userStorageMock = vi.hoisted(() => ({
  getUser: vi.fn(async (id: string) => idStore.get(id)),
  getUserByUsername: vi.fn(async (username: string) => userStore.get(username)),
  createUser: vi.fn(async (insertUser: InsertUser) => {
    const user = {
      id: `user-${userStore.size + 1}`,
      username: insertUser.username,
      password: insertUser.password,
    } as User;
    userStore.set(user.username, user);
    idStore.set(user.id, user);
    return user;
  }),
  updateUser: vi.fn(async (id: string, updates: Partial<InsertUser>) => {
    const existing = idStore.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates } as User;
    if (updated.username !== existing.username) {
      userStore.delete(existing.username);
    }
    userStore.set(updated.username, updated);
    idStore.set(id, updated);
    return updated;
  }),
  deleteUser: vi.fn(async (id: string) => {
    const existing = idStore.get(id);
    if (!existing) return false;
    idStore.delete(id);
    userStore.delete(existing.username);
    return true;
  }),
}));

vi.mock('../../../storage/domains', () => ({
  userStorage: userStorageMock,
}));

import { smsVerificationService } from '../../../services/sms-verification';
import { UserService } from '../../../services/UserService';

let phoneSequence = 0;

function nextPhone(): string {
  phoneSequence += 1;
  return `1380000${String(phoneSequence).padStart(4, '0')}`;
}

describe('phone auth service flow', () => {
  let userService: UserService;

  beforeEach(() => {
    userStore.clear();
    idStore.clear();
    vi.clearAllMocks();
    userService = new UserService();
  });

  it('registers with a dry-run SMS code, logs in, resets password, and logs in with the new password', async () => {
    const phone = nextPhone();
    const initialPassword = 'password123';
    const nextPassword = 'newpass123';

    const registerSms = await smsVerificationService.sendCode(phone, 'register');
    expect(registerSms).toMatchObject({
      phone,
      expiresIn: 300,
      cooldownSeconds: 60,
    });
    expect(registerSms.debugCode).toMatch(/^\d{6}$/);

    smsVerificationService.verifyCode(phone, 'register', registerSms.debugCode!);
    const created = await userService.createUserWithPassword(phone, initialPassword);

    expect(created.username).toBe(phone);
    expect(created.password).not.toBe(initialPassword);
    expect(created.password).toMatch(/^scrypt:/);

    await expect(userService.validatePassword(phone, initialPassword)).resolves.toMatchObject({
      id: created.id,
      username: phone,
    });

    const resetSms = await smsVerificationService.sendCode(phone, 'reset_password');
    expect(resetSms.debugCode).toMatch(/^\d{6}$/);

    smsVerificationService.verifyCode(phone, 'reset_password', resetSms.debugCode!);
    const reset = await userService.resetPassword(phone, nextPassword);

    expect(reset.id).toBe(created.id);
    expect(reset.password).not.toBe(created.password);
    await expect(userService.validatePassword(phone, initialPassword)).resolves.toBeNull();
    await expect(userService.validatePassword(phone, nextPassword)).resolves.toMatchObject({
      id: created.id,
      username: phone,
    });
  });

  it('consumes SMS codes after successful verification', async () => {
    const phone = nextPhone();
    const sms = await smsVerificationService.sendCode(phone, 'register');

    expect(() => smsVerificationService.verifyCode(phone, 'register', sms.debugCode!)).not.toThrow();
    expect(() => smsVerificationService.verifyCode(phone, 'register', sms.debugCode!)).toThrow();
  });
});
