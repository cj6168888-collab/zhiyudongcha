/**
 * Contract Pipeline API Routes - Phase 2.3
 * 合同草拟管道 API 端点
 */

import { Router } from 'express';
import { contractPipeline, ContractRequest } from '../services/contract-pipeline';
import { insertContractTemplateSchema, insertContractDraftSchema } from '@shared/schema';
import { z } from 'zod';

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
      category: category as any,
      industry: industry as string,
      search: search as string,
    });
    
    res.json({ success: true, templates });
  } catch (error: any) {
    console.error('[ContractAPI] Get templates error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ContractAPI] Get template error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const validatedData = insertContractTemplateSchema.parse(req.body);
    const template = await contractPipeline.createTemplate(validatedData);
    
    res.json({ success: true, template });
  } catch (error: any) {
    console.error('[ContractAPI] Create template error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ContractAPI] Generate draft error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get('/drafts', async (req, res) => {
  try {
    const { status, category, limit } = req.query;
    
    const drafts = await contractPipeline.getDrafts({
      status: status as any,
      category: category as any,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json({ success: true, drafts });
  } catch (error: any) {
    console.error('[ContractAPI] Get drafts error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ContractAPI] Get draft error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ContractAPI] Update draft error:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    console.error('[ContractAPI] Update status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/drafts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await contractPipeline.deleteDraft(id);
    
    res.json({ success: true, message: 'Draft deleted' });
  } catch (error: any) {
    console.error('[ContractAPI] Delete draft error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await contractPipeline.getStats();
    
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[ContractAPI] Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
