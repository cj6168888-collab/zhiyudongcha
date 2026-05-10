import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SceneRecognition');

import { getDatabase } from "../db";
import {
  sceneRecognitionLogs,
  type SceneRecognitionLog,
  type InsertSceneRecognitionLog,
} from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export type SceneType = "WORK" | "HOME" | "COMMUTE" | "MEETING" | "LEISURE" | "SLEEP" | "EXERCISE" | "DINING";
export type InteractionMode = "FOCUS" | "CASUAL" | "SILENT" | "ASSISTANT" | "COMPANION";

interface TimePattern {
  start: number;
  end: number;
  scene: SceneType;
  mode: InteractionMode;
}

interface LocationContext {
  latitude?: number;
  longitude?: number;
  placeName?: string;
  placeType?: string;
}

interface ActivityContext {
  isMoving?: boolean;
  speed?: number;
  activity?: string;
}

export class SceneRecognitionService {
  private timePatterns: TimePattern[] = [
    { start: 0, end: 6, scene: "SLEEP", mode: "SILENT" },
    { start: 6, end: 8, scene: "HOME", mode: "COMPANION" },
    { start: 8, end: 9, scene: "COMMUTE", mode: "ASSISTANT" },
    { start: 9, end: 12, scene: "WORK", mode: "FOCUS" },
    { start: 12, end: 13, scene: "DINING", mode: "CASUAL" },
    { start: 13, end: 18, scene: "WORK", mode: "FOCUS" },
    { start: 18, end: 19, scene: "COMMUTE", mode: "ASSISTANT" },
    { start: 19, end: 21, scene: "HOME", mode: "CASUAL" },
    { start: 21, end: 23, scene: "LEISURE", mode: "COMPANION" },
    { start: 23, end: 24, scene: "SLEEP", mode: "SILENT" },
  ];

  async detectScene(context?: {
    time?: Date;
    location?: LocationContext;
    activity?: ActivityContext;
    manual?: SceneType;
  }): Promise<{ scene: SceneType; mode: InteractionMode; confidence: number; triggerType: string }> {
    const now = context?.time || new Date();
    const hour = now.getHours();

    if (context?.manual) {
      return {
        scene: context.manual,
        mode: this.getDefaultModeForScene(context.manual),
        confidence: 1.0,
        triggerType: "MANUAL",
      };
    }

    if (context?.activity?.isMoving && context.activity.speed && context.activity.speed > 5) {
      return {
        scene: "COMMUTE",
        mode: "ASSISTANT",
        confidence: 0.8,
        triggerType: "ACTIVITY",
      };
    }

    if (context?.location?.placeType) {
      const placeScene = this.mapPlaceTypeToScene(context.location.placeType);
      if (placeScene) {
        return {
          scene: placeScene,
          mode: this.getDefaultModeForScene(placeScene),
          confidence: 0.85,
          triggerType: "LOCATION",
        };
      }
    }

    const timePattern = this.timePatterns.find((p) => hour >= p.start && hour < p.end);
    if (timePattern) {
      return {
        scene: timePattern.scene,
        mode: timePattern.mode,
        confidence: 0.7,
        triggerType: "TIME",
      };
    }

    return {
      scene: "HOME",
      mode: "CASUAL",
      confidence: 0.5,
      triggerType: "DEFAULT",
    };
  }

  private mapPlaceTypeToScene(placeType: string): SceneType | null {
    const mapping: Record<string, SceneType> = {
      office: "WORK",
      workplace: "WORK",
      home: "HOME",
      residence: "HOME",
      restaurant: "DINING",
      cafe: "DINING",
      gym: "EXERCISE",
      park: "LEISURE",
      mall: "LEISURE",
      hospital: "WORK",
      school: "WORK",
      airport: "COMMUTE",
      station: "COMMUTE",
    };
    return mapping[placeType.toLowerCase()] || null;
  }

  private getDefaultModeForScene(scene: SceneType): InteractionMode {
    const mapping: Record<SceneType, InteractionMode> = {
      WORK: "FOCUS",
      HOME: "CASUAL",
      COMMUTE: "ASSISTANT",
      MEETING: "SILENT",
      LEISURE: "COMPANION",
      SLEEP: "SILENT",
      EXERCISE: "COMPANION",
      DINING: "CASUAL",
    };
    return mapping[scene] || "CASUAL";
  }

  async logSceneDetection(detection: {
    scene: SceneType;
    mode: InteractionMode;
    confidence: number;
    triggerType: string;
    triggerData?: Record<string, unknown>;
    modeApplied?: boolean;
  }): Promise<SceneRecognitionLog> {
    const [log] = await getDatabase().insert(sceneRecognitionLogs).values({
      detectedScene: detection.scene,
      confidence: detection.confidence,
      triggerType: detection.triggerType,
      triggerData: detection.triggerData,
      suggestedMode: detection.mode,
      modeApplied: detection.modeApplied || false,
    }).returning();
    return log;
  }

  async getRecentDetections(limit = 20): Promise<SceneRecognitionLog[]> {
    return getDatabase().select()
      .from(sceneRecognitionLogs)
      .orderBy(desc(sceneRecognitionLogs.createdAt))
      .limit(limit);
  }

  async getCurrentScene(): Promise<{ scene: SceneType; mode: InteractionMode; confidence: number }> {
    const detection = await this.detectScene();
    return {
      scene: detection.scene,
      mode: detection.mode,
      confidence: detection.confidence,
    };
  }

  getModeDescription(mode: InteractionMode): { name: string; description: string; behaviors: string[] } {
    const descriptions: Record<InteractionMode, { name: string; description: string; behaviors: string[] }> = {
      FOCUS: {
        name: "专注模式",
        description: "减少干扰，只在重要事项时提醒",
        behaviors: ["静音非紧急通知", "延迟非关键提醒", "简洁回复"],
      },
      CASUAL: {
        name: "休闲模式",
        description: "轻松对话，可以闲聊",
        behaviors: ["正常通知", "可以闲聊", "推荐娱乐内容"],
      },
      SILENT: {
        name: "静默模式",
        description: "完全静音，紧急情况除外",
        behaviors: ["静音所有通知", "只处理紧急事项", "不主动打扰"],
      },
      ASSISTANT: {
        name: "助手模式",
        description: "高效辅助，快速响应",
        behaviors: ["快速回复", "提供实时信息", "主动提供帮助"],
      },
      COMPANION: {
        name: "陪伴模式",
        description: "情感陪伴，关心用户",
        behaviors: ["主动关怀", "情感支持", "温馨对话"],
      },
    };
    return descriptions[mode] || descriptions.CASUAL;
  }

  getSceneDescription(scene: SceneType): { name: string; icon: string } {
    const descriptions: Record<SceneType, { name: string; icon: string }> = {
      WORK: { name: "工作中", icon: "💼" },
      HOME: { name: "在家", icon: "🏠" },
      COMMUTE: { name: "通勤中", icon: "🚗" },
      MEETING: { name: "会议中", icon: "👥" },
      LEISURE: { name: "休闲", icon: "🎮" },
      SLEEP: { name: "睡眠时间", icon: "😴" },
      EXERCISE: { name: "运动中", icon: "🏃" },
      DINING: { name: "用餐中", icon: "🍽️" },
    };
    return descriptions[scene] || { name: scene, icon: "📍" };
  }
}

export const sceneRecognitionService = new SceneRecognitionService();
