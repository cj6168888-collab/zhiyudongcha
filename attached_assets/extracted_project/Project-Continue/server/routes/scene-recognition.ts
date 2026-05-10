import { Router, Request, Response } from "express";
import { sceneRecognitionService } from "../services/scene-recognition";

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const logs = await sceneRecognitionService.getRecentDetections(limit);
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/modes", async (req: Request, res: Response) => {
  try {
    const modes = ["FOCUS", "CASUAL", "SILENT", "ASSISTANT", "COMPANION"].map((mode) => ({
      type: mode,
      ...sceneRecognitionService.getModeDescription(mode as any),
    }));
    res.json({ success: true, modes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/scenes", async (req: Request, res: Response) => {
  try {
    const scenes = ["WORK", "HOME", "COMMUTE", "MEETING", "LEISURE", "SLEEP", "EXERCISE", "DINING"].map((scene) => ({
      type: scene,
      ...sceneRecognitionService.getSceneDescription(scene as any),
    }));
    res.json({ success: true, scenes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
