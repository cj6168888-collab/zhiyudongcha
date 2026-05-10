/**
 * WorkflowEditor - 工作流编排界面
 *
 * 可视化创建和编辑自动化工作流
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { useState, useEffect, useCallback } from 'react';
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Play, Pause, Plus, Trash2, Save, Settings,
  ChevronRight, Clock, Zap, GitBranch, Layers,
  MousePointer2, Keyboard, Camera, AppWindow,
  FileText, Mail, Folder, Globe, Power,
  RefreshCw, CheckCircle2, XCircle, AlertCircle,
  ArrowRight, ArrowDown, Copy, Edit3
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiRequest } from '@/lib/queryClient';
import { getSkillEngine, type Skill } from "@/lib/ai-skill-engine";

// ============================================
// 类型定义
// ============================================

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay';
  name: string;
  description?: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional';
  condition?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  status: 'idle' | 'running' | 'error';
}

// 节点类型配置
const nodeTypeConfig: Record<string, { icon: typeof Play; color: string; label: string }> = {
  trigger: { icon: Zap, color: 'text-yellow-400', label: '触发器' },
  action: { icon: Play, color: 'text-green-400', label: '动作' },
  condition: { icon: GitBranch, color: 'text-blue-400', label: '条件' },
  delay: { icon: Clock, color: 'text-purple-400', label: '延迟' },
};

// 预置工作流模板
const workflowTemplates: Partial<Workflow>[] = [
  {
    name: '晨间简报',
    description: '每天早上自动打开新闻网页和邮件',
    nodes: [
      { id: '1', type: 'trigger', name: '定时触发', config: { cron: '0 8 * * *' }, position: { x: 50, y: 100 } },
      { id: '2', type: 'action', name: '打开浏览器', config: { skillId: 'browser_new_window' }, position: { x: 200, y: 50 } },
      { id: '3', type: 'action', name: '打开Outlook', config: { skillId: 'email_new' }, position: { x: 200, y: 150 } },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '1', target: '3' },
    ]
  },
  {
    name: '下班模式',
    description: '一键锁定电脑',
    nodes: [
      { id: '1', type: 'trigger', name: '手动触发', config: { type: 'manual' }, position: { x: 50, y: 100 } },
      { id: '2', type: 'action', name: '保存文件', config: { skillId: 'save' }, position: { x: 200, y: 50 } },
      { id: '3', type: 'delay', name: '等待2秒', config: { seconds: 2 }, position: { x: 200, y: 150 } },
      { id: '4', type: 'action', name: '锁定电脑', config: { skillId: 'system_lock' }, position: { x: 350, y: 100 } },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' },
      { id: 'e3', source: '3', target: '4' },
    ]
  },
  {
    name: '会议准备',
    description: '打开会议所需的应用',
    nodes: [
      { id: '1', type: 'trigger', name: '手动触发', config: { type: 'manual' }, position: { x: 50, y: 100 } },
      { id: '2', type: 'action', name: '打开微信', config: { skillId: 'open_app', params: { app: '微信' } }, position: { x: 200, y: 50 } },
      { id: '3', type: 'action', name: '打开钉钉', config: { skillId: 'open_app', params: { app: '钉钉' } }, position: { x: 200, y: 120 } },
      { id: '4', type: 'action', name: '打开浏览器', config: { skillId: 'browser_new_window' }, position: { x: 200, y: 190 } },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '1', target: '3' },
      { id: 'e3', source: '1', target: '4' },
    ]
  }
];

// 可选的技能列表（用于动作节点）
const availableSkills: { id: string; name: string; category: string }[] = [
  { id: 'screenshot', name: '截图', category: 'control' },
  { id: 'open_app', name: '打开应用', category: 'control' },
  { id: 'browser_new_tab', name: '新建标签页', category: 'browser' },
  { id: 'browser_new_window', name: '新建窗口', category: 'browser' },
  { id: 'excel_new', name: '新建Excel', category: 'office' },
  { id: 'word_new', name: '新建Word', category: 'office' },
  { id: 'email_new', name: '写邮件', category: 'mail' },
  { id: 'file_explorer', name: '打开文件管理器', category: 'system' },
  { id: 'system_lock', name: '锁定电脑', category: 'system' },
  { id: 'system_shutdown', name: '关机', category: 'system' },
  { id: 'volume_up', name: '增加音量', category: 'system' },
  { id: 'volume_mute', name: '静音', category: 'system' },
];

export default function WorkflowEditor() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // 加载工作流列表
  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const res = await apiRequest('GET', '/api/tasks');
      const json = await res.json();

      if (json.success && json.data) {
        // 将任务转换为工作流格式
        const workflows: Workflow[] = json.data.map((task: any) => ({
          id: task.id,
          name: task.name,
          description: task.description,
          nodes: task.actions?.map((action: any, index: number) => ({
            id: `node-${index}`,
            type: 'action' as const,
            name: action.actionType,
            config: action.params || {},
            position: { x: 200 + index * 150, y: 100 }
          })) || [],
          edges: [],
          enabled: task.status === 'ACTIVE',
          createdAt: task.createdAt || Date.now(),
          updatedAt: task.updatedAt || Date.now(),
          status: 'idle' as const
        }));

        setWorkflows(workflows);
      }
    } catch (error) {
      console.error('加载工作流失败:', error);
    }
  };

  // 创建新工作流
  const createWorkflow = (template?: Partial<Workflow>) => {
    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: template?.name || '新工作流',
      description: template?.description || '',
      nodes: template?.nodes || [
        {
          id: 'trigger-1',
          type: 'trigger',
          name: '手动触发',
          config: { type: 'manual' },
          position: { x: 50, y: 100 }
        }
      ],
      edges: template?.edges || [],
      enabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle'
    };

    setSelectedWorkflow(newWorkflow);
    setIsEditing(true);
  };

  // 添加节点
  const addNode = (type: WorkflowNode['type']) => {
    if (!selectedWorkflow) return;

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      name: type === 'trigger' ? '触发器' : type === 'action' ? '动作' : type === 'condition' ? '条件' : '延迟',
      config: {},
      position: {
        x: 100 + selectedWorkflow.nodes.length * 50,
        y: 100 + selectedWorkflow.nodes.length * 30
      }
    };

    setSelectedWorkflow({
      ...selectedWorkflow,
      nodes: [...selectedWorkflow.nodes, newNode],
      updatedAt: Date.now()
    });
  };

  // 删除节点
  const removeNode = (nodeId: string) => {
    if (!selectedWorkflow) return;

    setSelectedWorkflow({
      ...selectedWorkflow,
      nodes: selectedWorkflow.nodes.filter(n => n.id !== nodeId),
      edges: selectedWorkflow.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      updatedAt: Date.now()
    });
  };

  // 保存工作流
  const saveWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      // 转换为任务格式
      const taskData = {
        name: selectedWorkflow.name,
        description: selectedWorkflow.description,
        trigger: {
          type: 'MANUAL',
          config: {}
        },
        actions: selectedWorkflow.nodes
          .filter(n => n.type === 'action')
          .map(n => ({
            deviceId: 'default',
            deviceType: 'PC',
            actionType: n.config.skillId || 'CUSTOM',
            params: n.config
          })),
        enabled: selectedWorkflow.enabled
      };

      const res = await apiRequest('POST', '/api/tasks', taskData);
      const json = await res.json();

      if (json.success) {
        toast.success('工作流保存成功');
        loadWorkflows();
        setIsEditing(false);
      } else {
        toast.error(json.error || '保存失败');
      }
    } catch (error) {
      toast.error('保存失败');
    }
  };

  // 执行工作流
  const executeWorkflow = async (workflowId: string) => {
    setIsRunning(true);

    try {
      const res = await apiRequest('POST', `/api/tasks/${workflowId}/execute`);
      const json = await res.json();

      if (json.success) {
        toast.success('工作流执行成功');
      } else {
        toast.error(json.error || '执行失败');
      }
    } catch (error) {
      toast.error('执行失败');
    } finally {
      setIsRunning(false);
    }
  };

  // 删除工作流
  const deleteWorkflow = async (workflowId: string) => {
    try {
      const res = await apiRequest('DELETE', `/api/tasks/${workflowId}`);
      const json = await res.json();

      if (json.success) {
        toast.success('删除成功');
        loadWorkflows();
      } else {
        toast.error(json.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  return (
    <SafeLayout
      headerTitle="工作流编排"
      headerRight={
        <button
          onClick={() => setShowTemplates(true)}
          className="p-2 rounded-xl bg-white/5 active:bg-white/10"
        >
          <Layers className="w-4 h-4 text-gray-400" />
        </button>
      }
    >
      <div className="space-y-4 pb-20">

        {/* 创建新工作流 */}
        <div className="px-4">
          <button
            onClick={() => createWorkflow()}
            className="w-full h-12 rounded-2xl bg-primary/20 border border-primary/30 text-primary text-sm font-bold flex items-center justify-center gap-2 active:bg-primary/30"
          >
            <Plus className="w-4 h-4" />
            创建新工作流
          </button>
        </div>

        {/* 工作流列表 */}
        <div className="px-4 space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
            我的工作流 ({workflows.length})
          </h3>

          {workflows.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500">还没有工作流</p>
              <p className="text-[10px] text-gray-600 mt-1">点击上方按钮创建第一个工作流</p>
            </div>
          ) : (
            workflows.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onEdit={() => {
                  setSelectedWorkflow(workflow);
                  setIsEditing(true);
                }}
                onExecute={() => executeWorkflow(workflow.id)}
                onDelete={() => deleteWorkflow(workflow.id)}
                isRunning={isRunning}
              />
            ))
          )}
        </div>

        {/* 预置模板弹窗 */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="w-full max-w-lg mx-auto bg-[#0a0a0f] rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">选择模板</h3>
                <button onClick={() => setShowTemplates(false)}>
                  <XCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3">
                {workflowTemplates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      createWorkflow(template);
                      setShowTemplates(false);
                    }}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left active:bg-white/10"
                  >
                    <h4 className="text-sm font-bold text-white">{template.name}</h4>
                    <p className="text-[11px] text-gray-500 mt-1">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 编辑模式 */}
        {isEditing && selectedWorkflow && (
          <WorkflowEditorPanel
            workflow={selectedWorkflow}
            onChange={setSelectedWorkflow}
            onAddNode={addNode}
            onRemoveNode={removeNode}
            onSave={saveWorkflow}
            onClose={() => {
              setIsEditing(false);
              setSelectedWorkflow(null);
            }}
          />
        )}

      </div>
    </SafeLayout>
  );
}

// 工作流卡片组件
function WorkflowCard({
  workflow,
  onEdit,
  onExecute,
  onDelete,
  isRunning
}: {
  workflow: Workflow;
  onEdit: () => void;
  onExecute: () => void;
  onDelete: () => void;
  isRunning: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white truncate">{workflow.name}</h4>
            {workflow.enabled && (
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-[8px] text-green-400 font-bold">
                启用
              </span>
            )}
          </div>
          {workflow.description && (
            <p className="text-[10px] text-gray-500 mt-1 truncate">{workflow.description}</p>
          )}
          <p className="text-[9px] text-gray-600 mt-2">
            {workflow.nodes.length} 个节点
          </p>
        </div>

        <button
          onClick={() => setShowActions(!showActions)}
          className="p-2 rounded-xl bg-white/5"
        >
          <Settings className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {showActions && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
          <button
            onClick={onExecute}
            disabled={isRunning}
            className="flex-1 h-10 rounded-xl bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center gap-1 active:bg-green-500/30 disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            执行
          </button>
          <button
            onClick={onEdit}
            className="flex-1 h-10 rounded-xl bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1 active:bg-primary/30"
          >
            <Edit3 className="w-3 h-3" />
            编辑
          </button>
          <button
            onClick={onDelete}
            className="flex-1 h-10 rounded-xl bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-1 active:bg-red-500/30"
          >
            <Trash2 className="w-3 h-3" />
            删除
          </button>
        </div>
      )}
    </div>
  );
}

// 工作流编辑面板
function WorkflowEditorPanel({
  workflow,
  onChange,
  onAddNode,
  onRemoveNode,
  onSave,
  onClose
}: {
  workflow: Workflow;
  onChange: (w: Workflow) => void;
  onAddNode: (type: WorkflowNode['type']) => void;
  onRemoveNode: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [editName, setEditName] = useState(workflow.name);
  const [editDesc, setEditDesc] = useState(workflow.description || '');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg max-h-[90vh] bg-[#0a0a0f] rounded-3xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">编辑工作流</h3>
          <button onClick={onClose}>
            <XCircle className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 基本信息 */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase">名称</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  onChange({ ...workflow, name: e.target.value });
                }}
                className="w-full h-10 px-3 mt-1 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase">描述</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => {
                  setEditDesc(e.target.value);
                  onChange({ ...workflow, description: e.target.value });
                }}
                className="w-full h-10 px-3 mt-1 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
              />
            </div>
          </div>

          {/* 添加节点 */}
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block">添加节点</label>
            <div className="flex gap-2">
              <button
                onClick={() => onAddNode('action')}
                className="flex-1 h-10 rounded-xl bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center gap-1"
              >
                <Play className="w-3 h-3" />
                动作
              </button>
              <button
                onClick={() => onAddNode('condition')}
                className="flex-1 h-10 rounded-xl bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center gap-1"
              >
                <GitBranch className="w-3 h-3" />
                条件
              </button>
              <button
                onClick={() => onAddNode('delay')}
                className="flex-1 h-10 rounded-xl bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center gap-1"
              >
                <Clock className="w-3 h-3" />
                延迟
              </button>
            </div>
          </div>

          {/* 节点列表 */}
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block">节点列表</label>
            <div className="space-y-2">
              {workflow.nodes.map((node, index) => {
                const config = nodeTypeConfig[node.type];
                const Icon = config.icon;

                return (
                  <div
                    key={node.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className={cn("p-2 rounded-lg", config.color, "bg-white/10")}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{node.name}</p>
                      <p className="text-[9px] text-gray-500">{config.label}</p>
                    </div>
                    {node.type !== 'trigger' && (
                      <button
                        onClick={() => onRemoveNode(node.id)}
                        className="p-2 rounded-lg bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-white/10 text-white font-bold"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="flex-1 h-12 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
