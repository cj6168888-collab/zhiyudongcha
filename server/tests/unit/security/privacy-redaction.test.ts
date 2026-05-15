import { describe, expect, it } from 'vitest';
import {
  createPrivacySafeTextMetadata,
  redactSensitiveText,
  sanitizeLogValue,
} from '../../../lib/privacy-redaction';

describe('privacy redaction', () => {
  it('redacts obvious sensitive values from free text', () => {
    const text = '手机号 13812345678，身份证 11010119900307123X，apiKey=sk-1234567890abcdef';

    const redacted = redactSensitiveText(text);

    expect(redacted).not.toContain('13812345678');
    expect(redacted).not.toContain('11010119900307123X');
    expect(redacted).not.toContain('sk-1234567890abcdef');
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts short values when they are attached to sensitive Chinese labels', () => {
    const redacted = redactSensitiveText('支付密码是123456，验证码为889900');

    expect(redacted).not.toContain('123456');
    expect(redacted).not.toContain('889900');
  });

  it('turns user content fields into safe metadata', () => {
    const input = '请记住我的银行卡号 6222020202020202020';
    const payload = sanitizeLogValue({
      userId: 'MASTER',
      input,
    }) as Record<string, unknown>;

    expect(payload.userId).toBe('MASTER');
    expect(payload.input).toMatchObject({
      redacted: true,
      length: input.length,
    });
    expect(JSON.stringify(payload)).not.toContain('6222020202020202020');
  });

  it('masks secret fields regardless of value shape', () => {
    const payload = sanitizeLogValue({
      accessToken: 'token-abc',
      nested: { password: 'secret' },
    }) as Record<string, unknown>;

    expect(payload.accessToken).toBe('[REDACTED]');
    expect(payload.nested).toEqual({ password: '[REDACTED]' });
  });

  it('creates length-preserving user text summaries', () => {
    const summary = createPrivacySafeTextMetadata('我的手机号是13812345678');

    expect(summary.redacted).toBe(true);
    expect(summary.length).toBe(17);
    expect(summary.preview).not.toContain('13812345678');
  });
});
