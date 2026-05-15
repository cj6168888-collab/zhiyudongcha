import { beforeEach, describe, expect, it, vi } from 'vitest';

const aiProviderMock = vi.hoisted(() => ({
  complete: vi.fn(),
}));

vi.mock('../../../lib/ai-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/ai-provider')>();
  return {
    ...actual,
    aiProvider: aiProviderMock,
  };
});

import { AIServiceError } from '../../../lib/errors';
import { LLMProxyGateway } from '../../../services/privacy/LLMProxyGateway';

describe('LLMProxyGateway', () => {
  let gateway: LLMProxyGateway;

  beforeEach(() => {
    gateway = new LLMProxyGateway();
    aiProviderMock.complete.mockReset();
    aiProviderMock.complete.mockResolvedValue({
      content: '云端结构化结果',
      provider: 'dashscope',
      model: 'qwen-plus',
      latencyMs: 12,
    });
  });

  it('redacts sensitive identities before cloud completion', async () => {
    const result = await gateway.complete({
      purpose: 'draft_message',
      messages: [
        {
          role: 'user',
          content: '提醒王总明天把招商银行6222020202020202020流水发给李会计，手机号13800138000',
        },
      ],
    });

    expect(result.decision).toBe('REDACT_THEN_CLOUD');
    expect(result.redactionApplied).toBe(true);
    expect(result.cloudUsed).toBe(true);

    const call = aiProviderMock.complete.mock.calls[0][0];
    const sentContent = call.messages[0].content;
    expect(sentContent).toContain('{{PERSON_1}}');
    expect(sentContent).toContain('{{ORG_1}}');
    expect(sentContent).toContain('{{ACCOUNT_1}}');
    expect(sentContent).toContain('{{PHONE_1}}');
    expect(sentContent).not.toContain('王总');
    expect(sentContent).not.toContain('李会计');
    expect(sentContent).not.toContain('6222020202020202020');
    expect(sentContent).not.toContain('13800138000');
  });

  it('blocks non-exportable credentials before provider calls', async () => {
    await expect(
      gateway.complete({
        purpose: 'credential_memory',
        messages: [{ role: 'user', content: '我的招商银行支付密码是123456，帮我记住' }],
      }),
    ).rejects.toMatchObject({
      provider: 'llm-proxy-gateway',
      retryable: false,
    } satisfies Partial<AIServiceError>);

    expect(aiProviderMock.complete).not.toHaveBeenCalled();
  });

  it('passes ordinary low-risk prompts without redaction', async () => {
    const result = await gateway.chat('明天帮我整理一下普通待办', '你是私人助理');

    expect(result.decision).toBe('ALLOW_CLOUD');
    expect(result.redactionApplied).toBe(false);

    const call = aiProviderMock.complete.mock.calls[0][0];
    expect(call.messages).toEqual([
      { role: 'system', content: '你是私人助理' },
      { role: 'user', content: '明天帮我整理一下普通待办' },
    ]);
  });
});
