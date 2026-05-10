import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../storage/domains', () => ({
  vaultStorage: {
    getAllVaultItems: vi.fn(),
    getVaultItem: vi.fn(),
    createVaultItem: vi.fn(),
    updateVaultItem: vi.fn(),
    deleteVaultItem: vi.fn(),
    searchVaultBySemanticTag: vi.fn(),
    searchVaultByIntent: vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { VaultService } from '../../../services/VaultService';
import { vaultStorage } from '../../../storage/domains';

const baseVaultItem = {
  id: 'vault-1',
  fileName: '商业计划.pdf',
  category: 'RESEARCH',
  zone: 'ZONE_GREEN',
  semanticTags: ['商业', '计划'],
};

describe('VaultService', () => {
  let service: VaultService;

  beforeEach(() => {
    service = new VaultService();
    vi.clearAllMocks();

    vi.mocked(vaultStorage.getAllVaultItems).mockResolvedValue([baseVaultItem] as any);
    vi.mocked(vaultStorage.getVaultItem).mockResolvedValue(baseVaultItem as any);
    vi.mocked(vaultStorage.createVaultItem).mockResolvedValue(baseVaultItem as any);
    vi.mocked(vaultStorage.updateVaultItem).mockResolvedValue(baseVaultItem as any);
    vi.mocked(vaultStorage.deleteVaultItem).mockResolvedValue(true);
    vi.mocked(vaultStorage.searchVaultBySemanticTag).mockResolvedValue([baseVaultItem] as any);
    vi.mocked(vaultStorage.searchVaultByIntent).mockResolvedValue([baseVaultItem] as any);
  });

  it('creates a vault item and broadcasts the new file identity', async () => {
    const broadcastDataChange = vi.fn();

    const result = await service.createVaultItem(
      { fileName: '商业计划.pdf', category: 'RESEARCH' } as any,
      { broadcastDataChange },
    );

    expect(result).toEqual(baseVaultItem);
    expect(vaultStorage.createVaultItem).toHaveBeenCalledWith({
      fileName: '商业计划.pdf',
      category: 'RESEARCH',
    });
    expect(broadcastDataChange).toHaveBeenCalledWith('vault', 'CREATE', {
      id: 'vault-1',
      fileName: '商业计划.pdf',
    });
  });

  it('returns undefined on missing update target without broadcasting', async () => {
    const broadcastDataChange = vi.fn();
    vi.mocked(vaultStorage.updateVaultItem).mockResolvedValue(undefined);

    const result = await service.updateVaultItem('missing', { category: 'MEDIA' } as any, {
      broadcastDataChange,
    });

    expect(result).toBeUndefined();
    expect(broadcastDataChange).not.toHaveBeenCalled();
  });

  it('broadcasts successful updates and deletes only when storage succeeds', async () => {
    const broadcastDataChange = vi.fn();

    await expect(
      service.updateVaultItem('vault-1', { category: 'MEDIA' } as any, { broadcastDataChange }),
    ).resolves.toEqual(baseVaultItem);
    expect(broadcastDataChange).toHaveBeenCalledWith('vault', 'UPDATE', {
      id: 'vault-1',
      fileName: '商业计划.pdf',
    });

    broadcastDataChange.mockClear();
    await expect(service.deleteVaultItem('vault-1', { broadcastDataChange })).resolves.toBe(true);
    expect(broadcastDataChange).toHaveBeenCalledWith('vault', 'DELETE', { id: 'vault-1' });

    broadcastDataChange.mockClear();
    vi.mocked(vaultStorage.deleteVaultItem).mockResolvedValue(false);
    await expect(service.deleteVaultItem('missing', { broadcastDataChange })).resolves.toBe(false);
    expect(broadcastDataChange).not.toHaveBeenCalled();
  });

  it('delegates semantic tag and intent search to storage', async () => {
    await expect(service.searchVaultBySemanticTag('商业')).resolves.toEqual([baseVaultItem]);
    await expect(service.searchVaultByIntent('找商业计划')).resolves.toEqual([baseVaultItem]);

    expect(vaultStorage.searchVaultBySemanticTag).toHaveBeenCalledWith('商业');
    expect(vaultStorage.searchVaultByIntent).toHaveBeenCalledWith('找商业计划');
  });

  it('permanently shreds vault items and records completion audit', async () => {
    const auditAction = vi.fn().mockResolvedValue(undefined);

    const result = await service.permanentShred('vault-1', 'vault', {
      auditAction,
      userRole: 'ADMIN',
      request: { requestId: 'req-1' },
    });

    expect(vaultStorage.getVaultItem).toHaveBeenCalledWith('vault-1');
    expect(vaultStorage.deleteVaultItem).toHaveBeenCalledWith('vault-1');
    expect(auditAction).toHaveBeenCalledWith(
      'SHRED_COMPLETE',
      'ADMIN',
      'vault',
      'vault-1',
      { fileName: '商业计划.pdf' },
      'SUCCESS',
      { requestId: 'req-1' },
    );
    expect(result).toEqual({
      success: true,
      message: '[SHRED COMPLETE] 商业计划.pdf has been permanently destroyed',
    });
  });

  it('returns not found for missing vault shred targets without deleting', async () => {
    vi.mocked(vaultStorage.getVaultItem).mockResolvedValue(undefined);

    const result = await service.permanentShred('missing', 'vault');

    expect(result).toEqual({ success: false, message: 'Target not found in vault' });
    expect(vaultStorage.deleteVaultItem).not.toHaveBeenCalled();
  });

  it('reports failed audit details when shredding throws', async () => {
    const auditAction = vi.fn().mockResolvedValue(undefined);
    vi.mocked(vaultStorage.getVaultItem).mockRejectedValue(new Error('db offline'));

    const result = await service.permanentShred('vault-1', 'vault', {
      auditAction,
      request: { requestId: 'req-2' },
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Shredding failed: Error: db offline');
    expect(auditAction).toHaveBeenCalledWith(
      'SHRED_FAILED',
      'MASTER',
      'vault',
      'vault-1',
      { error: 'Error: db offline' },
      'FAILED',
      { requestId: 'req-2' },
    );
  });

  it('keeps person shredding routed away from vault storage', async () => {
    const result = await service.permanentShred('person-1', 'person');

    expect(result).toEqual({
      success: false,
      message: 'Person shredding must be performed via PersonService',
    });
    expect(vaultStorage.getVaultItem).not.toHaveBeenCalled();
    expect(vaultStorage.deleteVaultItem).not.toHaveBeenCalled();
  });

  it('summarizes known vault categories and filters items by category', async () => {
    const items = [
      baseVaultItem,
      { ...baseVaultItem, id: 'vault-2', fileName: '安装包.zip', category: 'SOFTWARE' },
      { ...baseVaultItem, id: 'vault-3', fileName: '视频.mp4', category: 'MEDIA' },
      { ...baseVaultItem, id: 'vault-4', fileName: '杂项.txt', category: 'UNKNOWN' },
      { ...baseVaultItem, id: 'vault-5', fileName: '未分类.txt', category: null },
    ];
    vi.mocked(vaultStorage.getAllVaultItems).mockResolvedValue(items as any);

    await expect(service.getVaultStats()).resolves.toEqual({
      totalDownloads: 0,
      activeDownloads: 0,
      totalComputeJobs: 0,
      activeComputeJobs: 0,
      totalDreams: 0,
      categories: {
        RESEARCH: 1,
        SOFTWARE: 1,
        MEDIA: 1,
        BOOKS: 0,
      },
    });
    await expect(service.getVaultItemsByCategory('SOFTWARE')).resolves.toEqual([items[1]]);
  });
});
