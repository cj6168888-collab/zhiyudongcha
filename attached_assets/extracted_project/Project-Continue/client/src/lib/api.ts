import type { Person, InsertPerson, VaultItem, InsertVaultItem, ShadowMemory, InsertShadowMemory } from "@/shared/schema";
import { apiRequest } from "./queryClient";

const API_BASE = "/api";

class NetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (error) {
    console.error('[Network] 请求失败:', url, error);
    throw new NetworkError(`网络连接失败: ${url}`, error);
  }
}

// ===== Person (Z2 Relationship Matrix) API =====
export const personApi = {
  getAll: async (): Promise<Person[]> => {
    const res = await safeFetch(`${API_BASE}/persons`);
    if (!res.ok) throw new Error(`获取联系人失败: ${res.status}`);
    return res.json();
  },

  getById: async (id: string): Promise<Person> => {
    const res = await safeFetch(`${API_BASE}/persons/${id}`);
    if (!res.ok) throw new Error(`获取联系人详情失败: ${res.status}`);
    return res.json();
  },

  create: async (person: InsertPerson): Promise<Person> => {
    const res = await safeFetch(`${API_BASE}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(person),
    });
    if (!res.ok) throw new Error(`创建联系人失败: ${res.status}`);
    return res.json();
  },

  update: async (id: string, person: Partial<InsertPerson>): Promise<Person> => {
    const res = await safeFetch(`${API_BASE}/persons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(person),
    });
    if (!res.ok) throw new Error(`更新联系人失败: ${res.status}`);
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await safeFetch(`${API_BASE}/persons/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`删除联系人失败: ${res.status}`);
  },

  searchByWeakness: async (keyword: string): Promise<Person[]> => {
    const res = await safeFetch(`${API_BASE}/persons/search/weakness?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) throw new Error(`搜索联系人失败: ${res.status}`);
    return res.json();
  },

  findConflicts: async (id: string): Promise<Person[]> => {
    const res = await safeFetch(`${API_BASE}/persons/${id}/conflicts`);
    if (!res.ok) throw new Error(`查找冲突失败: ${res.status}`);
    return res.json();
  },
};

// ===== Vault (Z2 Resource Vault) API =====
export const vaultApi = {
  getAll: async (zone?: string): Promise<VaultItem[]> => {
    const url = zone ? `${API_BASE}/vault?zone=${zone}` : `${API_BASE}/vault`;
    const res = await safeFetch(url);
    if (!res.ok) throw new Error(`获取资源库失败: ${res.status}`);
    return res.json();
  },

  getById: async (id: string): Promise<VaultItem> => {
    const res = await safeFetch(`${API_BASE}/vault/${id}`);
    if (!res.ok) throw new Error(`获取资源详情失败: ${res.status}`);
    return res.json();
  },

  create: async (item: InsertVaultItem): Promise<VaultItem> => {
    const res = await safeFetch(`${API_BASE}/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`创建资源失败: ${res.status}`);
    return res.json();
  },

  update: async (id: string, item: Partial<InsertVaultItem>): Promise<VaultItem> => {
    const res = await safeFetch(`${API_BASE}/vault/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`更新资源失败: ${res.status}`);
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await safeFetch(`${API_BASE}/vault/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`删除资源失败: ${res.status}`);
  },

  searchBySemantic: async (tag: string): Promise<VaultItem[]> => {
    const res = await safeFetch(`${API_BASE}/vault/search/semantic?tag=${encodeURIComponent(tag)}`);
    if (!res.ok) throw new Error(`搜索资源失败: ${res.status}`);
    return res.json();
  },
};

// ===== Memory (Z2 Shadow Memory) API =====
export const memoryApi = {
  getAll: async (): Promise<ShadowMemory[]> => {
    const res = await safeFetch(`${API_BASE}/memories`);
    if (!res.ok) throw new Error(`获取记忆库失败: ${res.status}`);
    return res.json();
  },

  create: async (memory: InsertShadowMemory): Promise<ShadowMemory> => {
    const res = await safeFetch(`${API_BASE}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memory),
    });
    if (!res.ok) throw new Error(`创建记忆失败: ${res.status}`);
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
  getRelationshipInsight: async (name: string): Promise<RelationshipInsight> => {
    const res = await safeFetch(`${API_BASE}/persons/insight/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`获取关系洞察失败: ${res.status}`);
    return res.json();
  },

  searchVaultByIntent: async (intent: string): Promise<VaultItem[]> => {
    const res = await safeFetch(`${API_BASE}/vault/search/intent?q=${encodeURIComponent(intent)}`);
    if (!res.ok) throw new Error(`意图搜索失败: ${res.status}`);
    return res.json();
  },

  permanentShred: async (targetId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }> => {
    const res = await apiRequest('POST', '/api/shred', { targetId, table });
    return res.json();
  },
};
