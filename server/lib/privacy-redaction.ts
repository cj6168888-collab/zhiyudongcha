type JsonLike = null | undefined | string | number | boolean | JsonLike[] | { [key: string]: unknown };

const SECRET_FIELD_PARTS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'privatekey',
  'private_key',
  'authorization',
  'cookie',
  'credential',
  'verificationcode',
  'verification_code',
  'otp',
];

const USER_CONTENT_FIELD_PARTS = [
  'input',
  'message',
  'text',
  'voicetext',
  'usermessage',
  'content',
  'prompt',
  'query',
  'description',
  'transcript',
];

const SENSITIVE_TEXT_PATTERNS: RegExp[] = [
  /\b\d{17}[\dXx]\b/g,
  /\b1[3-9]\d{9}\b/g,
  /\b\d{12,19}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:sk|ak|pk|rk|key)-[A-Za-z0-9_-]{12,}\b/gi,
  /(?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)\s*[=:：]\s*[^\s,，;；]+/gi,
  /(?:密码|口令|验证码|支付码|支付密码|私钥|密钥|银行卡号|身份证号)\s*(?:是|为|=|:|：)?\s*[^\s,，;；。]+/g,
];

export interface PrivacySafeTextMetadata {
  redacted: true;
  length: number;
  preview: string;
}

function normalizeKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function isSecretField(key: string): boolean {
  const normalized = normalizeKey(key);
  return SECRET_FIELD_PARTS.some(part => normalized.includes(normalizeKey(part)));
}

function isUserContentField(key: string): boolean {
  const normalized = normalizeKey(key);
  return USER_CONTENT_FIELD_PARTS.some(part => normalized === normalizeKey(part) || normalized.endsWith(normalizeKey(part)));
}

export function redactSensitiveText(text: string): string {
  let redacted = text;
  for (const pattern of SENSITIVE_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

export function createPrivacySafeTextMetadata(text: string, previewLength = 48): PrivacySafeTextMetadata {
  const normalized = redactSensitiveText(text).replace(/\s+/g, ' ').trim();
  const preview = normalized.length > previewLength
    ? `${normalized.slice(0, previewLength)}...`
    : normalized;

  return {
    redacted: true,
    length: text.length,
    preview,
  };
}

function sanitizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: createPrivacySafeTextMetadata(error.message, 80),
  };
}

export function sanitizeLogValue(value: unknown, key?: string, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (key && isSecretField(key)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    if (key && isUserContentField(key)) {
      return createPrivacySafeTextMetadata(value);
    }
    return redactSensitiveText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth > 6) {
      return '[MAX_DEPTH]';
    }
    return value.map(item => sanitizeLogValue(item, undefined, depth + 1));
  }

  if (typeof value === 'object') {
    if (depth > 6) {
      return '[MAX_DEPTH]';
    }

    const sanitized: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      sanitized[entryKey] = sanitizeLogValue(entryValue, entryKey, depth + 1);
    }
    return sanitized;
  }

  return value;
}

export function sanitizeLogPayload<T extends JsonLike | Record<string, unknown>>(payload: T): T {
  return sanitizeLogValue(payload) as T;
}
