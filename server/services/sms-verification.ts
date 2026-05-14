import crypto from 'crypto';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('SmsVerification');

export type SmsScene = 'register' | 'reset_password';

interface SmsCodeRecord {
  phone: string;
  scene: SmsScene;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  resendAvailableAt: number;
  debugCode?: string;
}

interface SendCodeResult {
  phone: string;
  expiresIn: number;
  cooldownSeconds: number;
  debugCode?: string;
}

const CODE_TTL_MS = Number(process.env.SMS_CODE_TTL_SECONDS || 300) * 1000;
const SEND_COOLDOWN_MS = Number(process.env.SMS_SEND_COOLDOWN_SECONDS || 60) * 1000;
const HOURLY_SEND_LIMIT = Number(process.env.SMS_HOURLY_SEND_LIMIT || 5);
const MAX_VERIFY_ATTEMPTS = Number(process.env.SMS_MAX_VERIFY_ATTEMPTS || 5);

const codeStore = new Map<string, SmsCodeRecord>();
const sendHistory = new Map<string, number[]>();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of codeStore.entries()) {
    if (record.expiresAt <= now) {
      codeStore.delete(key);
    }
  }

  for (const [phone, timestamps] of sendHistory.entries()) {
    const recent = timestamps.filter((timestamp) => now - timestamp < 60 * 60 * 1000);
    if (recent.length === 0) {
      sendHistory.delete(phone);
    } else {
      sendHistory.set(phone, recent);
    }
  }
}, 60 * 1000);

cleanupTimer.unref?.();

function storeKey(phone: string, scene: SmsScene): string {
  return `${scene}:${phone}`;
}

function hashCode(phone: string, scene: SmsScene, code: string): string {
  const secret = process.env.SESSION_SECRET || process.env.AVATAR_MASTER_SECRET || 'sms-dev-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${scene}:${phone}:${code}`)
    .digest('hex');
}

function createCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key] ?? '')}`)
    .join('&');
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256Hex(secret: string, value: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function getAliyunConfig(scene: SmsScene) {
  const templateCode =
    scene === 'register'
      ? process.env.ALIYUN_SMS_REGISTER_TEMPLATE_CODE || process.env.ALIYUN_SMS_TEMPLATE_CODE
      : process.env.ALIYUN_SMS_RESET_TEMPLATE_CODE || process.env.ALIYUN_SMS_TEMPLATE_CODE;

  return {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
    signName: process.env.ALIYUN_SMS_SIGN_NAME,
    templateCode,
    endpoint: process.env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com',
    dryRun: process.env.ALIYUN_SMS_DRY_RUN === 'true',
  };
}

function assertPasswordResetScene(scene: string): asserts scene is SmsScene {
  if (scene !== 'register' && scene !== 'reset_password') {
    throw new Error('验证码场景无效');
  }
}

export function normalizePhone(phone: string): string {
  const normalized = String(phone || '').trim().replace(/[\s-]/g, '');
  const withoutCountryCode = normalized.startsWith('+86')
    ? normalized.slice(3)
    : normalized.startsWith('86') && normalized.length === 13
      ? normalized.slice(2)
      : normalized;

  if (!/^1[3-9]\d{9}$/.test(withoutCountryCode)) {
    throw new Error('请输入有效的中国大陆手机号');
  }

  return withoutCountryCode;
}

async function sendAliyunSms(phone: string, scene: SmsScene, code: string): Promise<void> {
  const config = getAliyunConfig(scene);
  const missing = [
    !config.accessKeyId && 'ALIYUN_ACCESS_KEY_ID',
    !config.accessKeySecret && 'ALIYUN_ACCESS_KEY_SECRET',
    !config.signName && 'ALIYUN_SMS_SIGN_NAME',
    !config.templateCode && (scene === 'register' ? 'ALIYUN_SMS_REGISTER_TEMPLATE_CODE' : 'ALIYUN_SMS_RESET_TEMPLATE_CODE'),
  ].filter(Boolean);

  if (missing.length > 0 || config.dryRun) {
    if (process.env.NODE_ENV === 'production' && missing.length > 0) {
      throw new Error(`阿里云短信配置缺失：${missing.join(', ')}`);
    }
    logger.info({ phone, scene, code, dryRun: config.dryRun, missing }, 'SMS dry run');
    return;
  }

  const templateParam = JSON.stringify({ code });
  const query = canonicalQuery({
    PhoneNumbers: phone,
    SignName: config.signName!,
    TemplateCode: config.templateCode!,
    TemplateParam: templateParam,
  });
  const payloadHash = sha256Hex('');
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomUUID();
  const signedHeaders = 'host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-signature-nonce;x-acs-version';
  const canonicalHeaders = [
    `host:${config.endpoint}`,
    'x-acs-action:SendSms',
    `x-acs-content-sha256:${payloadHash}`,
    `x-acs-date:${date}`,
    `x-acs-signature-nonce:${nonce}`,
    'x-acs-version:2017-05-25',
  ].join('\n') + '\n';
  const canonicalRequest = [
    'POST',
    '/',
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = `ACS3-HMAC-SHA256\n${sha256Hex(canonicalRequest)}`;
  const signature = hmacSha256Hex(config.accessKeySecret!, stringToSign);
  const authorization = `ACS3-HMAC-SHA256 Credential=${config.accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`;

  const response = await fetch(`https://${config.endpoint}/?${query}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'x-acs-action': 'SendSms',
      'x-acs-version': '2017-05-25',
      'x-acs-date': date,
      'x-acs-signature-nonce': nonce,
      'x-acs-content-sha256': payloadHash,
    },
  });

  const bodyText = await response.text();
  let body: { Code?: string; Message?: string; RequestId?: string } = {};
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { Message: bodyText };
  }

  if (!response.ok || body.Code !== 'OK') {
    logger.warn({ status: response.status, body, phone, scene }, 'Aliyun SMS send failed');
    throw new Error(body.Message || '阿里云短信发送失败');
  }
}

export class SmsVerificationService {
  normalizePhone(phone: string): string {
    return normalizePhone(phone);
  }

  async sendCode(phoneInput: string, sceneInput: string): Promise<SendCodeResult> {
    assertPasswordResetScene(sceneInput);
    const phone = normalizePhone(phoneInput);
    const scene = sceneInput;
    const key = storeKey(phone, scene);
    const now = Date.now();
    const existing = codeStore.get(key);

    if (existing && existing.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((existing.resendAvailableAt - now) / 1000);
      throw new Error(`请 ${waitSeconds} 秒后再获取验证码`);
    }

    const recentSends = (sendHistory.get(phone) || []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
    if (recentSends.length >= HOURLY_SEND_LIMIT) {
      throw new Error('验证码发送过于频繁，请稍后再试');
    }

    const code = createCode();
    await sendAliyunSms(phone, scene, code);

    sendHistory.set(phone, [...recentSends, now]);
    const debugCode = process.env.NODE_ENV === 'production' ? undefined : code;
    codeStore.set(key, {
      phone,
      scene,
      codeHash: hashCode(phone, scene, code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      resendAvailableAt: now + SEND_COOLDOWN_MS,
      debugCode,
    });

    return {
      phone,
      expiresIn: Math.floor(CODE_TTL_MS / 1000),
      cooldownSeconds: Math.floor(SEND_COOLDOWN_MS / 1000),
      debugCode,
    };
  }

  verifyCode(phoneInput: string, sceneInput: string, codeInput: string, consume = true): { phone: string } {
    assertPasswordResetScene(sceneInput);
    const phone = normalizePhone(phoneInput);
    const code = String(codeInput || '').trim();
    const key = storeKey(phone, sceneInput);
    const record = codeStore.get(key);
    const now = Date.now();

    if (!record || record.expiresAt <= now) {
      codeStore.delete(key);
      throw new Error('验证码已过期，请重新获取');
    }

    if (!/^\d{6}$/.test(code)) {
      throw new Error('验证码格式不正确');
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      codeStore.delete(key);
      throw new Error('验证码尝试次数过多，请重新获取');
    }

    record.attempts += 1;
    const expected = record.codeHash;
    const actual = hashCode(phone, sceneInput, code);
    if (!timingSafeEqual(actual, expected)) {
      throw new Error('验证码不正确');
    }

    if (consume) {
      codeStore.delete(key);
    }

    return { phone };
  }
}

export const smsVerificationService = new SmsVerificationService();
