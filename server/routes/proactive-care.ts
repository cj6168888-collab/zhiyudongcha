import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ProactiveCare');

import { Router, Request, Response } from "express";
import { proactiveCareService } from "../services/proactive-care";
import { insertProactiveCareRuleSchema } from "@shared/schema";

const router = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

router.get("/rules", async (req: Request, res: Response) => {
  try {
    const enabledOnly = req.query.enabled === "true";
    const rules = await proactiveCareService.getRules(enabledOnly);
    res.json({ success: true, rules });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = await proactiveCareService.getRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, error: "规则不存在" });
    }
    res.json({ success: true, rule });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const parsed = insertProactiveCareRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }
    const rule = await proactiveCareService.createRule(parsed.data);
    res.json({ success: true, rule });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.put("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = await proactiveCareService.updateRule(req.params.id, req.body);
    if (!rule) {
      return res.status(404).json({ success: false, error: "规则不存在" });
    }
    res.json({ success: true, rule });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    await proactiveCareService.deleteRule(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/scan", async (req: Request, res: Response) => {
  try {
    const result = await proactiveCareService.runScan();
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get("/logs", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await proactiveCareService.getCareLogs(limit);
    res.json({ success: true, logs });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const notifications = await proactiveCareService.getPendingNotifications();
    res.json({ success: true, notifications });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/notifications/:id/sent", async (req: Request, res: Response) => {
  try {
    await proactiveCareService.markNotificationSent(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/notifications/:id/dismiss", async (req: Request, res: Response) => {
  try {
    await proactiveCareService.dismissNotification(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/logs/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const { response } = req.body;
    await proactiveCareService.acknowledgeLog(req.params.id, response || "ACKNOWLEDGED");
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/seed-defaults", async (req: Request, res: Response) => {
  try {
    await proactiveCareService.seedDefaultRules();
    res.json({ success: true, message: "默认规则已创建" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
