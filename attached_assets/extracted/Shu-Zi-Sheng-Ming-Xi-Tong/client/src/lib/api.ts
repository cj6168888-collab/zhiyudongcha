import type { Person, InsertPerson, VaultItem, InsertVaultItem, ShadowMemory, InsertShadowMemory } from "@shared/schema";

const API_BASE = "/api";

// ===== Person (Z2 Relationship Matrix) API =====
export const personApi = {
  getAll: async (): Promise<Person[]> => {
    const res = await fetch(`${API_BASE}/persons`);
    if (!res.ok) throw new Error("Failed to fetch persons");
    return res.json();
  },

  getById: async (id: string): Promise<Person> => {
    const res = await fetch(`${API_BASE}/persons/${id}`);
    if (!res.ok) throw new Error("Failed to fetch person");
    return res.json();
  },

  create: async (person: InsertPerson): Promise<Person> => {
    const res = await fetch(`${API_BASE}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(person),
    });
    if (!res.ok) throw new Error("Failed to create person");
    return res.json();
  },

  update: async (id: string, person: Partial<InsertPerson>): Promise<Person> => {
    const res = await fetch(`${API_BASE}/persons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(person),
    });
    if (!res.ok) throw new Error("Failed to update person");
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/persons/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete person");
  },

  searchByWeakness: async (keyword: string): Promise<Person[]> => {
    const res = await fetch(`${API_BASE}/persons/search/weakness?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) throw new Error("Failed to search persons");
    return res.json();
  },

  findConflicts: async (id: string): Promise<Person[]> => {
    const res = await fetch(`${API_BASE}/persons/${id}/conflicts`);
    if (!res.ok) throw new Error("Failed to find conflicts");
    return res.json();
  },
};

// ===== Vault (Z2 Resource Vault) API =====
export const vaultApi = {
  getAll: async (zone?: string): Promise<VaultItem[]> => {
    const url = zone ? `${API_BASE}/vault?zone=${zone}` : `${API_BASE}/vault`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch vault items");
    return res.json();
  },

  getById: async (id: string): Promise<VaultItem> => {
    const res = await fetch(`${API_BASE}/vault/${id}`);
    if (!res.ok) throw new Error("Failed to fetch vault item");
    return res.json();
  },

  create: async (item: InsertVaultItem): Promise<VaultItem> => {
    const res = await fetch(`${API_BASE}/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error("Failed to create vault item");
    return res.json();
  },

  update: async (id: string, item: Partial<InsertVaultItem>): Promise<VaultItem> => {
    const res = await fetch(`${API_BASE}/vault/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error("Failed to update vault item");
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/vault/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete vault item");
  },

  searchBySemantic: async (tag: string): Promise<VaultItem[]> => {
    const res = await fetch(`${API_BASE}/vault/search/semantic?tag=${encodeURIComponent(tag)}`);
    if (!res.ok) throw new Error("Failed to search vault");
    return res.json();
  },
};

// ===== Memory (Z2 Shadow Memory) API =====
export const memoryApi = {
  getAll: async (): Promise<ShadowMemory[]> => {
    const res = await fetch(`${API_BASE}/memories`);
    if (!res.ok) throw new Error("Failed to fetch memories");
    return res.json();
  },

  create: async (memory: InsertShadowMemory): Promise<ShadowMemory> => {
    const res = await fetch(`${API_BASE}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memory),
    });
    if (!res.ok) throw new Error("Failed to create memory");
    return res.json();
  },
};

// ===== Z2 Core Functions API =====
export interface RelationshipInsight {
  person: Person;
  vulnerabilityAnalysis: string;
  interestChainSummary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedApproach: string;
}

export const z2CoreApi = {
  // 博弈素材提取
  getRelationshipInsight: async (name: string): Promise<RelationshipInsight> => {
    const res = await fetch(`${API_BASE}/persons/insight/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error("Failed to get relationship insight");
    return res.json();
  },

  // 意图语义调阅
  searchVaultByIntent: async (intent: string): Promise<VaultItem[]> => {
    const res = await fetch(`${API_BASE}/vault/search/intent?q=${encodeURIComponent(intent)}`);
    if (!res.ok) throw new Error("Failed to search vault by intent");
    return res.json();
  },

  // 物理级粉碎
  permanentShred: async (targetId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/shred`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, table }),
    });
    if (!res.ok) throw new Error("Failed to shred target");
    return res.json();
  },
};
