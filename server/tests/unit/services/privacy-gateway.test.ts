import { describe, expect, it } from 'vitest';
import { classifyCloudPrivacy, createLocalOnlyAssistantMessage } from '../../../services/privacy/PrivacyGateway';

describe('PrivacyGateway', () => {
  it('blocks financial credentials from cloud model calls', () => {
    const decision = classifyCloudPrivacy('我的银行卡号是6222020202020202020，支付密码是123456');

    expect(decision.decision).toBe('LOCAL_ONLY');
    expect(decision.classification.sensitiveCategories).toContain('FINANCIAL');
    expect(JSON.stringify(decision.safeLog)).not.toContain('6222020202020202020');
  });

  it('allows low sensitivity ordinary chat', () => {
    const decision = classifyCloudPrivacy('明天帮我整理一下普通待办');

    expect(decision.decision).toBe('ALLOW_CLOUD');
    expect(decision.classification.sensitivityLevel).toBe('LOW');
  });

  it('returns a clear local-only assistant message', () => {
    const decision = classifyCloudPrivacy('身份证号码是11010119900307123X');
    const message = createLocalOnlyAssistantMessage(decision);

    expect(message).toContain('未发送给云端大模型');
    expect(message).toContain('PERSONAL_ID');
  });
});
