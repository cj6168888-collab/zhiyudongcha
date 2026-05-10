import type { Express } from "express";
import type { IStorage } from "../storage";
import type { RouteContext } from "./types";
import { createServiceLogger } from '../lib/logger';
import { attachRole, requireMaster } from "../middleware/auth";

const logger = createServiceLogger('BiometricsRoutes');

export function registerBiometricsRoutes(
  app: Express,
  _storage: IStorage,
  _context: RouteContext
): void {

  app.get("/api/contacts/biometrics", attachRole, requireMaster, async (req, res) => {
    try {
      const { contactRecognitionService } = await import('../services/contact-recognition');
      const contacts = await contactRecognitionService.getEnrolledContacts();
      res.json({ 
        success: true, 
        contacts,
        total: contacts.length
      });
    } catch (error) {
      logger.error({ err: error }, '[ContactRecognition] List error');
      res.status(500).json({ error: "获取联系人特征列表失败" });
    }
  });

  app.post("/api/contacts/biometrics/enroll/face", attachRole, requireMaster, async (req, res) => {
    try {
      const { personId, imageBase64, notes } = req.body;
      
      if (!personId || !imageBase64) {
        return res.status(400).json({ 
          error: "请提供联系人ID和人脸照片",
          hint: { personId: "联系人ID", imageBase64: "Base64格式的照片" }
        });
      }
      
      if (imageBase64.length > 7 * 1024 * 1024) {
        return res.status(400).json({ error: "图片过大，请使用小于5MB的照片" });
      }

      const { contactRecognitionService } = await import('../services/contact-recognition');
      const result = await contactRecognitionService.enrollFace(personId, imageBase64, notes);
      
      if (result.success) {
        res.json({
          success: true,
          message: `已为 ${result.personName} 录入人脸特征`,
          biometricId: result.biometricId,
          qualityScore: result.qualityScore
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error({ err: error }, '[ContactRecognition] Enroll face error');
      res.status(500).json({ error: "录入联系人人脸失败" });
    }
  });

  app.post("/api/contacts/biometrics/recognize/face", attachRole, requireMaster, async (req, res) => {
    try {
      const { imageBase64, threshold } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ 
          error: "请提供需要识别的人脸照片",
          hint: { imageBase64: "Base64格式的照片", threshold: "可选，匹配阈值0-100，默认60" }
        });
      }

      const { contactRecognitionService } = await import('../services/contact-recognition');
      const result = await contactRecognitionService.recognizeFace(
        imageBase64, 
        typeof threshold === 'number' ? threshold : 60
      );
      
      res.json({
        success: result.success,
        matches: result.matches,
        topMatch: result.matches[0] || null,
        totalCompared: result.totalCompared,
        processingTimeMs: result.processingTimeMs,
        message: result.matches.length > 0 
          ? `识别到 ${result.matches.length} 位可能的联系人`
          : '未能识别出匹配的联系人'
      });
    } catch (error) {
      logger.error({ err: error }, '[ContactRecognition] Recognize face error');
      res.status(500).json({ error: "人脸识别失败" });
    }
  });

  app.delete("/api/contacts/biometrics/:biometricId", attachRole, requireMaster, async (req, res) => {
    try {
      const { biometricId } = req.params;
      
      const { contactRecognitionService } = await import('../services/contact-recognition');
      const success = await contactRecognitionService.deleteBiometric(biometricId);
      
      if (success) {
        res.json({ success: true, message: "已删除该生物特征记录" });
      } else {
        res.status(400).json({ success: false, error: "删除失败" });
      }
    } catch (error) {
      logger.error({ err: error }, '[ContactRecognition] Delete error');
      res.status(500).json({ error: "删除生物特征失败" });
    }
  });

  app.post("/api/contacts/biometrics/refresh-cache", attachRole, requireMaster, async (req, res) => {
    try {
      const { contactRecognitionService } = await import('../services/contact-recognition');
      await contactRecognitionService.refreshCache();
      res.json({ success: true, message: "缓存已刷新" });
    } catch (error) {
      logger.error({ err: error }, '[ContactRecognition] Refresh cache error');
      res.status(500).json({ error: "刷新缓存失败" });
    }
  });

  logger.info('[Biometrics] Routes registered at /api/contacts/biometrics/*');
}
