/**
 * 全局业务状态 Store（Zustand）
 *
 * 跨页面数据联动枢纽：
 * - 当前上下文项目（联系人 / 智库 / 任务 联动筛选）
 * - 最近扫描（扫描 → 存入智库）
 * - 任务过滤器
 * - 蜂群同步模式
 *
 * 使用方式：
 * const { currentProject, setCurrentProject } = useGlobalStore();
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HealthReport } from "@/plugins/definitions";

// ==================== 类型定义 ====================

export interface ProjectNode {
  id: string;
  title: string;
  name?: string;
  status: string;
  progress?: number;
}

export interface ScanRecord {
  id: string;
  name: string;
  status: string;
  url?: string;
  projectId?: string;
  createdAt?: number;
}

export interface VaultFile {
  id: string;
  name: string;
  type: string;
  size?: number;
  projectId?: string;
  createdAt?: number;
  url?: string;
}

export interface TaskNode {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  actionsCount: number;
}

// ==================== Store 定义 ====================

interface GlobalState {
  // ---- 当前上下文项目 ----
  currentProject: ProjectNode | null;
  setCurrentProject: (project: ProjectNode | null) => void;

  // ---- 扫描模块 ----
  recentScans: ScanRecord[];
  addScan: (scan: ScanRecord) => void;
  clearScans: () => void;

  // ---- 智库模块 ----
  recentVaultFiles: VaultFile[];
  addVaultFile: (file: VaultFile) => void;
  removeVaultFile: (fileId: string) => void;
  clearVaultFiles: () => void;

  // ---- 任务模块 ----
  taskFilterProject: string | null;
  setTaskFilterProject: (projectId: string | null) => void;

  // ---- 蜂群同步偏好 ----
  shareToSwarm: boolean;
  setShareToSwarm: (value: boolean) => void;

  // ---- 设备健康（原生诊断）----
  deviceHealth: HealthReport | null;
  setDeviceHealth: (health: HealthReport) => void;

  // ---- 刷新触发器（数字变化触发 useQuery refetch）----
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set) => ({
      // ---- 当前上下文项目 ----
      currentProject: null,
      setCurrentProject: (project) => set({ currentProject: project }),

      // ---- 扫描模块 ----
      recentScans: [],
      addScan: (scan) =>
        set((state) => ({
          recentScans: [
            scan,
            ...state.recentScans.filter((s) => s.id !== scan.id),
          ].slice(0, 50), // 最多保留 50 条
        })),
      clearScans: () => set({ recentScans: [] }),

      // ---- 智库模块 ----
      recentVaultFiles: [],
      addVaultFile: (file) =>
        set((state) => ({
          recentVaultFiles: [
            file,
            ...state.recentVaultFiles.filter((f) => f.id !== file.id),
          ].slice(0, 100),
        })),
      removeVaultFile: (fileId) =>
        set((state) => ({
          recentVaultFiles: state.recentVaultFiles.filter(
            (f) => f.id !== fileId
          ),
        })),
      clearVaultFiles: () => set({ recentVaultFiles: [] }),

      // ---- 任务模块 ----
      taskFilterProject: null,
      setTaskFilterProject: (projectId) => set({ taskFilterProject: projectId }),

      // ---- 蜂群同步偏好 ----
      shareToSwarm: false,
      setShareToSwarm: (value) => set({ shareToSwarm: value }),

      // ---- 设备健康 ----
      deviceHealth: null,
      setDeviceHealth: (health) => set({ deviceHealth: health }),

      // ---- 刷新触发器 ----
      refreshKey: 0,
      triggerRefresh: () =>
        set((state) => ({ refreshKey: state.refreshKey + 1 })),
    }),
    {
      name: "jilin-global-store",
      // 只持久化用户偏好，不持久化运行时数据
      partialize: (state) => ({
        shareToSwarm: state.shareToSwarm,
        currentProject: state.currentProject,
      }),
    }
  )
);

// ==================== 便捷 Selector Hooks ====================

/** 当前项目 ID（字符串或 null） */
export const useCurrentProjectId = () =>
  useGlobalStore((s) => s.currentProject?.id ?? null);

/** 当前项目对象 */
export const useCurrentProject = () =>
  useGlobalStore((s) => s.currentProject);

/** 蜂群同步偏好 */
export const useShareToSwarm = () => useGlobalStore((s) => s.shareToSwarm);

/** 刷新触发器数字（用于 refetch） */
export const useRefreshKey = () => useGlobalStore((s) => s.refreshKey);

/** 最近扫描（倒序，最新在前） */
export const useRecentScans = () =>
  useGlobalStore((s) => s.recentScans);
