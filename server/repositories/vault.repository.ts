import { eq, sql, or } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { vaultItems, type VaultItem, type InsertVaultItem } from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('VaultRepository');

export class VaultRepository extends BaseRepository<VaultItem, InsertVaultItem> {
  constructor() {
    super('VaultRepository');
  }

  protected getTable() {
    return vaultItems;
  }

  protected getIdColumn() {
    return vaultItems.id;
  }

  async getAllByZone(zone?: string): Promise<VaultItem[]> {
    if (zone) {
      return await this.db.select().from(vaultItems).where(eq(vaultItems.privacyZone, zone));
    }
    return await this.db.select().from(vaultItems);
  }

  async searchBySemanticTag(tag: string): Promise<VaultItem[]> {
    return await this.db.select().from(vaultItems).where(
      sql`${tag} = ANY(${vaultItems.semanticTags})`
    );
  }

  async searchByIntent(intent: string): Promise<VaultItem[]> {
    return await this.db.select().from(vaultItems).where(
      or(
        sql`${vaultItems.fileName} ILIKE ${`%${intent}%`}`,
        sql`${vaultItems.semanticIndex} ILIKE ${`%${intent}%`}`,
        sql`EXISTS (SELECT 1 FROM unnest(${vaultItems.semanticTags}) AS tag WHERE tag ILIKE ${`%${intent}%`})`
      )
    );
  }

  async getByCategory(category: string): Promise<VaultItem[]> {
    return await this.db.select().from(vaultItems).where(eq(vaultItems.category, category));
  }

  async getCategoryStats(): Promise<Record<string, number>> {
    const items = await this.db.select().from(vaultItems);
    const stats: Record<string, number> = { RESEARCH: 0, SOFTWARE: 0, MEDIA: 0, BOOKS: 0 };
    
    items.forEach(item => {
      if (item.category && stats[item.category] !== undefined) {
        stats[item.category]++;
      }
    });
    
    return stats;
  }
}

export const vaultRepository = new VaultRepository();
