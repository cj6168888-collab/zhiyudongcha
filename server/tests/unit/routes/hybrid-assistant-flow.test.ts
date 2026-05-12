import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantResponse } from '../../../services/assistant/HybridAssistant';

const mockGetDatabase = vi.hoisted(() => vi.fn());

vi.mock('../../../services/task-orchestrator', () => ({
  taskOrchestrator: {
    createTask: vi.fn(),
  },
}));

vi.mock('../../../services/pc-agent/PCAgent', () => ({
  pcAgent: {
    executeTask: vi.fn(),
  },
}));

vi.mock('../../../storage/adapter', () => ({
  storageAdapter: {
    createProject: vi.fn(),
    createVaultItem: vi.fn(),
    searchVaultByIntent: vi.fn(),
    createPerson: vi.fn(),
  },
}));

vi.mock('../../../services/assistant/HybridAssistant', () => ({
  hybridAssistant: {
    processMessage: vi.fn(),
  },
  SCENARIO_CATEGORIES: {},
}));

vi.mock('../../../services/assistant/AuthorizationManager', () => ({
  AuthorizationScope: {
    PERMANENT: 'permanent',
    BY_TYPE: 'by_type',
  },
  AuthorizationType: {
    AUTO: 'auto',
    CONFIRM: 'confirm',
    AUTHORIZE: 'authorize',
    DENY: 'deny',
  },
  authorizationManager: {
    addPermanentAuthorization: vi.fn(),
    generateAuthReport: vi.fn(() => ''),
    getUserAuthorizations: vi.fn(() => []),
    getUserConfig: vi.fn(() => ({
      amountThresholds: { auto: 100, confirm: 1000 },
      trustLevel: 0.5,
    })),
    revokeAuthorization: vi.fn(() => true),
    setAmountThresholds: vi.fn(),
  },
}));

vi.mock('../../../services/assistant/ConversationExecutionEventRecorder', () => ({
  conversationExecutionEventRecorder: {
    record: vi.fn(),
  },
}));

vi.mock('../../../db', () => ({
  getDatabase: mockGetDatabase,
}));

import hybridAssistantRouter from '../../../routes/hybrid-assistant';
import { hybridAssistant } from '../../../services/assistant/HybridAssistant';
import { conversationExecutionEventRecorder } from '../../../services/assistant/ConversationExecutionEventRecorder';
import { storageAdapter } from '../../../storage/adapter';
import { taskOrchestrator } from '../../../services/task-orchestrator';
import { pcAgent } from '../../../services/pc-agent/PCAgent';

function createApp(userId = 'default') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: userId };
    next();
  });
  app.use('/api/assistant', hybridAssistantRouter);
  return app;
}

function makeAssistantResponse(overrides: Partial<AssistantResponse>): AssistantResponse {
  return {
    id: 'resp-test',
    handler: 'ai',
    type: 'execute',
    message: '好的',
    ...overrides,
  };
}

describe('Hybrid Assistant first product loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDatabase.mockReturnValue(undefined);
    vi.mocked(storageAdapter.createProject).mockResolvedValue({
      id: 'project-1',
      title: '增长计划',
      status: 'PENDING_REVIEW',
    } as any);
    vi.mocked(taskOrchestrator.createTask).mockResolvedValue({
      id: 'task-1',
      name: '整理需求',
      status: 'PENDING',
    } as any);
    vi.mocked(storageAdapter.createVaultItem).mockResolvedValue({
      id: 'memory-1',
      fileName: '客户偏好',
      semanticTags: ['客户'],
    } as any);
    vi.mocked(storageAdapter.searchVaultByIntent).mockResolvedValue([
      { id: 'vault-1', fileName: '客户合同2026.pdf', category: 'DOCUMENT', semanticTags: ['合同'], privacyZone: 'ZONE_GREEN', createdAt: new Date() },
      { id: 'vault-2', fileName: '合同附件.jpg', category: 'MEDIA', semanticTags: ['合同', '照片'], privacyZone: 'ZONE_GREEN', createdAt: new Date() },
    ] as any);
    vi.mocked(storageAdapter.createPerson).mockResolvedValue({
      id: 'person-1',
      name: '张三',
      role: '产品经理',
      organization: null,
      approvalStatus: 'PENDING',
      accessLevel: 'ZONE_BLUE',
    } as any);
  });

  it('executes create_project returned by AI and includes execution result', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-project',
        type: 'execute',
        action: 'create_project',
        actionParams: {
          title: '增长计划',
          description: '把下月增长动作结构化',
        },
      }),
    );

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '帮我创建一个增长计划项目' })
      .expect(200);

    expect(storageAdapter.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '增长计划',
        description: '把下月增长动作结构化',
      }),
    );
    expect(response.body).toMatchObject({
      success: true,
      execution: {
        success: true,
        action: 'create_project',
        entityType: 'project',
        entityId: 'project-1',
      },
    });
    expect(conversationExecutionEventRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'default',
        source: 'assistant_chat',
        execution: expect.objectContaining({ action: 'create_project', success: true }),
      }),
    );
  });

  it('returns a safe pending summary for the current user', async () => {
    const response = await request(createApp())
      .get('/api/assistant/pending')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      count: 0,
      pending: [],
      draft: [],
    });
  });

  it('keeps pending summary safe when the pending table is unavailable', async () => {
    mockGetDatabase.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockRejectedValue(new Error('relation "pending_actions" does not exist')),
        })),
      })),
    });

    const response = await request(createApp())
      .get('/api/assistant/pending')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      count: 0,
      pending: [],
      draft: [],
    });
  });

  it('merges memory and database pending summaries by id and keeps createdAt order', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-db-merge-pending',
        type: 'confirm',
        message: '需要您确认是否创建项目',
        action: 'create_project',
        actionParams: {
          title: '内存旧标题',
        },
      }),
    );

    const app = createApp('summary-user');

    await request(app)
      .post('/api/assistant')
      .send({ message: '帮我创建一个需要确认的项目' })
      .expect(200);

    const recoveredAt = Date.now();
    const dbRows = [
      {
        id: 'resp-db-draft',
        entryType: 'draft',
        action: null,
        actionParams: null,
        items: [
          {
            action: 'create_task',
            label: '创建任务：恢复任务',
            actionParams: { name: '恢复任务', triggerType: 'MANUAL' },
          },
        ],
        expiresAt: new Date(recoveredAt + 20 * 60 * 1000),
        createdAt: new Date(recoveredAt + 1000),
      },
      {
        id: 'resp-db-merge-pending',
        entryType: 'pending',
        action: 'create_project',
        actionParams: { title: 'DB恢复覆盖' },
        items: null,
        expiresAt: new Date(recoveredAt + 20 * 60 * 1000),
        createdAt: new Date(recoveredAt + 2000),
      },
      {
        id: 'resp-db-pending',
        entryType: 'pending',
        action: 'save_memory',
        actionParams: { content: '恢复记忆', tags: ['恢复'] },
        items: null,
        expiresAt: new Date(recoveredAt + 20 * 60 * 1000),
        createdAt: new Date(recoveredAt + 3000),
      },
    ];
    const where = vi.fn().mockResolvedValue(dbRows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mockGetDatabase.mockReturnValue({ select });

    const pendingSummary = await request(app)
      .get('/api/assistant/pending')
      .expect(200);

    expect(pendingSummary.body).toMatchObject({
      success: true,
      count: 3,
      pending: [
        {
          id: 'resp-db-merge-pending',
          action: 'create_project',
          actionParams: { title: 'DB恢复覆盖' },
        },
        {
          id: 'resp-db-pending',
          action: 'save_memory',
          actionParams: { content: '恢复记忆', tags: ['恢复'] },
        },
      ],
      draft: [
        {
          id: 'resp-db-draft',
          entryType: 'draft',
          items: [
            {
              action: 'create_task',
              label: '创建任务：恢复任务',
              actionParams: { name: '恢复任务', triggerType: 'MANUAL' },
            },
          ],
        },
      ],
    });
    expect(select).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('executes create_task returned by AI', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-task',
        type: 'execute',
        action: 'create_task',
        actionParams: {
          name: '整理需求',
          description: '输出第一版需求清单',
          triggerType: 'MANUAL',
        },
      }),
    );

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '帮我创建一个整理需求的任务' })
      .expect(200);

    expect(taskOrchestrator.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '整理需求',
        description: '输出第一版需求清单',
        createdBy: 'default',
      }),
    );
    expect(response.body.execution).toMatchObject({
      success: true,
      action: 'create_task',
      entityType: 'task',
      entityId: 'task-1',
    });
  });

  it('executes save_memory returned by AI', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-memory',
        type: 'execute',
        action: 'save_memory',
        actionParams: {
          content: '客户偏好先看简洁版方案',
          tags: ['客户'],
        },
      }),
    );

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '记住客户偏好先看简洁版方案' })
      .expect(200);

    expect(storageAdapter.createVaultItem).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'MEMORY',
        semanticIndex: '客户偏好先看简洁版方案',
        semanticTags: ['客户'],
      }),
    );
    expect(response.body.execution).toMatchObject({
      success: true,
      action: 'save_memory',
      entityType: 'memory',
      entityId: 'memory-1',
    });
  });

  it('stores confirm response and executes it after approve_once authorization', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-confirm-project',
        type: 'confirm',
        message: '需要您确认是否创建项目',
        action: 'create_project',
        actionParams: {
          title: '待确认项目',
        },
      }),
    );

    const pendingResponse = await request(createApp())
      .post('/api/assistant')
      .send({ message: '帮我创建一个需要确认的项目' })
      .expect(200);

    expect(pendingResponse.body).toMatchObject({
      success: true,
      response: {
        id: 'resp-confirm-project',
        type: 'confirm',
      },
    });
    expect(storageAdapter.createProject).not.toHaveBeenCalled();

    const pendingSummary = await request(createApp())
      .get('/api/assistant/pending')
      .expect(200);

    expect(pendingSummary.body).toMatchObject({
      success: true,
      count: 1,
      pending: [
        {
          id: 'resp-confirm-project',
          entryType: 'pending',
          action: 'create_project',
          actionParams: {
            title: '待确认项目',
          },
        },
      ],
    });

    const approvedResponse = await request(createApp())
      .post('/api/assistant/authorize')
      .send({ responseId: 'resp-confirm-project', action: 'approve_once' })
      .expect(200);

    expect(storageAdapter.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: '待确认项目' }),
    );
    expect(approvedResponse.body).toMatchObject({
      success: true,
      message: '好的，已完成：项目 已创建',
      execution: {
        success: true,
        action: 'create_project',
        entityType: 'project',
      },
    });
    expect(conversationExecutionEventRecorder.record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: 'default',
        source: 'assistant_authorize',
        execution: expect.objectContaining({ action: 'create_project', success: true }),
      }),
    );
  });

  it('returns a PC-specific completion message after approving pc_execute', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-confirm-pc',
        type: 'confirm',
        message: '需要确认 PC 执行',
        action: 'pc_execute',
        actionParams: {
          type: 'system_optimize',
          description: '执行一次连通性测试，并把结果回传到手机端',
          params: {},
        },
      }),
    );
    vi.mocked(pcAgent.executeTask).mockResolvedValue({
      success: true,
      type: 'system_optimize',
      message: 'PC 端连通性测试完成：127.0.0.1 可达，耗时约 24ms',
    } as any);

    const app = createApp();
    await request(app)
      .post('/api/assistant')
      .send({ message: '让PC端执行一次连通性测试，并把结果回传到手机端' })
      .expect(200);

    const approvedResponse = await request(app)
      .post('/api/assistant/authorize')
      .send({ responseId: 'resp-confirm-pc', action: 'approve_once' })
      .expect(200);

    expect(approvedResponse.body).toMatchObject({
      success: true,
      message: '好的，PC 执行已完成：PC 端连通性测试完成：127.0.0.1 可达，耗时约 24ms',
      execution: {
        success: true,
        action: 'pc_execute',
        entityType: 'pc_task',
      },
    });
  });

  it('removes a pending action after deny authorization', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-deny-project',
        type: 'confirm',
        message: '需要您确认是否创建项目',
        action: 'create_project',
        actionParams: {
          title: '待取消项目',
        },
      }),
    );

    const app = createApp();

    await request(app)
      .post('/api/assistant')
      .send({ message: '帮我创建一个需要取消的项目' })
      .expect(200);

    await request(app)
      .post('/api/assistant/authorize')
      .send({ responseId: 'resp-deny-project', action: 'deny' })
      .expect(200);

    const pendingSummary = await request(app)
      .get('/api/assistant/pending')
      .expect(200);

    expect(storageAdapter.createProject).not.toHaveBeenCalled();
    expect(pendingSummary.body).toMatchObject({
      success: true,
      count: 0,
      pending: [],
      draft: [],
    });
  });

  // ── CRON 循环任务执行 ──────────────────────────────────────────────────────

  it('creates CRON task with proper trigger config', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-cron',
        type: 'execute',
        action: 'create_task',
        actionParams: {
          name: '整理项目战报',
          description: '每周一汇总',
          triggerType: 'CRON',
          cronExpression: '0 9 * * 1',
          cronTimezone: 'Asia/Shanghai',
        },
      }),
    );

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '每周一提醒我整理项目战报' })
      .expect(200);

    expect(taskOrchestrator.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '整理项目战报',
        trigger: {
          type: 'CRON',
          config: { expression: '0 9 * * 1', timezone: 'Asia/Shanghai' },
        },
      }),
    );
    expect(response.body.execution).toMatchObject({
      success: true,
      action: 'create_task',
      entityType: 'task',
    });
    expect(response.body.execution.entityData.triggerType).toBe('CRON');
    expect(response.body.execution.entityData.cronExpression).toBe('0 9 * * 1');
  });

  // ── 保险库语义搜索 (阶段四) ────────────────────────────────────────────────

  it('executes search_vault and returns matching results', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-search',
        type: 'execute',
        action: 'search_vault',
        actionParams: { query: '合同照片' },
      }),
    );

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '找上次那个合同照片' })
      .expect(200);

    expect(storageAdapter.searchVaultByIntent).toHaveBeenCalledWith('合同照片');
    expect(response.body.execution).toMatchObject({
      success: true,
      action: 'search_vault',
    });
    expect(response.body.execution.entityData.query).toBe('合同照片');
    expect(response.body.execution.entityData.results).toHaveLength(2);
    expect(response.body.execution.entityData.results[0]).toMatchObject({
      id: 'vault-1',
      fileName: '客户合同2026.pdf',
    });
    expect(response.body.execution.entityData.totalFound).toBe(2);
  });

  it('returns empty results when no vault items match', async () => {
    vi.mocked(storageAdapter.searchVaultByIntent).mockResolvedValue([]);
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-search-empty',
        type: 'execute',
        action: 'search_vault',
        actionParams: { query: '不存在的文件' },
      }),
    );

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '找一个不存在的合同' })
      .expect(200);

    expect(response.body.execution.entityData.totalFound).toBe(0);
    expect(response.body.execution.entityData.results).toHaveLength(0);
  });

  // ── 联系人创建 (阶段二) ────────────────────────────────────────────────────

  it('executes create_person and returns person entity', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue(
      makeAssistantResponse({
        id: 'resp-person',
        type: 'execute',
        action: 'create_person',
        actionParams: {
          name: '张三',
          role: '产品经理',
        },
      }),
    );

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '添加联系人张三，职位是产品经理' })
      .expect(200);

    expect(storageAdapter.createPerson).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '张三',
        role: '产品经理',
        addedBy: 'default',
        approvalStatus: 'PENDING',
        accessLevel: 'ZONE_BLUE',
      }),
    );
    expect(response.body.execution).toMatchObject({
      success: true,
      action: 'create_person',
      entityType: 'memory',
      entityId: 'person-1',
    });
    expect(response.body.execution.entityData).toMatchObject({
      name: '张三',
      role: '产品经理',
      approvalStatus: 'PENDING',
    });
  });

  // ── 结构化草案 (阶段一) ───────────────────────────────────────────────────

  it('stores draft when AI returns type=draft and does not execute immediately', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue({
      id: 'resp-draft',
      handler: 'ai',
      type: 'draft',
      message: '我理解了以下 2 项内容，请确认后我来执行：',
      draftItems: [
        { action: 'create_project', label: '创建项目：增长平台', actionParams: { title: '增长平台', description: '' } },
        { action: 'create_task', label: '创建任务：需求文档', actionParams: { name: '需求文档', description: '', triggerType: 'MANUAL' } },
      ],
    } as any);

    const response = await request(createApp())
      .post('/api/assistant')
      .send({ message: '帮我创建项目增长平台，同时创建任务需求文档' })
      .expect(200);

    // 草案类型不立即执行
    expect(storageAdapter.createProject).not.toHaveBeenCalled();
    expect(taskOrchestrator.createTask).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      success: true,
      response: { id: 'resp-draft', type: 'draft' },
    });
    expect(response.body.execution).toBeUndefined();

    const pendingSummary = await request(createApp())
      .get('/api/assistant/pending')
      .expect(200);

    expect(pendingSummary.body.draft).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'resp-draft',
          entryType: 'draft',
          items: expect.arrayContaining([
            expect.objectContaining({
              action: 'create_project',
              label: '创建项目：增长平台',
              actionParams: expect.objectContaining({ title: '增长平台' }),
            }),
          ]),
        }),
      ]),
    );
  });

  it('updates a stored draft before execution', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue({
      id: 'resp-draft-update',
      handler: 'ai',
      type: 'draft',
      message: '我理解了以下 1 项内容，请确认后我来执行：',
      draftItems: [
        { action: 'create_project', label: '创建项目：旧项目', actionParams: { title: '旧项目', description: '' } },
      ],
    } as any);

    const app = createApp();

    await request(app)
      .post('/api/assistant')
      .send({ message: '先起草一个项目' })
      .expect(200);

    const updateResponse = await request(app)
      .post('/api/assistant/draft/update')
      .send({
        responseId: 'resp-draft-update',
        items: [
          {
            action: 'create_project',
            label: '创建项目：新项目',
            actionParams: { title: '新项目', description: '修改后的说明' },
          },
        ],
      })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      success: true,
      draft: {
        id: 'resp-draft-update',
        items: [
          {
            action: 'create_project',
            label: '创建项目：新项目',
            actionParams: { title: '新项目', description: '修改后的说明' },
          },
        ],
      },
    });

    await request(app)
      .post('/api/assistant/draft/confirm')
      .send({ responseId: 'resp-draft-update' })
      .expect(200);

    expect(storageAdapter.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: '新项目', description: '修改后的说明' }),
    );
  });

  it('validates /draft/update input before saving changes', async () => {
    await request(createApp())
      .post('/api/assistant/draft/update')
      .send({ items: [{ action: 'create_project', actionParams: { title: '缺少ID' } }] })
      .expect(400);

    await request(createApp())
      .post('/api/assistant/draft/update')
      .send({ responseId: 'resp-missing-items' })
      .expect(400);

    await request(createApp())
      .post('/api/assistant/draft/update')
      .send({ responseId: 'resp-empty-items', items: [] })
      .expect(400);

    await request(createApp())
      .post('/api/assistant/draft/update')
      .send({
        responseId: 'resp-unknown-draft',
        items: [{ action: 'create_project', actionParams: { title: '不存在' } }],
      })
      .expect(404);
  });

  it('keeps draft update and confirm scoped to the owner user', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue({
      id: 'resp-owner-draft',
      handler: 'ai',
      type: 'draft',
      message: '我理解了以下 1 项内容，请确认后我来执行：',
      draftItems: [
        { action: 'create_project', label: '创建项目：用户隔离', actionParams: { title: '用户隔离', description: '' } },
      ],
    } as any);

    await request(createApp('owner-user'))
      .post('/api/assistant')
      .send({ message: '先起草一个只属于我的项目' })
      .expect(200);

    await request(createApp('other-user'))
      .post('/api/assistant/draft/update')
      .send({
        responseId: 'resp-owner-draft',
        items: [
          {
            action: 'create_project',
            label: '创建项目：越权修改',
            actionParams: { title: '越权修改', description: '' },
          },
        ],
      })
      .expect(404);

    await request(createApp('other-user'))
      .post('/api/assistant/draft/confirm')
      .send({ responseId: 'resp-owner-draft' })
      .expect(404);

    await request(createApp('owner-user'))
      .post('/api/assistant/draft/confirm')
      .send({ responseId: 'resp-owner-draft' })
      .expect(200);

    expect(storageAdapter.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: '用户隔离' }),
    );
    expect(storageAdapter.createProject).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: '越权修改' }),
    );
  });

  it('executes all draft items after /draft/confirm', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue({
      id: 'resp-draft-2',
      handler: 'ai',
      type: 'draft',
      message: '我理解了以下 2 项内容，请确认后我来执行：',
      draftItems: [
        { action: 'create_project', label: '创建项目：增长平台', actionParams: { title: '增长平台', description: '把增长动作结构化' } },
        { action: 'create_task', label: '创建任务：整理需求', actionParams: { name: '整理需求', description: '输出第一版', triggerType: 'MANUAL' } },
      ],
    } as any);

    const app = createApp();

    // 第一步：发消息，触发草案暂存
    await request(app)
      .post('/api/assistant')
      .send({ message: '帮我创建项目增长平台，同时创建任务整理需求' })
      .expect(200);

    // 第二步：确认草案，执行所有条目
    const confirmResponse = await request(app)
      .post('/api/assistant/draft/confirm')
      .send({ responseId: 'resp-draft-2' })
      .expect(200);

    expect(storageAdapter.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: '增长平台' }),
    );
    expect(taskOrchestrator.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: '整理需求' }),
    );
    expect(confirmResponse.body).toMatchObject({ success: true });
    expect(confirmResponse.body.executions).toHaveLength(2);
    expect(confirmResponse.body.executions[0]).toMatchObject({
      success: true,
      action: 'create_project',
    });
    expect(confirmResponse.body.executions[1]).toMatchObject({
      success: true,
      action: 'create_task',
    });
  });

  it('discards a stored draft without executing it', async () => {
    vi.mocked(hybridAssistant.processMessage).mockResolvedValue({
      id: 'resp-draft-discard',
      handler: 'ai',
      type: 'draft',
      message: '我理解了以下 1 项内容，请确认后我来执行：',
      draftItems: [
        { action: 'create_project', label: '创建项目：暂不执行', actionParams: { title: '暂不执行', description: '' } },
      ],
    } as any);

    const app = createApp();

    await request(app)
      .post('/api/assistant')
      .send({ message: '先起草一个项目但不要执行' })
      .expect(200);

    const discardResponse = await request(app)
      .post('/api/assistant/pending/discard')
      .send({ responseId: 'resp-draft-discard' })
      .expect(200);

    const pendingSummary = await request(app)
      .get('/api/assistant/pending')
      .expect(200);

    expect(discardResponse.body).toMatchObject({ success: true, discarded: true });
    expect(storageAdapter.createProject).not.toHaveBeenCalled();
    expect(pendingSummary.body.success).toBe(true);
    expect(pendingSummary.body.draft).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'resp-draft-discard' }),
      ]),
    );
  });

  it('returns 404 for /draft/confirm with unknown responseId', async () => {
    await request(createApp())
      .post('/api/assistant/draft/confirm')
      .send({ responseId: 'non-existent-draft' })
      .expect(404);
  });

  it('returns 400 for /draft/confirm without responseId', async () => {
    await request(createApp())
      .post('/api/assistant/draft/confirm')
      .send({})
      .expect(400);
  });
});
