import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SceneRecognition');

import { Router, Request, Response } from "express";
import { sceneRecognitionService } from "../services/scene-recognition";
import { getErrorMessage } from '../lib/errors';

const router = Router();

router.get("/current", async (req: Request, res: Response) => {
  try {
    const current = await sceneRecognitionService.getCurrentScene();
    const sceneInfo = sceneRecognitionService.getSceneDescription(current.scene);
    const modeInfo = sceneRecognitionService.getModeDescription(current.mode);
    
    res.json({
      success: true,
      scene: {
        type: current.scene,
        ...sceneInfo,
      },
      mode: {
        type: current.mode,
        ...modeInfo,
      },
      confidence: current.confidence,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/detect", async (req: Request, res: Response) => {
  try {
    const { time, location, activity, manual } = req.body;
    
    const detection = await sceneRecognitionService.detectScene({
      time: time ? new Date(time) : undefined,
      location,
      activity,
      manual,
    });
    
    const log = await sceneRecognitionService.logSceneDetection({
      ...detection,
      triggerData: { time, location, activity },
    });
    
    res.json({
      success: true,
      detection: {
        scene: detection.scene,
        mode: detection.mode,
        confidence: detection.confidence,
        triggerType: detection.triggerType,
      },
      logId: log.id,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post("/apply-mode", async (req: Request, res: Response) => {
  try {
    const { scene, mode } = req.body;
    
    if (!scene || !mode) {
      return res.status(400).json({ success: false, error: "请提供场景和模式" });
    }
    
    const log = await sceneRecognitionService.logSceneDetection({
      scene,
      mode,
      confidence: 1.0,
      triggerType: "MANUAL",
      modeApplied: true,
    });
    
    res.json({
      success: true,
      message: `已切换到${sceneRecognitionService.getSceneDescription(scene).name} - ${sceneRecognitionService.getModeDescription(mode).name}`,
      logId: log.id,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const logs = await sceneRecognitionService.getRecentDetections(limit);
    res.json({ success: true, logs });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get("/modes", async (req: Request, res: Response) => {
  try {
    type ModeType = "FOCUS" | "CASUAL" | "SILENT" | "ASSISTANT" | "COMPANION";
    const modes = (["FOCUS", "CASUAL", "SILENT", "ASSISTANT", "COMPANION"] as const).map((mode: ModeType) => ({
      type: mode,
      ...sceneRecognitionService.getModeDescription(mode),
    }));
    res.json({ success: true, modes });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get("/scenes", async (req: Request, res: Response) => {
  try {
    type SceneType = "WORK" | "HOME" | "COMMUTE" | "MEETING" | "LEISURE" | "SLEEP" | "EXERCISE" | "DINING";
    const scenes = (["WORK", "HOME", "COMMUTE", "MEETING", "LEISURE", "SLEEP", "EXERCISE", "DINING"] as const).map((scene: SceneType) => ({
      type: scene,
      ...sceneRecognitionService.getSceneDescription(scene),
    }));
    res.json({ success: true, scenes });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
