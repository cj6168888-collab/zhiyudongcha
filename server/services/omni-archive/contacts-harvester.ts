import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('ContactsHarvester');

import { getDatabase } from "../../db";
import { unifiedContacts, type InsertUnifiedContact, type UnifiedContact } from "@shared/schema";
import { eq, sql, or, ilike } from "drizzle-orm";

interface RawContact {
  name: string;
  phone?: string[];
  email?: string[];
  wechatId?: string;
  dingdingId?: string;
  organization?: string;
  department?: string;
  source: {
    platform: string;
    deviceId: string;
    lastSync: Date;
  };
}

interface MergeResult {
  merged: number;
  created: number;
  updated: number;
  conflicts: Array<{
    existingId: string;
    newContact: RawContact;
    reason: string;
  }>;
}

export class ContactsHarvester {
  async harvestContacts(contacts: RawContact[], deviceId: string): Promise<MergeResult> {
    const result: MergeResult = { merged: 0, created: 0, updated: 0, conflicts: [] };

    for (const contact of contacts) {
      try {
        const existing = await this.findExisting(contact);
        
        if (existing) {
          const merged = await this.mergeContact(existing, contact);
          if (merged) {
            result.merged++;
          } else {
            result.updated++;
          }
        } else {
          await this.createContact(contact);
          result.created++;
        }
      } catch (error) {
        result.conflicts.push({
          existingId: '',
          newContact: contact,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  private async findExisting(contact: RawContact): Promise<UnifiedContact | null> {
    const conditions = [];

    if (contact.phone?.length) {
      for (const phone of contact.phone) {
        conditions.push(sql`${phone} = ANY(${unifiedContacts.phone})`);
      }
    }

    if (contact.email?.length) {
      for (const email of contact.email) {
        conditions.push(sql`${email} = ANY(${unifiedContacts.email})`);
      }
    }

    if (contact.wechatId) {
      conditions.push(eq(unifiedContacts.wechatId, contact.wechatId));
    }

    if (contact.dingdingId) {
      conditions.push(eq(unifiedContacts.dingdingId, contact.dingdingId));
    }

    if (conditions.length === 0) {
      conditions.push(ilike(unifiedContacts.name, contact.name));
    }

    const [existing] = await db
      .select()
      .from(unifiedContacts)
      .where(or(...conditions))
      .limit(1);

    return existing || null;
  }

  private async mergeContact(existing: UnifiedContact, newContact: RawContact): Promise<boolean> {
    const updates: Partial<InsertUnifiedContact> = {};
    let hasMerge = false;

    const mergedPhones = this.mergeArrays(existing.phone || [], newContact.phone || []);
    if (mergedPhones.length > (existing.phone?.length || 0)) {
      updates.phone = mergedPhones;
      hasMerge = true;
    }

    const mergedEmails = this.mergeArrays(existing.email || [], newContact.email || []);
    if (mergedEmails.length > (existing.email?.length || 0)) {
      updates.email = mergedEmails;
      hasMerge = true;
    }

    if (newContact.wechatId && !existing.wechatId) {
      updates.wechatId = newContact.wechatId;
      hasMerge = true;
    }

    if (newContact.dingdingId && !existing.dingdingId) {
      updates.dingdingId = newContact.dingdingId;
      hasMerge = true;
    }

    if (newContact.organization && !existing.organization) {
      updates.organization = newContact.organization;
    }

    if (newContact.department && !existing.department) {
      updates.department = newContact.department;
    }

    const existingSources = (existing.sources as Array<{ platform: string; deviceId: string; lastSync: Date }>) || [];
    const sourceIndex = existingSources.findIndex(
      (s) => s.platform === newContact.source.platform && s.deviceId === newContact.source.deviceId
    );
    
    if (sourceIndex >= 0) {
      existingSources[sourceIndex].lastSync = newContact.source.lastSync;
    } else {
      existingSources.push(newContact.source);
    }
    updates.sources = existingSources;

    await getDatabase().update(unifiedContacts)
      .set(updates)
      .where(eq(unifiedContacts.id, existing.id));

    return hasMerge;
  }

  private async createContact(contact: RawContact): Promise<UnifiedContact> {
    const [created] = await getDatabase().insert(unifiedContacts).values({
      name: contact.name,
      phone: contact.phone || [],
      email: contact.email || [],
      wechatId: contact.wechatId,
      dingdingId: contact.dingdingId,
      organization: contact.organization,
      department: contact.department,
      sources: [contact.source],
      importance: 50,
      trustScore: 50,
      interactionCount: 0,
      initiatedByMe: 0,
      initiatedByThem: 0,
    }).returning();

    return created;
  }

  private mergeArrays(existing: string[], incoming: string[]): string[] {
    const set = new Set([...existing, ...incoming].map(s => s.toLowerCase().trim()));
    return Array.from(set);
  }

  async getContact(id: string): Promise<UnifiedContact | null> {
    const [contact] = await getDatabase().select().from(unifiedContacts).where(eq(unifiedContacts.id, id));
    return contact || null;
  }

  async searchContacts(query: string): Promise<UnifiedContact[]> {
    return getDatabase().select().from(unifiedContacts)
      .where(or(
        ilike(unifiedContacts.name, `%${query}%`),
        ilike(unifiedContacts.organization, `%${query}%`),
        sql`${query} = ANY(${unifiedContacts.phone})`,
        sql`${query} = ANY(${unifiedContacts.email})`
      ))
      .limit(50);
  }

  async updateImportance(contactId: string, importance: number): Promise<void> {
    await getDatabase().update(unifiedContacts)
      .set({ importance, updatedAt: new Date() })
      .where(eq(unifiedContacts.id, contactId));
  }

  async updateTrustScore(contactId: string, trustScore: number): Promise<void> {
    await getDatabase().update(unifiedContacts)
      .set({ trustScore, updatedAt: new Date() })
      .where(eq(unifiedContacts.id, contactId));
  }

  async recordInteraction(contactId: string, initiatedByMe: boolean): Promise<void> {
    const [contact] = await getDatabase().select().from(unifiedContacts).where(eq(unifiedContacts.id, contactId));
    if (!contact) return;

    await getDatabase().update(unifiedContacts)
      .set({
        lastInteraction: new Date(),
        interactionCount: (contact.interactionCount || 0) + 1,
        initiatedByMe: initiatedByMe ? (contact.initiatedByMe || 0) + 1 : contact.initiatedByMe,
        initiatedByThem: !initiatedByMe ? (contact.initiatedByThem || 0) + 1 : contact.initiatedByThem,
        updatedAt: new Date()
      })
      .where(eq(unifiedContacts.id, contactId));
  }

  async getAllContacts(): Promise<UnifiedContact[]> {
    return getDatabase().select().from(unifiedContacts).orderBy(unifiedContacts.name);
  }
}

export const contactsHarvester = new ContactsHarvester();
