import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Vault');

import type { Express } from "express";
import type { IStorage } from "../storage";
import { insertVaultItemSchema, insertShadowMemorySchema } from "@shared/schema";
import { requireMaster, auditAction } from "../middleware/auth";
import { requireResourceGrant } from "../middleware/authorization";
import { vaultService } from '../services/VaultService';
import { memoryService } from '../services/MemoryService';

export function registerVaultRoutes(
  app: Express,
  storage: IStorage,
  broadcastDataChange: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void
) {
  // ===== Z2: Vault (Resource Vault) Routes =====

  app.get("/api/vault", requireResourceGrant("VAULT", "READ"), async (req, res) => {
    try {
      const zone = req.query.zone as string | undefined;
      const items = await vaultService.getAllVaultItems(zone);
      res.json({ success: true, data: items });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch vault items');
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "Failed to fetch vault items" }
      });
    }
  });

  app.get("/api/vault/:id", requireResourceGrant("VAULT", "READ"), async (req, res) => {
    try {
      const item = await vaultService.getVaultItem(req.params.id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "Vault item not found" }
        });
      }
      return res.json({ success: true, data: item });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch vault item');
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "Failed to fetch vault item" }
      });
    }
  });

  app.post("/api/vault", requireResourceGrant("VAULT", "WRITE"), async (req, res) => {
    try {
      const validated = insertVaultItemSchema.parse(req.body);
      const item = await vaultService.createVaultItem(validated, {
        broadcastDataChange,
      });
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      logger.error({ err: error }, 'Invalid vault item data');
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: "Invalid vault item data" }
      });
    }
  });

  app.patch("/api/vault/:id", requireResourceGrant("VAULT", "WRITE"), async (req, res) => {
    try {
      const item = await vaultService.updateVaultItem(req.params.id, req.body, {
        broadcastDataChange,
      });
      if (!item) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "Vault item not found" }
        });
      }
      return res.json({ success: true, data: item });
    } catch (error) {
      logger.error({ err: error }, 'Failed to update vault item');
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ERROR', message: "Failed to update vault item" }
      });
    }
  });

  app.delete("/api/vault/:id", requireResourceGrant("VAULT", "DELETE"), async (req, res) => {
    try {
      const success = await vaultService.deleteVaultItem(req.params.id, {
        broadcastDataChange,
      });
      if (!success) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "Vault item not found" }
        });
      }
      return res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'Failed to delete vault item');
      return res.status(500).json({
        success: false,
        error: { code: 'DELETE_ERROR', message: "Failed to delete vault item" }
      });
    }
  });

  app.get("/api/vault/search/semantic", requireResourceGrant("VAULT", "READ"), async (req, res) => {
    try {
      const tag = req.query.tag as string;
      if (!tag) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: "Missing query parameter: tag" }
        });
      }
      const items = await vaultService.searchVaultBySemanticTag(tag);
      return res.json({ success: true, data: items });
    } catch (error) {
      logger.error({ err: error }, 'Failed to search vault');
      return res.status(500).json({
        success: false,
        error: { code: 'SEARCH_ERROR', message: "Failed to search vault" }
      });
    }
  });

  app.get("/api/vault/search/intent", requireResourceGrant("VAULT", "READ"), async (req, res) => {
    try {
      const intent = req.query.q as string;
      if (!intent) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: "Missing query parameter: q" }
        });
      }
      const items = await vaultService.searchVaultByIntent(intent);
      return res.json({ success: true, data: items });
    } catch (error) {
      logger.error({ err: error }, 'Failed to search vault by intent');
      return res.status(500).json({
        success: false,
        error: { code: 'SEARCH_ERROR', message: "Failed to search vault by intent" }
      });
    }
  });

  app.post("/api/shred", requireMaster, async (req, res) => {
    try {
      const { targetId, table } = req.body;

      if (!targetId || !table) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: "Missing targetId or table parameter" }
        });
      }

      if (table !== 'vault' && table !== 'person') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: "Table must be 'vault' or 'person'" }
        });
      }

      await auditAction('SHRED_INITIATED', req.userRole || 'MASTER', table, targetId, { table }, 'SUCCESS', req);

      const result = await vaultService.permanentShred(targetId, table, {
        userRole: req.userRole || 'MASTER',
        request: req,
        auditAction: auditAction as string,
      });

      if (result.success) {
        return res.json({ success: true, data: result });
      } else {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: result.error || "Item not found" }
        });
      }
    } catch (error) {
      await auditAction('SHRED_ERROR', req.userRole || 'MASTER', 'unknown', req.body.targetId, { error: String(error) }, 'FAILED', req);
      logger.error({ err: error }, 'Shredding operation failed');
      return res.status(500).json({
        success: false,
        error: { code: 'SHRED_ERROR', message: "Shredding operation failed" }
      });
    }
  });

  // ===== Z2: Shadow Memory Routes =====

  app.get("/api/memories", requireResourceGrant("MEMORY", "READ"), async (req, res) => {
    try {
      const memories = await memoryService.getAllMemories();
      return res.json({ success: true, data: memories });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch memories');
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "Failed to fetch memories" }
      });
    }
  });

  app.get("/api/shadow-memory", requireResourceGrant("MEMORY", "READ"), async (req, res) => {
    try {
      const memories = await memoryService.getAllMemories();
      return res.json({ success: true, data: memories });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch shadow memories');
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "Failed to fetch shadow memories" }
      });
    }
  });

  app.post("/api/memories", requireResourceGrant("MEMORY", "WRITE"), async (req, res) => {
    try {
      const validated = insertShadowMemorySchema.parse(req.body);
      const memory = await memoryService.createMemory(validated);
      return res.status(201).json({ success: true, data: memory });
    } catch (error) {
      logger.error({ err: error }, 'Invalid memory data');
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: "Invalid memory data" }
      });
    }
  });
}
