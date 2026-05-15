import { describe, expect, it } from 'vitest';
import { RedactedInferenceGateway } from '../../../services/privacy/RedactedInferenceGateway';

describe('RedactedInferenceGateway', () => {
  it('keeps names, roles, phone numbers and bank cards out of cloud text', () => {
    const gateway = new RedactedInferenceGateway();
    const result = gateway.redactForCloud(
      '提醒王总明天上午10点把招商银行6222020202020202020流水发给李会计，手机号13800138000',
      { storeSession: false },
    );

    expect(result.cloudText).toContain('{{PERSON_1}}');
    expect(result.cloudText).toContain('{{ORG_1}}');
    expect(result.cloudText).toContain('{{ACCOUNT_1}}');
    expect(result.cloudText).toContain('{{PERSON_2}}');
    expect(result.cloudText).toContain('{{PHONE_1}}');
    expect(result.cloudText).not.toContain('王总');
    expect(result.cloudText).not.toContain('李会计');
    expect(result.cloudText).not.toContain('6222020202020202020');
    expect(result.cloudText).not.toContain('13800138000');
    expect(JSON.stringify(result.entities)).not.toContain('6222020202020202020');
    expect(result.requiresConfirm).toBe(true);
  });

  it('backfills local placeholders while blocking non-exportable credentials', () => {
    const gateway = new RedactedInferenceGateway();
    const result = gateway.redactForCloud(
      '我的邮箱 test@example.com，支付密码是123456，联系人王总',
      { purpose: 'unit-test' },
    );

    const rendered = gateway.renderLocalBackfill(
      result.sessionId!,
      '草稿：发给{{PERSON_1}}，邮箱{{EMAIL_1}}，凭证{{CREDENTIAL_1}}',
    );

    expect(rendered.renderedText).toContain('王总');
    expect(rendered.renderedText).toContain('test@example.com');
    expect(rendered.renderedText).toContain('[需手工验证:高敏凭证]');
    expect(rendered.renderedText).not.toContain('123456');
    expect(rendered.replacedPlaceholders).toEqual(expect.arrayContaining(['{{PERSON_1}}', '{{EMAIL_1}}']));
    expect(rendered.blockedPlaceholders).toEqual(['{{CREDENTIAL_1}}']);
    expect(rendered.requiresManualVerification).toBe(true);
  });

  it('expires redaction sessions before local backfill', async () => {
    const gateway = new RedactedInferenceGateway();
    const result = gateway.redactForCloud('联系王总', { ttlMs: 10 });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(() => gateway.renderLocalBackfill(result.sessionId!, '联系{{PERSON_1}}')).toThrow(
      'Redaction session not found or expired',
    );
  });
});
