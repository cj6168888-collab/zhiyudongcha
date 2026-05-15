import { randomUUID } from 'node:crypto';

export type PrivacySensitivity = 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
export type VaultExportLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

export type SensitiveEntityType =
  | 'PERSON_ALIAS'
  | 'POSITION'
  | 'ORGANIZATION'
  | 'PHONE'
  | 'EMAIL'
  | 'BANK_CARD'
  | 'PERSONAL_ID'
  | 'CREDENTIAL'
  | 'API_KEY';

interface CandidateEntity {
  type: SensitiveEntityType;
  value: string;
  start: number;
  end: number;
  priority: number;
  safeLabel?: string;
}

export interface SensitiveEntity extends CandidateEntity {
  placeholder: string;
  sensitivity: PrivacySensitivity;
  exportLevel: VaultExportLevel;
  safeLabel: string;
}

export interface PublicSensitiveEntity {
  placeholder: string;
  type: SensitiveEntityType;
  sensitivity: PrivacySensitivity;
  exportLevel: VaultExportLevel;
  safeLabel: string;
}

export interface RedactedInferenceSession {
  id: string;
  cloudText: string;
  redactionApplied: boolean;
  entities: SensitiveEntity[];
  createdAt: string;
  expiresAt: string;
  purpose?: string;
  requiresConfirm: boolean;
}

export interface RedactedInferenceResult {
  sessionId?: string;
  cloudText: string;
  redactionApplied: boolean;
  entities: PublicSensitiveEntity[];
  expiresAt?: string;
  requiresConfirm: boolean;
  highestSensitivity: PrivacySensitivity;
}

export interface LocalBackfillResult {
  renderedText: string;
  replacedPlaceholders: string[];
  blockedPlaceholders: string[];
  requiresManualVerification: boolean;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const TYPE_META: Record<
  SensitiveEntityType,
  {
    prefix: string;
    sensitivity: PrivacySensitivity;
    exportLevel: VaultExportLevel;
    defaultLabel: string;
    priority: number;
  }
> = {
  CREDENTIAL: { prefix: 'CREDENTIAL', sensitivity: 'S4', exportLevel: 'E4', defaultLabel: '凭证', priority: 100 },
  API_KEY: { prefix: 'API_KEY', sensitivity: 'S4', exportLevel: 'E4', defaultLabel: 'API Key', priority: 95 },
  PERSONAL_ID: { prefix: 'ID', sensitivity: 'S3', exportLevel: 'E3', defaultLabel: '证件号', priority: 90 },
  BANK_CARD: { prefix: 'ACCOUNT', sensitivity: 'S3', exportLevel: 'E3', defaultLabel: '银行卡号', priority: 85 },
  PHONE: { prefix: 'PHONE', sensitivity: 'S3', exportLevel: 'E2', defaultLabel: '手机号', priority: 80 },
  EMAIL: { prefix: 'EMAIL', sensitivity: 'S2', exportLevel: 'E2', defaultLabel: '邮箱', priority: 70 },
  PERSON_ALIAS: { prefix: 'PERSON', sensitivity: 'S2', exportLevel: 'E1', defaultLabel: '联系人', priority: 50 },
  POSITION: { prefix: 'POSITION', sensitivity: 'S2', exportLevel: 'E1', defaultLabel: '职位', priority: 45 },
  ORGANIZATION: { prefix: 'ORG', sensitivity: 'S2', exportLevel: 'E1', defaultLabel: '组织', priority: 40 },
};

const SENSITIVITY_PRIORITY: Record<PrivacySensitivity, number> = {
  S0: 0,
  S1: 1,
  S2: 2,
  S3: 3,
  S4: 4,
};

const SECRET_LABEL_PATTERN =
  /(?:银行卡密码|支付密码|授权码|验证码|助记词|password|passwd|token|secret|api[_-]?key|access[_-]?key|private[_-]?key|密码|口令|私钥|密钥)\s*(?:是|为|=|:|：)?\s*[^\s,，;；。]+/gi;

function collectRegexCandidates(
  text: string,
  type: SensitiveEntityType,
  regex: RegExp,
  safeLabel?: string,
): CandidateEntity[] {
  const meta = TYPE_META[type];
  const candidates: CandidateEntity[] = [];

  for (const match of text.matchAll(regex)) {
    const value = match[0];
    const start = match.index;
    if (start === undefined || value.length === 0) {
      continue;
    }
    candidates.push({
      type,
      value,
      start,
      end: start + value.length,
      priority: meta.priority,
      safeLabel,
    });
  }

  return candidates;
}

function overlaps(a: CandidateEntity, b: CandidateEntity): boolean {
  return a.start < b.end && b.start < a.end;
}

function maskTail(value: string, visible = 4): string {
  const tail = value.replace(/\s+/g, '').slice(-visible);
  return tail ? `尾号${tail}` : '已隐藏';
}

function entitySafeLabel(entity: CandidateEntity): string {
  if (entity.safeLabel) {
    return entity.safeLabel;
  }

  switch (entity.type) {
    case 'PHONE':
      return `手机号${maskTail(entity.value)}`;
    case 'BANK_CARD':
      return `银行卡${maskTail(entity.value)}`;
    case 'PERSONAL_ID':
      return `证件号${maskTail(entity.value)}`;
    case 'EMAIL': {
      const [name, domain] = entity.value.split('@');
      const domainLabel = domain ? `@${domain}` : '';
      return `${name?.slice(0, 2) || '邮箱'}***${domainLabel}`;
    }
    case 'CREDENTIAL':
      return '高敏凭证';
    case 'API_KEY':
      return 'API Key';
    default:
      return TYPE_META[entity.type].defaultLabel;
  }
}

function toPublicEntity(entity: SensitiveEntity): PublicSensitiveEntity {
  return {
    placeholder: entity.placeholder,
    type: entity.type,
    sensitivity: entity.sensitivity,
    exportLevel: entity.exportLevel,
    safeLabel: entity.safeLabel,
  };
}

function selectNonOverlapping(candidates: CandidateEntity[]): CandidateEntity[] {
  const ordered = [...candidates].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    const lengthDiff = (b.end - b.start) - (a.end - a.start);
    if (lengthDiff !== 0) {
      return lengthDiff;
    }
    return b.priority - a.priority;
  });

  const selected: CandidateEntity[] = [];
  for (const candidate of ordered) {
    if (selected.some(existing => overlaps(existing, candidate))) {
      const overlappingIndex = selected.findIndex(existing => overlaps(existing, candidate));
      const overlapping = selected[overlappingIndex];
      if (overlapping && candidate.priority > overlapping.priority) {
        selected.splice(overlappingIndex, 1, candidate);
      }
      continue;
    }
    selected.push(candidate);
  }

  return selected.sort((a, b) => a.start - b.start);
}

function highestSensitivity(entities: PublicSensitiveEntity[]): PrivacySensitivity {
  return entities.reduce<PrivacySensitivity>((highest, entity) => {
    return SENSITIVITY_PRIORITY[entity.sensitivity] > SENSITIVITY_PRIORITY[highest]
      ? entity.sensitivity
      : highest;
  }, 'S1');
}

export class RedactedInferenceGateway {
  private sessions = new Map<string, RedactedInferenceSession>();

  extractEntities(text: string): SensitiveEntity[] {
    const candidates: CandidateEntity[] = [
      ...collectRegexCandidates(text, 'CREDENTIAL', SECRET_LABEL_PATTERN, '高敏凭证'),
      ...collectRegexCandidates(text, 'API_KEY', /\b(?:sk|ak|pk|rk|key)-[A-Za-z0-9_-]{12,}\b/gi),
      ...collectRegexCandidates(text, 'PERSONAL_ID', /\b\d{17}[\dXx]\b/g),
      ...collectRegexCandidates(text, 'PHONE', /\b1[3-9]\d{9}\b/g),
      ...collectRegexCandidates(text, 'BANK_CARD', /\b\d{12,19}\b/g),
      ...collectRegexCandidates(text, 'EMAIL', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g),
      ...collectRegexCandidates(
        text,
        'PERSON_ALIAS',
        /[\u4e00-\u9fa5]{1,2}(?:总|经理|会计|律师|医生|主任|老师|老板|客户|秘书|局长|处长|部长|主管|同事)/g,
      ),
      ...collectRegexCandidates(
        text,
        'POSITION',
        /\b(?:CEO|CTO|CFO|COO)\b|财务总监|技术总监|产品经理|项目经理|法务|会计|出纳|律师|医生|主任|局长|处长|部长|主管/gi,
      ),
      ...collectRegexCandidates(
        text,
        'ORGANIZATION',
        /(?:招商|建设|工商|农业|中国|交通|中信|光大|民生|兴业|浦发|广发|平安|邮储|北京|上海|华夏)银行/g,
      ),
      ...collectRegexCandidates(
        text,
        'ORGANIZATION',
        /[\u4e00-\u9fa5A-Za-z0-9]{2,12}(?:公司|集团|医院|律所|事务所|学校|大学)/g,
      ),
    ];

    const counters = new Map<string, number>();
    return selectNonOverlapping(candidates).map((entity) => {
      const meta = TYPE_META[entity.type];
      const next = (counters.get(meta.prefix) || 0) + 1;
      counters.set(meta.prefix, next);

      return {
        ...entity,
        placeholder: `{{${meta.prefix}_${next}}}`,
        sensitivity: meta.sensitivity,
        exportLevel: meta.exportLevel,
        safeLabel: entitySafeLabel(entity),
      };
    });
  }

  redactForCloud(
    text: string,
    options: { purpose?: string; ttlMs?: number; storeSession?: boolean } = {},
  ): RedactedInferenceResult {
    this.cleanupExpiredSessions();

    const entities = this.extractEntities(text);
    let cloudText = '';
    let cursor = 0;

    for (const entity of entities) {
      cloudText += text.slice(cursor, entity.start);
      cloudText += entity.placeholder;
      cursor = entity.end;
    }
    cloudText += text.slice(cursor);

    const publicEntities = entities.map(toPublicEntity);
    const requiresConfirm = publicEntities.some(entity => SENSITIVITY_PRIORITY[entity.sensitivity] >= SENSITIVITY_PRIORITY.S3);
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    let sessionId: string | undefined;

    if (options.storeSession !== false && entities.length > 0) {
      sessionId = randomUUID();
      this.sessions.set(sessionId, {
        id: sessionId,
        cloudText,
        redactionApplied: entities.length > 0,
        entities,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        purpose: options.purpose,
        requiresConfirm,
      });
    }

    return {
      sessionId,
      cloudText,
      redactionApplied: entities.length > 0,
      entities: publicEntities,
      expiresAt: sessionId ? expiresAt.toISOString() : undefined,
      requiresConfirm,
      highestSensitivity: highestSensitivity(publicEntities),
    };
  }

  renderLocalBackfill(sessionId: string, template: string): LocalBackfillResult {
    this.cleanupExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Redaction session not found or expired');
    }

    let renderedText = template;
    const replacedPlaceholders: string[] = [];
    const blockedPlaceholders: string[] = [];

    for (const entity of session.entities) {
      if (!renderedText.includes(entity.placeholder)) {
        continue;
      }

      if (entity.exportLevel === 'E4') {
        renderedText = renderedText.split(entity.placeholder).join(`[需手工验证:${entity.safeLabel}]`);
        blockedPlaceholders.push(entity.placeholder);
        continue;
      }

      renderedText = renderedText.split(entity.placeholder).join(entity.value);
      replacedPlaceholders.push(entity.placeholder);
    }

    return {
      renderedText,
      replacedPlaceholders,
      blockedPlaceholders,
      requiresManualVerification: blockedPlaceholders.length > 0,
    };
  }

  discardSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt).getTime() <= now) {
        this.sessions.delete(id);
      }
    }
  }
}

export const redactedInferenceGateway = new RedactedInferenceGateway();
