/**
 * Contract Pipeline API Routes - Phase 2.3
 * 合同草拟管道 API 端点
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ContractPipeline');

import { Router } from 'express';
import { contractPipeline, ContractRequest } from '../services/contract-pipeline';
import { insertContractTemplateSchema, insertContractDraftSchema } from '@shared/schema';
import { z } from 'zod';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

const router = Router();

const contractRequestSchema = z.object({
  category: z.enum(['SOFTWARE_DEVELOPMENT', 'CONSULTING', 'NDA', 'EMPLOYMENT', 'LEASE', 'SALES', 'SERVICE', 'PARTNERSHIP', 'OTHER']),
  projectName: z.string().optional(),
  partyA: z.object({
    name: z.string(),
    legalName: z.string().optional(),
    address: z.string().optional(),
    representative: z.string().optional(),
    idNumber: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    bankAccount: z.string().optional(),
    bankName: z.string().optional(),
  }),
  partyB: z.object({
    name: z.string(),
    legalName: z.string().optional(),
    address: z.string().optional(),
    representative: z.string().optional(),
    idNumber: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    bankAccount: z.string().optional(),
    bankName: z.string().optional(),
  }),
  amount: z.number().optional(),
  currency: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  customRequirements: z.string().optional(),
  industry: z.string().optional(),
});

router.get('/templates', async (req, res) => {
  try {
    const { category, industry, search } = req.query;
    
    const templates = await contractPipeline.getTemplates({
      category: category as string | undefined,
      industry: industry as string,
      search: search as string,
    });
    
    res.json({ success: true, templates });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get templates error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await contractPipeline.getTemplate(id);
    
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, template });
  } catch (error: unknown) {
    logger.error({ err: error, templateId: req.params.id }, 'Get template error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const validatedData = insertContractTemplateSchema.parse(req.body);
    const template = await contractPipeline.createTemplate(validatedData);
    
    res.json({ success: true, template });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create template error');
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  }
});

router.post('/generate', async (req, res) => {
  try {
    const validatedRequest = contractRequestSchema.parse(req.body);
    const output = await contractPipeline.generateDraft(validatedRequest as ContractRequest);
    
    res.json({ 
      success: true, 
      draft: output.draft,
      content: output.content,
      risks: output.risks,
      negotiationPoints: output.negotiationPoints,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Generate draft error');
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  }
});

router.get('/drafts', async (req, res) => {
  try {
    const { status, category, limit } = req.query;
    
    const drafts = await contractPipeline.getDrafts({
      status: status as string | undefined,
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json({ success: true, drafts });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get drafts error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/drafts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const draft = await contractPipeline.getDraft(id);
    
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }
    
    res.json({ success: true, draft });
  } catch (error: unknown) {
    logger.error({ err: error, draftId: req.params.id }, 'Get draft error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.patch('/drafts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const draft = await contractPipeline.updateDraft(id, req.body);
    
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }
    
    res.json({ success: true, draft });
  } catch (error: unknown) {
    logger.error({ err: error, draftId: req.params.id }, 'Update draft error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.patch('/drafts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['DRAFT', 'REVIEW', 'APPROVED', 'SIGNED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const draft = await contractPipeline.updateDraftStatus(id, status);
    
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }
    
    res.json({ success: true, draft });
  } catch (error: unknown) {
    logger.error({ err: error, draftId: req.params.id }, 'Update draft status error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete('/drafts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await contractPipeline.deleteDraft(id);
    
    res.json({ success: true, message: 'Draft deleted' });
  } catch (error: unknown) {
    logger.error({ err: error, draftId: req.params.id }, 'Delete draft error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await contractPipeline.getStats();
    
    res.json({ success: true, stats });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stats error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
