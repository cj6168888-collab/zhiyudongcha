// [LEGACY SHIM] — DatabaseStorage 已移除，统一走 StorageAdapter + Domain Repositories
// 新代码：直接 import storageAdapter from './storage/adapter' 或领域 Repository
// 此文件仅保留向后兼容导出，不要在此新增任何实现

export type { IStorage, ConversationData } from './interfaces/storage.interface';

// `storage` 现在指向 StorageAdapter（实现了完整 IStorage 接口）
export { storageAdapter as storage } from './storage/adapter';

// 领域存储重导出（保持向后兼容）
export {
  userStorage,
  personStorage,
  vaultStorage,
  deviceStorage,
  projectStorage,
  conversationStorage,
  systemStorage,
  integrationStorage,
} from './storage/domains';
