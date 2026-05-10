import type { Express } from "express";
import type { IStorage } from "../storage";
import type { RegisterRouteFn } from "./types";
import {
  detectWakeWord,
  setUserWakeConfig,
  getUserWakeConfig,
  addWakeWord,
  removeWakeWord,
  setPrimaryWakeWord,
  validateWakeWord,
  getDefaultWakeWords,
  loadConfigFromDB,
} from "../services/wake-word";
import {
  getVoiceProfiles,
  getVoiceById,
  getVoicesByGender,
  getVoicesByAge,
  getRecommendedVoice,
  synthesizeSpeech,
  setUserVoiceSettings,
  getUserVoiceSettings,
  getVoicePreview,
  formatTextForSpeech,
} from "../services/voice-synthesis";

export const registerVoiceRoutes: RegisterRouteFn = (app, storage, context) => {
  // ===== Z1: Wake Word (唤醒词配置) =====
  
  app.post("/api/wake/detect", async (req, res) => {
    try {
      const { text, userId = 'default' } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "缺少文本内容 (text)" });
      }
      
      const result = detectWakeWord(text, userId);
      
      res.json({
        ...result,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Wake Word] Detect error:', error);
      res.status(500).json({ error: "唤醒词检测失败" });
    }
  });

  app.get("/api/wake/config/:userId", async (req, res) => {
    try {
      const dbSettings = await storage.getUserSettings(req.params.userId);
      
      if (dbSettings) {
        loadConfigFromDB({
          userId: dbSettings.userId,
          wakeWords: dbSettings.wakeWords,
          primaryWakeWord: dbSettings.primaryWakeWord,
          wakeWordSensitivity: dbSettings.wakeWordSensitivity,
        });
      }
      
      const config = getUserWakeConfig(req.params.userId);
      
      if (!config) {
        return res.json({
          userId: req.params.userId,
          wakeWords: getDefaultWakeWords(),
          primaryWakeWord: '小智',
          sensitivity: 0.8,
          isDefault: true,
        });
      }
      
      res.json({ ...config, isDefault: false });
    } catch (error) {
      res.status(500).json({ error: "获取唤醒词配置失败" });
    }
  });

  app.post("/api/wake/register", async (req, res) => {
    try {
      const { userId, wakeWords, primaryWakeWord, sensitivity } = req.body;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "缺少用户ID (userId)" });
      }
      
      const wordsToSet = wakeWords || getDefaultWakeWords();
      
      for (const word of wordsToSet) {
        const validation = validateWakeWord(word);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: `唤醒词「${word}」无效: ${validation.reason}` 
          });
        }
      }
      
      const config = setUserWakeConfig(userId, wordsToSet, primaryWakeWord, sensitivity);
      
      const existing = await storage.getUserSettings(userId);
      if (existing) {
        await storage.updateUserSettings(userId, {
          wakeWords: wordsToSet,
          primaryWakeWord: primaryWakeWord || wordsToSet[0],
          wakeWordSensitivity: sensitivity || 0.8,
        });
      } else {
        await storage.createUserSettings({
          userId,
          wakeWords: wordsToSet,
          primaryWakeWord: primaryWakeWord || wordsToSet[0],
          wakeWordSensitivity: sensitivity || 0.8,
        });
      }
      
      res.status(201).json({
        success: true,
        message: `唤醒词配置已保存，主唤醒词: ${config.primaryWakeWord}`,
        config,
      });
    } catch (error) {
      console.error('[Wake Word] Register error:', error);
      res.status(500).json({ error: "唤醒词注册失败" });
    }
  });

  app.post("/api/wake/add", async (req, res) => {
    try {
      const { userId, wakeWord } = req.body;
      
      if (!userId || !wakeWord) {
        return res.status(400).json({ error: "缺少 userId 或 wakeWord" });
      }
      
      const validation = validateWakeWord(wakeWord);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.reason });
      }
      
      const config = addWakeWord(userId, wakeWord);
      
      await storage.updateUserSettings(userId, {
        wakeWords: config.wakeWords,
      });
      
      res.json({
        success: true,
        message: `已添加唤醒词「${wakeWord}」`,
        config,
      });
    } catch (error) {
      res.status(500).json({ error: "添加唤醒词失败" });
    }
  });

  app.post("/api/wake/remove", async (req, res) => {
    try {
      const { userId, wakeWord } = req.body;
      
      if (!userId || !wakeWord) {
        return res.status(400).json({ error: "缺少 userId 或 wakeWord" });
      }
      
      const config = removeWakeWord(userId, wakeWord);
      
      if (config) {
        await storage.updateUserSettings(userId, {
          wakeWords: config.wakeWords,
          primaryWakeWord: config.primaryWakeWord,
        });
      }
      
      res.json({
        success: true,
        message: `已移除唤醒词「${wakeWord}」`,
        config,
      });
    } catch (error) {
      res.status(500).json({ error: "移除唤醒词失败" });
    }
  });

  app.post("/api/wake/primary", async (req, res) => {
    try {
      const { userId, wakeWord } = req.body;
      
      if (!userId || !wakeWord) {
        return res.status(400).json({ error: "缺少 userId 或 wakeWord" });
      }
      
      const validation = validateWakeWord(wakeWord);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.reason });
      }
      
      const config = setPrimaryWakeWord(userId, wakeWord);
      
      if (config) {
        await storage.updateUserSettings(userId, {
          wakeWords: config.wakeWords,
          primaryWakeWord: config.primaryWakeWord,
        });
      }
      
      res.json({
        success: true,
        message: `主唤醒词已设为「${wakeWord}」`,
        config,
      });
    } catch (error) {
      res.status(500).json({ error: "设置主唤醒词失败" });
    }
  });

  app.post("/api/wake/validate", async (req, res) => {
    try {
      const { wakeWord } = req.body;
      
      if (!wakeWord) {
        return res.status(400).json({ error: "缺少 wakeWord" });
      }
      
      const result = validateWakeWord(wakeWord);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "验证失败" });
    }
  });

  app.get("/api/wake/defaults", async (req, res) => {
    try {
      res.json({
        defaultWakeWords: getDefaultWakeWords(),
        defaultSensitivity: 0.8,
      });
    } catch (error) {
      res.status(500).json({ error: "获取默认配置失败" });
    }
  });

  // ===== User Settings Routes =====
  
  app.get("/api/settings/:userId", async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.params.userId);
      
      if (!settings) {
        return res.status(404).json({ error: "用户设置不存在", userId: req.params.userId });
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "获取用户设置失败" });
    }
  });

  app.patch("/api/settings/:userId", async (req, res) => {
    try {
      const settings = await storage.updateUserSettings(req.params.userId, req.body);
      
      if (!settings) {
        return res.status(404).json({ error: "用户设置不存在" });
      }
      
      if (req.body.wakeWords || req.body.primaryWakeWord || req.body.wakeWordSensitivity) {
        loadConfigFromDB({
          userId: settings.userId,
          wakeWords: settings.wakeWords,
          primaryWakeWord: settings.primaryWakeWord,
          wakeWordSensitivity: settings.wakeWordSensitivity,
        });
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "更新用户设置失败" });
    }
  });

  // ===== Z5: Voice Synthesis (语音合成服务) =====
  
  app.get("/api/voice/profiles", async (req, res) => {
    try {
      const profiles = getVoiceProfiles();
      res.json({
        profiles,
        count: profiles.length,
        categories: {
          female: profiles.filter(p => p.gender === 'female').length,
          male: profiles.filter(p => p.gender === 'male').length,
          child: profiles.filter(p => p.gender === 'child').length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "获取音色列表失败" });
    }
  });

  app.get("/api/voice/profile/:voiceId", async (req, res) => {
    try {
      const profile = getVoiceById(req.params.voiceId);
      if (!profile) {
        return res.status(404).json({ error: "音色不存在", voiceId: req.params.voiceId });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "获取音色详情失败" });
    }
  });

  app.get("/api/voice/filter", async (req, res) => {
    try {
      const { gender, age } = req.query;
      
      let profiles = getVoiceProfiles();
      
      if (gender) {
        profiles = getVoicesByGender(gender as 'male' | 'female' | 'child');
      }
      
      if (age) {
        profiles = profiles.filter(p => p.age === age);
      }
      
      res.json({ profiles, count: profiles.length });
    } catch (error) {
      res.status(500).json({ error: "筛选音色失败" });
    }
  });

  app.get("/api/voice/recommend", async (req, res) => {
    try {
      const { personality } = req.query;
      const recommended = getRecommendedVoice(personality as string);
      res.json(recommended);
    } catch (error) {
      res.status(500).json({ error: "获取推荐音色失败" });
    }
  });

  app.post("/api/voice/synthesize", async (req, res) => {
    try {
      const { text, voice, rate, pitch, volume, format } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "缺少合成文本 (text)" });
      }
      
      const cleanText = formatTextForSpeech(text);
      
      const result = await synthesizeSpeech(cleanText, {
        voice: voice || 'longanhuan',
        rate,
        pitch,
        volume,
        format,
      });
      
      res.json(result);
    } catch (error) {
      console.error('[Voice] Synthesize error:', error);
      res.status(500).json({ error: "语音合成失败" });
    }
  });

  app.get("/api/voice/preview/:voiceId", async (req, res) => {
    try {
      const previewText = getVoicePreview(req.params.voiceId);
      const profile = getVoiceById(req.params.voiceId);
      
      res.json({
        voiceId: req.params.voiceId,
        profile,
        previewText,
        message: '调用 /api/voice/synthesize 可生成试听音频',
      });
    } catch (error) {
      res.status(500).json({ error: "获取预览失败" });
    }
  });

  app.get("/api/voice/settings/:userId", async (req, res) => {
    try {
      const settings = getUserVoiceSettings(req.params.userId);
      const profile = getVoiceById(settings.voiceId);
      res.json({ ...settings, profile });
    } catch (error) {
      res.status(500).json({ error: "获取语音设置失败" });
    }
  });

  app.patch("/api/voice/settings/:userId", async (req, res) => {
    try {
      const { voiceId, rate, pitch, volume, emotion } = req.body;
      
      if (voiceId) {
        const profile = getVoiceById(voiceId);
        if (!profile) {
          return res.status(400).json({ error: `音色 ${voiceId} 不存在` });
        }
      }
      
      const settings = setUserVoiceSettings(req.params.userId, {
        voiceId,
        rate,
        pitch,
        volume,
        emotion,
      });
      
      const profile = getVoiceById(settings.voiceId);
      
      res.json({
        success: true,
        message: `语音设置已更新${voiceId ? `，音色: ${profile?.name}` : ''}`,
        settings: { ...settings, profile },
      });
    } catch (error) {
      res.status(500).json({ error: "更新语音设置失败" });
    }
  });

  // ===== Avatar Speak Route =====
  
  app.post("/api/avatar/speak", async (req, res) => {
    try {
      const { text, userId = 'default' } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "缺少文本内容 (text)" });
      }
      
      const voiceSettings = getUserVoiceSettings(userId);
      const cleanText = formatTextForSpeech(text);
      
      const result = await synthesizeSpeech(cleanText, {
        voice: voiceSettings.voiceId,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch,
        volume: voiceSettings.volume,
      });
      
      const profile = getVoiceById(voiceSettings.voiceId);
      
      res.json({
        ...result,
        voiceName: profile?.name,
        voicePersonality: profile?.personality,
        originalText: text,
        processedText: cleanText,
      });
    } catch (error) {
      console.error('[Avatar] Speak error:', error);
      res.status(500).json({ error: "语音合成失败" });
    }
  });
};
