import { userRepository, userSettingsRepository, voiceprintRepository, voiceAuthorizationRepository } from '../../repositories';
import type { User, UserSettings, Voiceprint, VoiceAuthorization, InsertUser, InsertUserSettings, InsertVoiceprint, InsertVoiceAuthorization } from '@shared/schema';

export interface IUserStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  getAllUserSettings(): Promise<UserSettings[]>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
  deleteUserSettings(userId: string): Promise<boolean>;
  
  getVoiceprint(userId: string): Promise<Voiceprint | undefined>;
  getMasterVoiceprint(): Promise<Voiceprint | undefined>;
  createVoiceprint(voiceprint: InsertVoiceprint): Promise<Voiceprint>;
  updateVoiceprint(userId: string, updates: Partial<InsertVoiceprint>): Promise<Voiceprint | undefined>;
  
  getVoiceAuthorizations(): Promise<VoiceAuthorization[]>;
  createVoiceAuthorization(auth: InsertVoiceAuthorization): Promise<VoiceAuthorization>;
  deactivateVoiceAuthorization(id: string): Promise<boolean>;
}

export class UserStorage implements IUserStorage {
  async getUser(id: string): Promise<User | undefined> {
    return await userRepository.findById(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await userRepository.getByUsername(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await userRepository.create(insertUser);
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    return await userRepository.update(id, updates);
  }

  async deleteUser(id: string): Promise<boolean> {
    return await userRepository.delete(id);
  }
  
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return await userSettingsRepository.getByUserId(userId);
  }

  async getAllUserSettings(): Promise<UserSettings[]> {
    return await userSettingsRepository.findAll();
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    return await userSettingsRepository.create(settings);
  }

  async updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    return await userSettingsRepository.updateByUserId(userId, updates);
  }

  async deleteUserSettings(userId: string): Promise<boolean> {
    return await userSettingsRepository.deleteByUserId(userId);
  }
  
  async getVoiceprint(userId: string): Promise<Voiceprint | undefined> {
    return await voiceprintRepository.getByUserId(userId);
  }

  async getMasterVoiceprint(): Promise<Voiceprint | undefined> {
    return await voiceprintRepository.getMaster();
  }

  async createVoiceprint(voiceprint: InsertVoiceprint): Promise<Voiceprint> {
    return await voiceprintRepository.create(voiceprint);
  }

  async updateVoiceprint(userId: string, updates: Partial<InsertVoiceprint>): Promise<Voiceprint | undefined> {
    return await voiceprintRepository.updateByUserId(userId, updates);
  }
  
  async getVoiceAuthorizations(): Promise<VoiceAuthorization[]> {
    return await voiceAuthorizationRepository.getActive();
  }

  async createVoiceAuthorization(auth: InsertVoiceAuthorization): Promise<VoiceAuthorization> {
    return await voiceAuthorizationRepository.create(auth);
  }

  async deactivateVoiceAuthorization(id: string): Promise<boolean> {
    return await voiceAuthorizationRepository.deactivate(id);
  }
}

export const userStorage = new UserStorage();
