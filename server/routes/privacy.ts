import { Router } from 'express';
import { z } from 'zod';
import { requireMaster } from '../middleware/auth';
import { classifyCloudPrivacy } from '../services/privacy/PrivacyGateway';
import { redactedInferenceGateway, type PrivacySensitivity } from '../services/privacy/RedactedInferenceGateway';

const router = Router();

router.use(requireMaster);

const classifyBodySchema = z.object({
  text: z.string().min(1).max(50_000),
  source: z.string().max(128).optional(),
  purpose: z.string().max(256).optional(),
  allowCloud: z.boolean().optional().default(true),
}).strict();

const redactBodySchema = z.object({
  text: z.string().min(1).max(50_000),
  purpose: z.string().max(256).optional(),
  ttlSeconds: z.number().int().min(10).max(3600).optional(),
}).strict();

const renderBodySchema = z.object({
  sessionId: z.string().min(1),
  template: z.string().min(1).max(50_000),
}).strict();

function mapSensitivity(level: string): PrivacySensitivity {
  switch (level) {
    case 'CRITICAL':
      return 'S4';
    case 'HIGH':
      return 'S3';
    case 'MEDIUM':
      return 'S2';
    case 'LOW':
    default:
      return 'S1';
  }
}

function maxSensitivity(a: PrivacySensitivity, b: PrivacySensitivity): PrivacySensitivity {
  const priority: Record<PrivacySensitivity, number> = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4 };
  return priority[a] >= priority[b] ? a : b;
}

router.post('/classify', (req, res) => {
  const parsed = classifyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid privacy classification request', details: parsed.error.flatten() },
    });
  }

  const { text, purpose, allowCloud } = parsed.data;
  const privacy = classifyCloudPrivacy(text);
  const redaction = redactedInferenceGateway.redactForCloud(text, { purpose, storeSession: false });
  const sensitivity = maxSensitivity(mapSensitivity(privacy.classification.sensitivityLevel), redaction.highestSensitivity);
  const categories = Array.from(new Set([
    ...privacy.classification.sensitiveCategories,
    ...redaction.entities.map(entity => entity.type),
  ]));
  const hasNonExportableSecret = redaction.entities.some(entity => entity.exportLevel === 'E4');
  const decision = !allowCloud || hasNonExportableSecret
    ? 'deny_cloud'
    : privacy.decision === 'LOCAL_ONLY'
      ? 'local_only'
      : redaction.redactionApplied
        ? 'redact_then_cloud'
        : 'allow_cloud';

  return res.json({
    success: true,
    data: {
      sensitivity,
      decision,
      categories,
      reason: hasNonExportableSecret ? '包含不可导出的高敏凭证，不允许云端处理' : privacy.reason,
      redactedText: redaction.cloudText,
      redactionApplied: redaction.redactionApplied,
      requiresConfirm: redaction.requiresConfirm || privacy.decision === 'LOCAL_ONLY',
      entities: redaction.entities,
    },
  });
});

router.post('/redact-for-cloud', (req, res) => {
  const parsed = redactBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid redaction request', details: parsed.error.flatten() },
    });
  }

  const ttlMs = parsed.data.ttlSeconds ? parsed.data.ttlSeconds * 1000 : undefined;
  const redaction = redactedInferenceGateway.redactForCloud(parsed.data.text, {
    purpose: parsed.data.purpose,
    ttlMs,
  });

  return res.json({
    success: true,
    data: redaction,
  });
});

router.post('/render-local', (req, res) => {
  const parsed = renderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid local render request', details: parsed.error.flatten() },
    });
  }

  try {
    const result = redactedInferenceGateway.renderLocalBackfill(parsed.data.sessionId, parsed.data.template);
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'REDACTION_SESSION_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Redaction session not found or expired',
      },
    });
  }
});

export default router;
