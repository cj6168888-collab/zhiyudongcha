/**
 * Relationship Graph API Routes - Phase 2.4
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RelationshipGraph');

import { Router, Request, Response } from 'express';
import { relationshipGraph, SuggestionStatus, SuggestionPriority } from '../services/relationship-graph';
import { insertRelationshipEdgeSchema, insertRelationshipSuggestionSchema } from '@shared/schema';

const router = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

router.get('/edges', async (req: Request, res: Response) => {
  try {
    const { personId } = req.query;
    
    let edges;
    if (personId) {
      edges = await relationshipGraph.getPersonEdges(personId as string);
    } else {
      edges = await relationshipGraph.getAllEdges();
    }
    
    res.json({ success: true, edges });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error fetching edges');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/edges/:id', async (req: Request, res: Response) => {
  try {
    const edge = await relationshipGraph.getEdge(req.params.id);
    
    if (!edge) {
      return res.status(404).json({ success: false, error: 'Edge not found' });
    }
    
    res.json({ success: true, edge });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error fetching edge');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/edges', async (req: Request, res: Response) => {
  try {
    const validation = insertRelationshipEdgeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const edge = await relationshipGraph.createEdge(validation.data);
    res.status(201).json({ success: true, edge });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error creating edge');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.patch('/edges/:id', async (req: Request, res: Response) => {
  try {
    const edge = await relationshipGraph.updateEdge(req.params.id, req.body);
    res.json({ success: true, edge });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error updating edge');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete('/edges/:id', async (req: Request, res: Response) => {
  try {
    await relationshipGraph.deleteEdge(req.params.id);
    res.json({ success: true, message: 'Edge deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error deleting edge');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/interactions', async (req: Request, res: Response) => {
  try {
    const { personAId, personBId, sentiment } = req.body;
    
    if (!personAId || !personBId) {
      return res.status(400).json({ 
        success: false, 
        error: 'personAId and personBId are required' 
      });
    }
    
    const edge = await relationshipGraph.recordInteraction(
      String(personAId),
      String(personBId),
      sentiment
    );
    
    res.json({ success: true, edge });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error recording interaction');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/infer', async (req: Request, res: Response) => {
  try {
    const { personAId, personBId, source, duration, sentiment } = req.body;
    
    if (!personAId || !personBId || !source) {
      return res.status(400).json({ 
        success: false, 
        error: 'personAId, personBId, and source are required' 
      });
    }
    
    const edge = await relationshipGraph.inferRelationshipFromInteraction(
      String(personAId),
      String(personBId),
      { source, duration, sentiment }
    );
    
    res.json({ success: true, edge });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error inferring relationship');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/graph', async (req: Request, res: Response) => {
  try {
    const graphData = await relationshipGraph.getGraphData();
    res.json({ success: true, graph: graphData });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error fetching graph data');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await relationshipGraph.getStats();
    res.json({ success: true, stats });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error fetching stats');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { personId, status, priority } = req.query;
    
    const suggestions = await relationshipGraph.getSuggestions({
      personId: personId ? String(personId) : undefined,
      status: status as SuggestionStatus | undefined,
      priority: priority as SuggestionPriority | undefined,
    });
    
    res.json({ success: true, suggestions });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error fetching suggestions');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/suggestions/generate', async (req: Request, res: Response) => {
  try {
    const suggestions = await relationshipGraph.generateContactReminders();
    res.json({ success: true, suggestions, count: suggestions.length });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error generating suggestions');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.patch('/suggestions/:id/dismiss', async (req: Request, res: Response) => {
  try {
    await relationshipGraph.dismissSuggestion(req.params.id);
    res.json({ success: true, message: 'Suggestion dismissed' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error dismissing suggestion');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.patch('/suggestions/:id/complete', async (req: Request, res: Response) => {
  try {
    await relationshipGraph.completeSuggestion(req.params.id);
    res.json({ success: true, message: 'Suggestion completed' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error completing suggestion');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
