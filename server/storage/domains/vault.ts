import { vaultRepository } from '../../repositories';
import type { VaultItem, InsertVaultItem } from '@shared/schema';

export interface IVaultStorage {
  getVaultItem(id: string): Promise<VaultItem | undefined>;
  getAllVaultItems(zone?: string): Promise<VaultItem[]>;
  createVaultItem(item: InsertVaultItem): Promise<VaultItem>;
  updateVaultItem(id: string, item: Partial<InsertVaultItem>): Promise<VaultItem | undefined>;
  deleteVaultItem(id: string): Promise<boolean>;
  searchVaultBySemanticTag(tag: string): Promise<VaultItem[]>;
  searchVaultByIntent(intent: string): Promise<VaultItem[]>;
}

export class VaultStorage implements IVaultStorage {
  async getVaultItem(id: string): Promise<VaultItem | undefined> {
    return await vaultRepository.findById(id);
  }

  async getAllVaultItems(zone?: string): Promise<VaultItem[]> {
    return await vaultRepository.getAllByZone(zone);
  }

  async createVaultItem(item: InsertVaultItem): Promise<VaultItem> {
    return await vaultRepository.create(item);
  }

  async updateVaultItem(id: string, item: Partial<InsertVaultItem>): Promise<VaultItem | undefined> {
    return await vaultRepository.update(id, item);
  }

  async deleteVaultItem(id: string): Promise<boolean> {
    return await vaultRepository.delete(id);
  }

  async searchVaultBySemanticTag(tag: string): Promise<VaultItem[]> {
    return await vaultRepository.searchBySemanticTag(tag);
  }

  async searchVaultByIntent(intent: string): Promise<VaultItem[]> {
    return await vaultRepository.searchByIntent(intent);
  }
}

export const vaultStorage = new VaultStorage();
