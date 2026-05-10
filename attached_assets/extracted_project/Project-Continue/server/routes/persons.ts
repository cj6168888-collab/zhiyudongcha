import type { Express } from "express";
import type { IStorage } from "../storage";
import { insertPersonSchema } from "@shared/schema";
import { requireMaster, auditAction } from "../middleware/auth";

export function registerPersonsRoutes(
  app: Express,
  storage: IStorage,
  broadcastDataChange: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: any) => void
) {
  app.get("/api/persons", async (req, res) => {
    try {
      const accessLevel = req.query.accessLevel as string | undefined;
      const persons = await storage.getAllPersons(accessLevel);
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch persons" });
    }
  });

  app.get("/api/persons/pending", async (req, res) => {
    try {
      const persons = await storage.getPersonsByApprovalStatus('PENDING');
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending persons" });
    }
  });

  app.get("/api/persons/search/weakness", async (req, res) => {
    try {
      const keyword = req.query.q as string;
      if (!keyword) {
        return res.status(400).json({ error: "Missing query parameter: q" });
      }
      const persons = await storage.searchPersonsByWeakness(keyword);
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to search persons" });
    }
  });

  app.get("/api/persons/insight/:name", async (req, res) => {
    try {
      const insight = await storage.getRelationshipInsight(req.params.name);
      if (!insight) {
        return res.status(404).json({ error: "Person not found for insight analysis" });
      }
      res.json(insight);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate relationship insight" });
    }
  });

  app.get("/api/persons/:id", async (req, res) => {
    try {
      const person = await storage.getPerson(req.params.id);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      res.json(person);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch person" });
    }
  });

  app.get("/api/persons/:id/conflicts", async (req, res) => {
    try {
      const conflicts = await storage.findConflictingRelationships(req.params.id);
      res.json(conflicts);
    } catch (error) {
      res.status(500).json({ error: "Failed to find conflicts" });
    }
  });

  app.post("/api/persons", async (req, res) => {
    try {
      const validated = insertPersonSchema.parse(req.body);
      const person = await storage.createPerson(validated);
      
      await storage.createMemory({
        context: `添加新联系人：${person.name}，角色：${person.role || '未知'}，组织：${person.organization || '未知'}`,
        choiceMade: 'CREATE_PERSON',
        field: 'relationship_management',
        expPoints: 5,
        mimicryWeight: 0.6,
      });
      
      broadcastDataChange('person', 'CREATE', { id: person.id, name: person.name });
      res.status(201).json(person);
    } catch (error) {
      res.status(400).json({ error: "Invalid person data", details: error });
    }
  });

  app.patch("/api/persons/:id", async (req, res) => {
    try {
      const person = await storage.updatePerson(req.params.id, req.body);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      broadcastDataChange('person', 'UPDATE', { id: person.id, name: person.name });
      res.json(person);
    } catch (error: any) {
      console.error('[Persons] Update failed:', error?.message || error);
      res.status(500).json({ error: "Failed to update person", details: error?.message });
    }
  });

  app.patch("/api/persons/:id/approval", requireMaster, async (req, res) => {
    try {
      const { approvalStatus } = req.body;
      if (!['CONFIRMED', 'ON_HOLD', 'DELETED', 'PENDING'].includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approval status" });
      }
      const person = await storage.updatePerson(req.params.id, { approvalStatus });
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      
      await storage.createMemory({
        context: `审批联系人${person.name}：${approvalStatus}`,
        choiceMade: `APPROVE_${approvalStatus}`,
        rejectedOptions: ['CONFIRMED', 'ON_HOLD', 'DELETED', 'PENDING'].filter(s => s !== approvalStatus),
        field: 'approval_decision',
        expPoints: 10,
        mimicryWeight: 0.8,
      });
      
      await auditAction('anchor_approval', req.userRole || 'MASTER', 'person', req.params.id, { newStatus: approvalStatus }, 'SUCCESS', req);
      broadcastDataChange('persons', 'UPDATE', { id: person.id, approvalStatus });
      res.json(person);
    } catch (error) {
      res.status(500).json({ error: "Failed to update person approval" });
    }
  });

  app.delete("/api/persons/:id", async (req, res) => {
    try {
      const success = await storage.deletePerson(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Person not found" });
      }
      broadcastDataChange('person', 'DELETE', { id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete person" });
    }
  });
}
