/**
 * Conversation API — P0 底座
 * GET/POST /api/conversations
 * GET/PATCH /api/conversations/:id
 * POST /api/conversations/:id/segments
 * POST /api/conversations/:id/finish
 * POST /api/conversations/:id/process
 * DELETE /api/conversations/:id
 * GET /api/conversation-inbox
 * GET /api/conversation-inbox/counts
 * POST /api/conversation-candidates/:id/accept
 * POST /api/conversation-candidates/:id/edit
 * POST /api/conversation-candidates/:id/reject
 */

import { Router, Request, Response } from 'express';
import { attachRole } from '../middleware/auth';
import { conversationService } from '../services/conversation/ConversationService';
import { conversationProcessor } from '../services/conversation/ConversationProcessor';
import { createServiceLogger } from '../lib/logger';
import { storageAdapter } from '../storage/adapter';

const router = Router();
const inboxRouter = Router();
const candidateRouter = Router();
const logger = createServiceLogger('ConversationRoutes');

router.use(attachRole);
inboxRouter.use(attachRole);
candidateRouter.use(attachRole);

function getUserId(req: Request): string {
  return (req as unknown as { user?: { id?: string } }).user?.id || 'default';
}

// --- Conversations ---

router.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const list = await conversationService.list(ownerId, limit, offset);
    res.json({ success: true, conversations: list });
  } catch (err) {
    logger.error('List conversations failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { source = 'manual', mode, language, title, sourceDeviceId } = req.body;

    const VALID_SOURCES = ['mobile', 'desktop', 'xiaozhi_device', 'omi', 'browser', 'file', 'manual', 'import'];
    if (!VALID_SOURCES.includes(source)) {
      res.status(400).json({ success: false, error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` });
      return;
    }

    const conversation = await conversationService.create({ ownerId, source, mode, language, title, sourceDeviceId });
    res.status(201).json({ success: true, conversation });
  } catch (err) {
    logger.error('Create conversation failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const conversation = await conversationService.get(req.params.id, ownerId);
    if (!conversation) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const segments = await conversationService.getSegments(req.params.id);
    const candidates = await conversationService.getCandidates(req.params.id);
    res.json({ success: true, conversation, segments, candidates });
  } catch (err) {
    logger.error('Get conversation failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { status, summary, title } = req.body;
    await conversationService.updateStatus(req.params.id, status, { summary, title });
    const updated = await conversationService.get(req.params.id, ownerId);
    res.json({ success: true, conversation: updated });
  } catch (err) {
    logger.error('Patch conversation failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.post('/:id/segments', async (req: Request, res: Response) => {
  try {
    const { sequence, segmentType = 'transcript', text, speaker, speakerType, source = 'manual', startMs, endMs, confidence } = req.body;

    if (typeof sequence !== 'number') {
      res.status(400).json({ success: false, error: 'sequence is required' });
      return;
    }

    const segment = await conversationService.appendSegment({
      conversationId: req.params.id,
      sequence,
      segmentType,
      text,
      speaker,
      speakerType,
      source,
      startMs,
      endMs,
      confidence,
    });

    res.status(201).json({ success: true, segment });
  } catch (err) {
    logger.error('Append segment failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.post('/:id/finish', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const conversation = await conversationService.finish(req.params.id, ownerId);
    if (!conversation) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, conversation });
  } catch (err) {
    logger.error('Finish conversation failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.post('/:id/process', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const result = await conversationProcessor.process(req.params.id, ownerId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Not found or already processed' });
      return;
    }
    res.json({ success: true, result });
  } catch (err) {
    logger.error('Process conversation failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const ok = await conversationService.delete(req.params.id, ownerId);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, message: '对话已归档，关联的来源追溯标记已更新' });
  } catch (err) {
    logger.error('Delete conversation failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// --- Inbox ---

inboxRouter.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const result = await conversationService.getInbox({ ownerId, limit, offset });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Inbox query failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

inboxRouter.get('/counts', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const counts = await conversationService.getInboxCounts(ownerId);
    res.json({ success: true, counts });
  } catch (err) {
    logger.error('Inbox counts failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// --- Candidates ---

interface CandidateRow { candidate_type: string; status: string; content: unknown; linked_entity_id?: string | null; }

async function applyTaskCandidate(candidate: CandidateRow, ownerId: string): Promise<string | null> {
  try {
    const { title, description } = candidate.content as { title: string; description?: string };
    const project = await storageAdapter.createProject({
      title: `任务：${title}`,
      description,
      category: 'BUSINESS',
      status: 'PENDING_REVIEW',
      priority: 5,
    });
    return project?.id ?? null;
  } catch {
    return null;
  }
}

async function applyMemoryCandidate(candidate: CandidateRow): Promise<string | null> {
  try {
    const { content, tags } = candidate.content as { content: string; tags?: string[] };
    const item = await storageAdapter.createVaultItem({
      category: 'MEMORY',
      fileName: String(content).slice(0, 80),
      semanticTags: tags ?? [],
      semanticIndex: content,
      privacyZone: 'ZONE_GREEN',
    });
    return item?.id ?? null;
  } catch {
    return null;
  }
}

candidateRouter.post('/:id/accept', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const candidate = await conversationService.reviewCandidate(req.params.id, 'accept', ownerId);
    if (!candidate) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, candidate });
  } catch (err) {
    logger.error('Accept candidate failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

candidateRouter.post('/:id/edit', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { content } = req.body;
    if (!content || typeof content !== 'object') {
      res.status(400).json({ success: false, error: 'content object required' });
      return;
    }
    const candidate = await conversationService.reviewCandidate(req.params.id, 'edit', ownerId, content);
    if (!candidate) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, candidate });
  } catch (err) {
    logger.error('Edit candidate failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

candidateRouter.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const candidate = await conversationService.reviewCandidate(req.params.id, 'reject', ownerId);
    if (!candidate) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, candidate });
  } catch (err) {
    logger.error('Reject candidate failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

candidateRouter.post('/:id/apply', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);

    // Fetch candidate to determine type and apply
    const candidates = await conversationService.getCandidates(''); // We need a different approach
    // Fetch from DB directly
    const db = (await import('../db')).getDatabase();
    if (!db) {
      res.status(503).json({ success: false, error: 'Database not available' });
      return;
    }
    const { sql } = await import('drizzle-orm');
    const rows = await db.execute(sql`SELECT * FROM conversation_candidates WHERE id = ${req.params.id} LIMIT 1`);
    if (!rows.rows[0]) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    const candidate = rows.rows[0] as CandidateRow;
    if (candidate.status === 'applied') {
      res.json({ success: true, message: 'Already applied', linkedEntityId: candidate.linked_entity_id });
      return;
    }

    let linkedEntityId: string | null = null;
    let linkedEntityType: string | null = null;

    if (candidate.candidate_type === 'task') {
      linkedEntityId = await applyTaskCandidate(candidate, ownerId);
      linkedEntityType = 'project';
    } else if (candidate.candidate_type === 'memory') {
      linkedEntityId = await applyMemoryCandidate(candidate);
      linkedEntityType = 'vault_item';
    }

    if (linkedEntityId) {
      await conversationService.markCandidateApplied(req.params.id, linkedEntityId, linkedEntityType!);
    }

    res.json({ success: true, linkedEntityId, linkedEntityType });
  } catch (err) {
    logger.error('Apply candidate failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export { router as conversationRouter, inboxRouter as conversationInboxRouter, candidateRouter as conversationCandidateRouter };
