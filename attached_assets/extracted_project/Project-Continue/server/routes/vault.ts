import type { Express } from "express";
import type { IStorage } from "../storage";
import { insertVaultItemSchema, insertShadowMemorySchema } from "@shared/schema";
import { requireMaster, auditAction } from "../middleware/auth";

export function registerVaultRoutes(
  app: Express,
  storage: IStorage,
  broadcastDataChange: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: any) => void
) {
  // ===== Z2: Vault (Resource Vault) Routes =====

  app.get("/api/vault", async (req, res) => {
    try {
      const zone = req.query.zone as string | undefined;
      const items = await storage.getAllVaultItems(zone);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault items" });
    }
  });

  app.get("/api/vault/:id", async (req, res) => {
    try {
      const item = await storage.getVaultItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Vault item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault item" });
    }
  });

  app.post("/api/vault", async (req, res) => {
    try {
      const validated = insertVaultItemSchema.parse(req.body);
      const item = await storage.createVaultItem(validated);
      broadcastDataChange('vault', 'CREATE', { id: item.id, fileName: item.fileName });
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid vault item data", details: error });
    }
  });

  app.patch("/api/vault/:id", async (req, res) => {
    try {
      const item = await storage.updateVaultItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Vault item not found" });
      }
      broadcastDataChange('vault', 'UPDATE', { id: item.id, fileName: item.fileName });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vault item" });
    }
  });

  app.delete("/api/vault/:id", async (req, res) => {
    try {
      const success = await storage.deleteVaultItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Vault item not found" });
      }
      broadcastDataChange('vault', 'DELETE', { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vault item" });
    }
  });

  app.get("/api/vault/search/semantic", async (req, res) => {
    try {
      const tag = req.query.tag as string;
      if (!tag) {
        return res.status(400).json({ error: "Missing query parameter: tag" });
      }
      const items = await storage.searchVaultBySemanticTag(tag);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to search vault" });
    }
  });

  app.get("/api/vault/search/intent", async (req, res) => {
    try {
      const intent = req.query.q as string;
      if (!intent) {
        return res.status(400).json({ error: "Missing query parameter: q" });
      }
      const items = await storage.searchVaultByIntent(intent);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to search vault by intent" });
    }
  });

  app.post("/api/shred", requireMaster, async (req, res) => {
    try {
      const { targetId, table } = req.body;
      
      if (!targetId || !table) {
        return res.status(400).json({ error: "Missing targetId or table parameter" });
      }
      
      if (table !== 'vault' && table !== 'person') {
        return res.status(400).json({ error: "Table must be 'vault' or 'person'" });
      }

      await auditAction('SHRED_INITIATED', req.userRole || 'MASTER', table, targetId, { table }, 'SUCCESS', req);
      
      const result = await storage.permanentShred(targetId, table);
      
      if (result.success) {
        await auditAction('SHRED_COMPLETE', req.userRole || 'MASTER', table, targetId, result, 'SUCCESS', req);
        res.json(result);
      } else {
        await auditAction('SHRED_FAILED', req.userRole || 'MASTER', table, targetId, result, 'FAILED', req);
        res.status(404).json(result);
      }
    } catch (error) {
      await auditAction('SHRED_ERROR', req.userRole || 'MASTER', 'unknown', req.body.targetId, { error: String(error) }, 'FAILED', req);
      res.status(500).json({ error: "Shredding operation failed" });
    }
  });

  // ===== Z2: Shadow Memory Routes =====

  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await storage.getAllMemories();
      res.json(memories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch memories" });
    }
  });

  app.get("/api/shadow-memory", async (req, res) => {
    try {
      const memories = await storage.getAllMemories();
      res.json(memories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shadow memories" });
    }
  });

  app.post("/api/memories", async (req, res) => {
    try {
      const validated = insertShadowMemorySchema.parse(req.body);
      const memory = await storage.createMemory(validated);
      res.status(201).json(memory);
    } catch (error) {
      res.status(400).json({ error: "Invalid memory data", details: error });
    }
  });
}
