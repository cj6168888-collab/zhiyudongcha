/**
 * vault-merge.test.ts
 *
 * 验证 VaultStorage.searchVaultByIntent 跨分类合并搜索行为：
 * - 结果应跨越 fileName / semanticIndex / semanticTags 三条检索路径
 * - 不同 category（MEMORY / DOCUMENT / SCREEN）的记录共同出现在同一结果集
 * - 短词精确匹配、大小写不敏感、空查询降级
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── 模拟 vaultRepository ──────────────────────────────────────────────────────
const mockItems: Array<{
  id: string;
  fileName: string | null;
  semanticIndex: string | null;
  semanticTags: string[] | null;
  category: string | null;
  privacyZone: string | null;
  createdAt: Date | null;
}> = [];

function ilike(value: string | null, pattern: string): boolean {
  if (!value) return false;
  const kw = pattern.replace(/%/g, '').toLowerCase();
  return value.toLowerCase().includes(kw);
}

function tagIlike(tags: string[] | null, pattern: string): boolean {
  if (!tags) return false;
  const kw = pattern.replace(/%/g, '').toLowerCase();
  return tags.some((t) => t.toLowerCase().includes(kw));
}

vi.mock('../../../repositories', () => ({
  vaultRepository: {
    searchByIntent: vi.fn(async (intent: string) => {
      if (!intent || intent.trim() === '') return [];
      return mockItems.filter(
        (item) =>
          ilike(item.fileName, `%${intent}%`) ||
          ilike(item.semanticIndex, `%${intent}%`) ||
          tagIlike(item.semanticTags, `%${intent}%`),
      );
    }),
    searchBySemanticTag: vi.fn(async (tag: string) =>
      mockItems.filter((item) => tagIlike(item.semanticTags, `%${tag}%`)),
    ),
    findById:    vi.fn(),
    getAllByZone: vi.fn(async () => mockItems),
    create:      vi.fn(),
    update:      vi.fn(),
    delete:      vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

import { VaultStorage } from '../../../storage/domains/vault';

// ─────────────────────────────────────────────────────────────────────────────

const now = new Date();

function makeItem(overrides: Partial<(typeof mockItems)[0]>): (typeof mockItems)[0] {
  return {
    id:           `vault-${Math.random().toString(36).slice(2)}`,
    fileName:     null,
    semanticIndex: null,
    semanticTags:  null,
    category:     'MEMORY',
    privacyZone:  'ZONE_GREEN',
    createdAt:    now,
    ...overrides,
  };
}

describe('VaultStorage.searchVaultByIntent — 跨库合并搜索', () => {
  let storage: VaultStorage;

  beforeEach(() => {
    storage = new VaultStorage();
    mockItems.length = 0;
  });

  // ── 基础路径 ────────────────────────────────────────────────────────────────

  it('通过 fileName 匹配 MEMORY 类型记录', async () => {
    mockItems.push(makeItem({ fileName: '季度合同扫描件', category: 'MEMORY' }));
    const results = await storage.searchVaultByIntent('合同');
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('MEMORY');
  });

  it('通过 semanticIndex 匹配 DOCUMENT 类型记录', async () => {
    mockItems.push(makeItem({
      fileName:     '项目文档.pdf',
      semanticIndex: '该文件包含了融资计划书的核心内容',
      category:     'DOCUMENT',
    }));
    const results = await storage.searchVaultByIntent('融资计划');
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('DOCUMENT');
  });

  it('通过 semanticTags 匹配 SCREEN 类型记录', async () => {
    mockItems.push(makeItem({
      fileName:    '截图_20260503.png',
      semanticTags: ['医疗', '体检报告', '健康数据'],
      category:   'SCREEN',
    }));
    const results = await storage.searchVaultByIntent('体检');
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('SCREEN');
  });

  // ── 跨分类合并 ──────────────────────────────────────────────────────────────

  it('同一关键词可从多个 category 返回结果', async () => {
    mockItems.push(
      makeItem({ fileName: '合同甲方.docx',   category: 'MEMORY' }),
      makeItem({ semanticIndex: '含合同条款的邮件备份', category: 'DOCUMENT' }),
      makeItem({ semanticTags: ['合同', '签署'], category: 'SCREEN' }),
    );
    const results = await storage.searchVaultByIntent('合同');
    expect(results).toHaveLength(3);
    const categories = results.map((r) => r.category);
    expect(categories).toContain('MEMORY');
    expect(categories).toContain('DOCUMENT');
    expect(categories).toContain('SCREEN');
  });

  it('不相关记录不出现在结果集', async () => {
    mockItems.push(
      makeItem({ fileName: '项目进度表.xlsx',  category: 'DOCUMENT' }),
      makeItem({ semanticIndex: '团队会议纪要', category: 'MEMORY' }),
    );
    const results = await storage.searchVaultByIntent('医疗');
    expect(results).toHaveLength(0);
  });

  // ── 大小写不敏感 ─────────────────────────────────────────────────────────────

  it('大小写不敏感匹配（大写关键词）', async () => {
    mockItems.push(makeItem({ fileName: 'OpenAI 使用协议', category: 'DOCUMENT' }));
    const results = await storage.searchVaultByIntent('openai');
    expect(results).toHaveLength(1);
  });

  it('大小写不敏感匹配（混合大小写）', async () => {
    mockItems.push(makeItem({ semanticIndex: 'ChatGPT 对话记录归档' }));
    const results = await storage.searchVaultByIntent('chatgpt');
    expect(results).toHaveLength(1);
  });

  // ── 同一记录多路径命中只计一次 ──────────────────────────────────────────────

  it('记录在多条路径均命中时不会重复返回（由 Repository OR 逻辑保证）', async () => {
    mockItems.push(makeItem({
      fileName:      '合同终稿.pdf',
      semanticIndex: '该文件是合同的最终签署版本',
      semanticTags:  ['合同', '签署'],
      category:      'DOCUMENT',
    }));
    const results = await storage.searchVaultByIntent('合同');
    expect(results).toHaveLength(1);
  });

  // ── 边界值 ──────────────────────────────────────────────────────────────────

  it('空库返回空结果', async () => {
    const results = await storage.searchVaultByIntent('任意内容');
    expect(results).toHaveLength(0);
  });

  it('空字符串 intent 返回空结果', async () => {
    mockItems.push(makeItem({ fileName: '某记录' }));
    const results = await storage.searchVaultByIntent('');
    expect(results).toHaveLength(0);
  });

  it('单字符关键词仍可命中', async () => {
    mockItems.push(makeItem({ fileName: '钱的故事', category: 'MEMORY' }));
    const results = await storage.searchVaultByIntent('钱');
    expect(results).toHaveLength(1);
  });

  // ── 标签数组匹配 ─────────────────────────────────────────────────────────────

  it('tags 数组中任意一个标签匹配即命中', async () => {
    mockItems.push(makeItem({
      semanticTags: ['旅游', '签证', '护照'],
      category:     'MEMORY',
    }));
    const byFirst  = await storage.searchVaultByIntent('旅游');
    const byMiddle = await storage.searchVaultByIntent('签证');
    const byLast   = await storage.searchVaultByIntent('护照');
    expect(byFirst).toHaveLength(1);
    expect(byMiddle).toHaveLength(1);
    expect(byLast).toHaveLength(1);
  });

  it('多条记录满足 tag 匹配时全部返回', async () => {
    mockItems.push(
      makeItem({ semanticTags: ['健康', '体检'],  category: 'MEMORY'   }),
      makeItem({ semanticTags: ['健康', '运动'],  category: 'DOCUMENT' }),
      makeItem({ semanticTags: ['运动记录'],      category: 'SCREEN'   }),
    );
    const results = await storage.searchVaultByIntent('健康');
    expect(results).toHaveLength(2);
  });
});
