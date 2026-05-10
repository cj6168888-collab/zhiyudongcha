import { describe, expect, it, beforeEach } from 'vitest';
import { SwarmTaskRegistry } from '../../../services/swarm-task-registry';

describe('SwarmTaskRegistry', () => {
  let registry: SwarmTaskRegistry;

  beforeEach(() => {
    registry = new SwarmTaskRegistry();
  });

  // ── createTask ───────────────────────────────────────────────────────────

  it('creates a task and assigns a unique id', async () => {
    const t = await registry.createTask({ taskName: '整理项目战报', payload: {}, targetNodes: 'ALL', deliveredCount: 3 });

    expect(t.id).toBeTruthy();
    expect(t.taskName).toBe('整理项目战报');
    expect(t.targetNodes).toBe('ALL');
    expect(t.deliveredCount).toBe(3);
    expect(t.reports).toHaveLength(0);
    expect(t.broadcastedAt).toBeTruthy();
  });

  it('assigns different ids to different tasks', async () => {
    const t1 = await registry.createTask({ taskName: 'A', payload: {}, targetNodes: 'ALL', deliveredCount: 1 });
    const t2 = await registry.createTask({ taskName: 'B', payload: {}, targetNodes: 'ALL', deliveredCount: 1 });

    expect(t1.id).not.toBe(t2.id);
  });

  // ── addReport ────────────────────────────────────────────────────────────

  it('adds a node report to the correct task', async () => {
    const task = await registry.createTask({ taskName: '发送日报', payload: {}, targetNodes: 'ALL', deliveredCount: 2 });
    const report = await registry.addReport(task.id, { nodeId: 'node-1', status: 'completed', result: { rows: 5 } });

    expect(report).not.toBeNull();
    expect(report!.nodeId).toBe('node-1');
    expect(report!.status).toBe('completed');
    expect(report!.reportedAt).toBeTruthy();

    const fetched = registry.getTask(task.id);
    expect(fetched!.reports).toHaveLength(1);
  });

  it('overwrites previous report from the same node', async () => {
    const task = await registry.createTask({ taskName: 'T', payload: {}, targetNodes: 'ALL', deliveredCount: 1 });
    await registry.addReport(task.id, { nodeId: 'node-1', status: 'running' });
    await registry.addReport(task.id, { nodeId: 'node-1', status: 'completed', result: 'done' });

    const fetched = registry.getTask(task.id);
    expect(fetched!.reports).toHaveLength(1);
    expect(fetched!.reports[0].status).toBe('completed');
  });

  it('accepts reports from multiple nodes independently', async () => {
    const task = await registry.createTask({ taskName: 'T', payload: {}, targetNodes: 'ALL', deliveredCount: 3 });
    await registry.addReport(task.id, { nodeId: 'node-1', status: 'completed' });
    await registry.addReport(task.id, { nodeId: 'node-2', status: 'failed', error: 'timeout' });
    await registry.addReport(task.id, { nodeId: 'node-3', status: 'running' });

    const fetched = registry.getTask(task.id);
    expect(fetched!.reports).toHaveLength(3);
  });

  it('returns null for report on unknown task', async () => {
    const result = await registry.addReport('non-existent', { nodeId: 'n1', status: 'completed' });
    expect(result).toBeNull();
  });

  // ── getTask ──────────────────────────────────────────────────────────────

  it('returns null for unknown task id', () => {
    expect(registry.getTask('does-not-exist')).toBeNull();
  });

  // ── listTasks ────────────────────────────────────────────────────────────

  it('lists tasks in reverse chronological order', async () => {
    const t1 = await registry.createTask({ taskName: 'First', payload: {}, targetNodes: 'ALL', deliveredCount: 1 });
    await new Promise(r => setTimeout(r, 2));
    const t2 = await registry.createTask({ taskName: 'Second', payload: {}, targetNodes: 'ALL', deliveredCount: 1 });

    const list = registry.listTasks();
    expect(list[0].id).toBe(t2.id);
    expect(list[1].id).toBe(t1.id);
  });

  // ── gc ───────────────────────────────────────────────────────────────────

  it('gc removes tasks older than maxAgeHours', async () => {
    const task = await registry.createTask({ taskName: 'Old', payload: {}, targetNodes: 'ALL', deliveredCount: 0 });
    // 手动设置时间为 25 小时前
    (task as any).broadcastedAt = new Date(Date.now() - 25 * 3_600_000).toISOString();

    const removed = await registry.gc(24);
    expect(removed).toBe(1);
    expect(registry.getTask(task.id)).toBeNull();
  });

  it('gc keeps recent tasks', async () => {
    await registry.createTask({ taskName: 'New', payload: {}, targetNodes: 'ALL', deliveredCount: 0 });
    const removed = await registry.gc(24);
    expect(removed).toBe(0);
    expect(registry.listTasks()).toHaveLength(1);
  });

  // ── 完整闭环场景 ──────────────────────────────────────────────────────────

  it('simulates full queen→node→queen closure', async () => {
    // 蜂王广播
    const task = await registry.createTask({ taskName: '整理项目战报', payload: { week: '2026-W18' }, targetNodes: 'ALL', deliveredCount: 2 });

    // 节点 A 先报告运行中
    await registry.addReport(task.id, { nodeId: 'node-a', status: 'running' });
    // 节点 B 报告完成
    await registry.addReport(task.id, { nodeId: 'node-b', status: 'completed', result: { summary: '战报已整理' } });
    // 节点 A 报告完成（覆盖 running）
    await registry.addReport(task.id, { nodeId: 'node-a', status: 'completed', result: { summary: '已发送' } });

    // 蜂王查看进度
    const fetched = registry.getTask(task.id)!;
    const completed = fetched.reports.filter(r => r.status === 'completed');
    const failed = fetched.reports.filter(r => r.status === 'failed');
    const running = fetched.reports.filter(r => r.status === 'running');

    expect(completed).toHaveLength(2);
    expect(failed).toHaveLength(0);
    expect(running).toHaveLength(0);
    expect(fetched.reports).toHaveLength(2);
  });
});
