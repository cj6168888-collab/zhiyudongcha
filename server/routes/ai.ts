import { Router } from 'express';
import { z } from 'zod';
import { AIServiceError } from '../lib/errors';
import { requireMaster } from '../middleware/auth';
import { llmProxyGateway } from '../services/privacy/LLMProxyGateway';

const router = Router();

router.use(requireMaster);

const safeChatBodySchema = z.object({
  message: z.string().min(1).max(50_000),
  systemPrompt: z.string().max(20_000).optional(),
  userId: z.string().max(128).optional(),
  purpose: z.string().max(256).optional(),
  allowCloud: z.boolean().optional().default(true),
  model: z.string().max(128).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32_000).optional(),
}).strict();

router.post('/safe-chat', async (req, res) => {
  const parsed = safeChatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid safe chat request',
        details: parsed.error.flatten(),
      },
    });
  }

  const body = parsed.data;

  try {
    const result = await llmProxyGateway.chat(body.message, body.systemPrompt, {
      purpose: body.purpose,
      allowCloud: body.allowCloud,
      model: body.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });

    return res.json({
      success: true,
      data: {
        response: result.content,
        cloudUsed: result.cloudUsed,
        decision: result.decision,
        redactionApplied: result.redactionApplied,
        requiresConfirm: result.requiresConfirm,
        provider: result.provider,
        model: result.model,
        sensitivity: result.sensitivity,
        categories: result.categories,
        redactionSessionIds: result.redactionSessionIds,
      },
    });
  } catch (error) {
    if (error instanceof AIServiceError && error.provider === 'llm-proxy-gateway') {
      return res.json({
        success: true,
        data: {
          response: '这条请求包含高敏或不可导出的内容，已被隐私代理拦截，未发送给云端模型。请改用本地模型、保险箱授权流程或手工验证。',
          cloudUsed: false,
          decision: 'LOCAL_ONLY',
          redactionApplied: Boolean(error.details?.redactionApplied),
          requiresConfirm: true,
          sensitivity: error.details?.sensitivity,
          categories: error.details?.categories ?? [],
          blocked: true,
          reason: error.details?.reason ?? error.message,
        },
      });
    }

    if (error instanceof AIServiceError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          provider: error.provider,
          retryable: error.retryable,
        },
      });
    }

    throw error;
  }
});

export default router;
