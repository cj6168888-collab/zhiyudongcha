import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Persons');

import type { Express } from "express";
import type { IStorage } from "../storage";
import { insertPersonSchema } from "@shared/schema";
import { requireMaster, auditAction } from "../middleware/auth";
import { getErrorMessage } from '../lib/errors';
import { personService } from '../services/PersonService';

export function registerPersonsRoutes(
  app: Express,
  storage: IStorage,
  broadcastDataChange: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void
) {
  app.get("/api/persons", async (req, res) => {
    try {
      const accessLevel = req.query.accessLevel as string | undefined;
      const persons = await personService.getAllPersons(accessLevel);
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch persons" });
    }
  });

  app.get("/api/persons/pending", async (req, res) => {
    try {
      const persons = await personService.getPersonsByApprovalStatus('PENDING');
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
      const persons = await personService.searchPersonsByWeakness(keyword);
      res.json(persons);
    } catch (error) {
      res.status(500).json({ error: "Failed to search persons" });
    }
  });

  app.get("/api/persons/insight/:name", async (req, res) => {
    try {
      const insight = await personService.getRelationshipInsight(req.params.name);
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
      const person = await personService.getPerson(req.params.id);
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
      const conflicts = await personService.findConflictingRelationships(req.params.id);
      res.json(conflicts);
    } catch (error) {
      res.status(500).json({ error: "Failed to find conflicts" });
    }
  });

  app.post("/api/persons", async (req, res) => {
    try {
      const validated = insertPersonSchema.parse(req.body);
      const person = await personService.createPerson(validated, {
        broadcastDataChange,
        createMemory: true,
      });
      res.status(201).json(person);
    } catch (error) {
      res.status(400).json({ error: "Invalid person data", details: error });
    }
  });

  app.patch("/api/persons/:id", async (req, res) => {
    try {
      const person = await personService.updatePerson(req.params.id, req.body, {
        broadcastDataChange,
      });
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      res.json(person);
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error) }, 'Update failed');
      res.status(500).json({ error: "Failed to update person", details: getErrorMessage(error) });
    }
  });

  app.patch("/api/persons/:id/approval", requireMaster, async (req, res) => {
    try {
      const { approvalStatus } = req.body;
      if (!['CONFIRMED', 'ON_HOLD', 'DELETED', 'PENDING'].includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approval status" });
      }
      const person = await personService.updatePersonApproval(req.params.id, approvalStatus, {
        userRole: req.userRole || 'MASTER',
        request: req,
        auditAction: auditAction as string,
        broadcastDataChange,
        createMemory: true,
      });
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      res.json(person);
    } catch (error) {
      res.status(500).json({ error: "Failed to update person approval" });
    }
  });

  app.delete("/api/persons/:id", async (req, res) => {
    try {
      const success = await personService.deletePerson(req.params.id, {
        broadcastDataChange,
      });
      if (!success) {
        return res.status(404).json({ error: "Person not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete person" });
    }
  });
}
