import { eq, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
  users,
  userSettings,
  voiceprints,
  voiceAuthorizations,
  type User,
  type InsertUser,
  type UserSettings,
  type InsertUserSettings,
  type Voiceprint,
  type InsertVoiceprint,
  type VoiceAuthorization,
  type InsertVoiceAuthorization
} from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('UserRepository');

export class UserRepository extends BaseRepository<User, InsertUser> {
  constructor() {
    super('UserRepository');
  }

  protected getTable() {
    return users;
  }

  protected getIdColumn() {
    return users.id;
  }

  async getByUsername(username: string): Promise<User | undefined> {
    const results = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return results[0];
  }
}

export class UserSettingsRepository extends BaseRepository<UserSettings, InsertUserSettings> {
  constructor() {
    super('UserSettingsRepository');
  }

  protected getTable() {
    return userSettings;
  }

  protected getIdColumn() {
    return userSettings.id;
  }

  async getByUserId(userId: string): Promise<UserSettings | undefined> {
    const results = await this.db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    return results[0];
  }

  async updateByUserId(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const results = await this.db.update(userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return results[0];
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const results = await this.db.delete(userSettings).where(eq(userSettings.userId, userId)).returning() as unknown[];
    return results.length > 0;
  }
}

export class VoiceprintRepository extends BaseRepository<Voiceprint, InsertVoiceprint> {
  constructor() {
    super('VoiceprintRepository');
  }

  protected getTable() {
    return voiceprints;
  }

  protected getIdColumn() {
    return voiceprints.id;
  }

  async getByUserId(userId: string): Promise<Voiceprint | undefined> {
    const results = await this.db.select().from(voiceprints).where(eq(voiceprints.userId, userId)).limit(1);
    return results[0];
  }

  async getMaster(): Promise<Voiceprint | undefined> {
    const results = await this.db.select().from(voiceprints)
      .where(sql`${voiceprints.label} = 'MASTER' AND ${voiceprints.isActive} = 1`)
      .limit(1);
    return results[0];
  }

  async updateByUserId(userId: string, updates: Partial<InsertVoiceprint>): Promise<Voiceprint | undefined> {
    const results = await this.db.update(voiceprints)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(voiceprints.userId, userId))
      .returning();
    return results[0];
  }
}

export class VoiceAuthorizationRepository extends BaseRepository<VoiceAuthorization, InsertVoiceAuthorization> {
  constructor() {
    super('VoiceAuthorizationRepository');
  }

  protected getTable() {
    return voiceAuthorizations;
  }

  protected getIdColumn() {
    return voiceAuthorizations.id;
  }

  async getActive(): Promise<VoiceAuthorization[]> {
    return await this.db.select().from(voiceAuthorizations)
      .where(eq(voiceAuthorizations.isActive, 1))
      .orderBy(sql`created_at DESC`);
  }

  async deactivate(id: string): Promise<boolean> {
    await this.db.update(voiceAuthorizations)
      .set({ isActive: 0 })
      .where(eq(voiceAuthorizations.id, id));
    return true;
  }
}

export const userRepository = new UserRepository();
export const userSettingsRepository = new UserSettingsRepository();
export const voiceprintRepository = new VoiceprintRepository();
export const voiceAuthorizationRepository = new VoiceAuthorizationRepository();
