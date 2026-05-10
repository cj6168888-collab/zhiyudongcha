import { Router } from "express";
import { z } from "zod";
import { tidyingOrchestrator, type TidyingReport, type TidyingPlan } from "../services/tidying-up";
import { fileScanner, type ScanRequest } from "../services/tidying-up/file-scanner";
import { suggestBatchRenames, suggestSemanticRename } from "../services/tidying-up/rename-engine";
import { semanticAnalyzer } from "../services/tidying-up/semantic-analyzer";
import { desktopAnalyzer } from "../services/tidying-up/desktop-analyzer";
import { dedupEngine } from "../services/tidying-up/dedup-engine";
import { hotColdSeparator } from "../services/tidying-up/hot-cold-separator";
import { instantRetrieval } from "../services/tidying-up/instant-retrieval";
import type { FileMetadata } from "../services/tidying-up/types";

const router = Router();

const scanRequestSchema = z.object({
  deviceId: z.string(),
  scanPath: z.string(),
  files: z.array(z.object({
    fileName: z.string(),
    filePath: z.string(),
    fileSize: z.number(),
    createdAt: z.string(),
    modifiedAt: z.string(),
    accessedAt: z.string(),
    fileHash: z.string().optional(),
  })),
});

router.post("/scan/start", async (req, res) => {
  try {
    const { deviceId, scanPath } = z.object({
      deviceId: z.string(),
      scanPath: z.string(),
    }).parse(req.body);
    
    const taskId = await tidyingOrchestrator.createScanTask(deviceId, scanPath);
    res.json({ success: true, taskId });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/scan/process", async (req, res) => {
  try {
    const { taskId, ...scanRequest } = z.object({
      taskId: z.string(),
      deviceId: z.string(),
      scanPath: z.string(),
      files: z.array(z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        fileHash: z.string().optional(),
      })),
    }).parse(req.body);
    
    const report = await tidyingOrchestrator.processScan(taskId, scanRequest);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post("/analyze/quick", async (req, res) => {
  try {
    const scanRequest = scanRequestSchema.parse(req.body);
    const scanResult = await fileScanner.processScanResult(scanRequest);
    
    const duplicates = fileScanner.findDuplicates(scanResult.files);
    const renameSuggestions = suggestBatchRenames(scanResult.files);
    const hotColdAnalysis = fileScanner.analyzeHotCold(scanResult.files);
    const statistics = fileScanner.getStatistics(scanResult.files);
    
    res.json({
      success: true,
      analysis: {
        totalFiles: scanResult.totalCount,
        totalSize: scanResult.totalSize,
        duplicateGroups: duplicates.length,
        duplicateFiles: duplicates.reduce((sum, d) => sum + d.duplicateCount, 0),
        renameSuggestions: renameSuggestions.length,
        coldFiles: hotColdAnalysis.coldFiles.length,
        statistics,
      },
      duplicates,
      renameSuggestions,
      coldFiles: hotColdAnalysis.coldFiles.slice(0, 20),
    });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/rename/suggest", async (req, res) => {
  try {
    const { files } = z.object({
      files: z.array(z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        deviceId: z.string(),
        fileHash: z.string().optional(),
      })),
    }).parse(req.body);
    
    const metadata: FileMetadata[] = files.map(f => ({
      ...f,
      createdAt: new Date(f.createdAt),
      modifiedAt: new Date(f.modifiedAt),
      accessedAt: new Date(f.accessedAt),
    }));
    
    const suggestions = suggestBatchRenames(metadata);
    res.json({ success: true, suggestions });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/rename/semantic", async (req, res) => {
  try {
    const { file, content } = z.object({
      file: z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        deviceId: z.string(),
      }),
      content: z.string().optional(),
    }).parse(req.body);
    
    const metadata: FileMetadata = {
      ...file,
      createdAt: new Date(file.createdAt),
      modifiedAt: new Date(file.modifiedAt),
      accessedAt: new Date(file.accessedAt),
    };
    
    const suggestion = await suggestSemanticRename(
      metadata,
      content || '',
      process.env.DASHSCOPE_API_KEY
    );
    
    res.json({ success: true, suggestion });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/plan/create", async (req, res) => {
  try {
    const { deviceId, report, options } = z.object({
      deviceId: z.string(),
      report: z.any(),
      options: z.object({
        handleDuplicates: z.boolean().optional(),
        handleRenames: z.boolean().optional(),
        handleColdFiles: z.boolean().optional(),
        archivePath: z.string().optional(),
      }).optional(),
    }).parse(req.body);
    
    const plan = await tidyingOrchestrator.createTidyingPlan(deviceId, report, options);
    res.json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/plan/execute", async (req, res) => {
  try {
    const { taskId } = z.object({
      taskId: z.string(),
    }).parse(req.body);
    
    const task = await tidyingOrchestrator.executePlan(taskId);
    res.json({ success: true, task });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/action/update", async (req, res) => {
  try {
    const { taskId, filePath, status, error } = z.object({
      taskId: z.string(),
      filePath: z.string(),
      status: z.enum(['COMPLETED', 'FAILED', 'SKIPPED']),
      error: z.string().optional(),
    }).parse(req.body);
    
    await tidyingOrchestrator.updateActionStatus(taskId, filePath, status, error);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.get("/history/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const tasks = await tidyingOrchestrator.getTaskHistory(deviceId, limit);
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post("/access/log", async (req, res) => {
  try {
    const { deviceId, filePath, accessType } = z.object({
      deviceId: z.string(),
      filePath: z.string(),
      accessType: z.enum(['OPEN', 'MODIFY', 'DELETE']),
    }).parse(req.body);
    
    await tidyingOrchestrator.logFileAccess(deviceId, filePath, accessType);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/analyze/semantic", async (req, res) => {
  try {
    const { file, content } = z.object({
      file: z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        deviceId: z.string(),
      }),
      content: z.string().optional(),
    }).parse(req.body);
    
    const metadata: FileMetadata = {
      ...file,
      createdAt: new Date(file.createdAt),
      modifiedAt: new Date(file.modifiedAt),
      accessedAt: new Date(file.accessedAt),
    };
    
    const analysis = await semanticAnalyzer.analyzeFile(metadata, content);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/duplicates/find", async (req, res) => {
  try {
    const scanRequest = scanRequestSchema.parse(req.body);
    const scanResult = await fileScanner.processScanResult(scanRequest);
    const duplicates = fileScanner.findDuplicates(scanResult.files);
    
    res.json({ 
      success: true, 
      duplicates,
      totalDuplicateSize: duplicates.reduce((sum, d) => sum + d.totalSize, 0),
      totalDuplicateCount: duplicates.reduce((sum, d) => sum + d.duplicateCount, 0),
    });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/hotcold/analyze", async (req, res) => {
  try {
    const { files, coldThresholdDays } = z.object({
      files: z.array(z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        deviceId: z.string(),
      })),
      coldThresholdDays: z.number().default(90),
    }).parse(req.body);
    
    const metadata: FileMetadata[] = files.map(f => ({
      ...f,
      createdAt: new Date(f.createdAt),
      modifiedAt: new Date(f.modifiedAt),
      accessedAt: new Date(f.accessedAt),
    }));
    
    const analysis = fileScanner.analyzeHotCold(metadata, coldThresholdDays);
    
    res.json({
      success: true,
      hotCount: analysis.hotFiles.length,
      coldCount: analysis.coldFiles.length,
      coldFiles: analysis.coldFiles,
      recommendations: analysis.recommendations,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/desktop/analyze", async (req, res) => {
  try {
    const { screenshot } = z.object({
      screenshot: z.string(),
    }).parse(req.body);
    
    const analysis = await desktopAnalyzer.analyzeWithAI(screenshot);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/desktop/grouping", async (req, res) => {
  try {
    const { icons } = z.object({
      icons: z.array(z.object({
        name: z.string(),
        type: z.enum(['shortcut', 'file', 'folder', 'temp', 'unknown']),
        position: z.object({ x: z.number(), y: z.number() }),
        category: z.string().optional(),
      })),
    }).parse(req.body);
    
    const suggestions = await desktopAnalyzer.generateGroupingSuggestions(icons);
    res.json({ success: true, suggestions });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/dedup/index", async (req, res) => {
  try {
    const scanRequest = scanRequestSchema.parse(req.body);
    const scanResult = await fileScanner.processScanResult(scanRequest);
    await dedupEngine.indexFiles(scanRequest.deviceId, scanResult.files);
    
    const stats = dedupEngine.getIndexStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/dedup/find-cross-device", async (req, res) => {
  try {
    const duplicates = await dedupEngine.findCrossDeviceDuplicates();
    res.json({ 
      success: true, 
      duplicates,
      totalDuplicates: duplicates.length,
      potentialSavings: duplicates.reduce((sum, d) => sum + d.recommendation.potentialSavings, 0),
    });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/dedup/similar", async (req, res) => {
  try {
    const { files, threshold } = z.object({
      files: z.array(z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        deviceId: z.string(),
        fileHash: z.string().optional(),
      })),
      threshold: z.number().min(0).max(1).default(0.8),
    }).parse(req.body);
    
    const metadata: FileMetadata[] = files.map(f => ({
      ...f,
      createdAt: new Date(f.createdAt),
      modifiedAt: new Date(f.modifiedAt),
      accessedAt: new Date(f.accessedAt),
    }));
    
    const similar = dedupEngine.findSimilarFiles(metadata, threshold);
    res.json({ success: true, similar });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/archive/candidates", async (req, res) => {
  try {
    const { deviceId, files } = z.object({
      deviceId: z.string(),
      files: z.array(z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        deviceId: z.string(),
      })),
    }).parse(req.body);
    
    const metadata: FileMetadata[] = files.map(f => ({
      ...f,
      createdAt: new Date(f.createdAt),
      modifiedAt: new Date(f.modifiedAt),
      accessedAt: new Date(f.accessedAt),
    }));
    
    const candidates = await hotColdSeparator.generateArchiveCandidates(deviceId, metadata);
    res.json({ 
      success: true, 
      candidates,
      totalCandidates: candidates.length,
      potentialSavings: candidates.reduce((sum, c) => sum + c.estimatedSavings, 0),
    });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/archive/plan", async (req, res) => {
  try {
    const { deviceId, candidates, options } = z.object({
      deviceId: z.string(),
      candidates: z.array(z.any()),
      options: z.object({
        targetLocation: z.string().optional(),
        compressionEnabled: z.boolean().optional(),
      }).optional(),
    }).parse(req.body);
    
    const plan = await hotColdSeparator.createArchivePlan(deviceId, candidates, options);
    res.json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/archive/separation", async (req, res) => {
  try {
    const { files } = z.object({
      files: z.array(z.object({
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        createdAt: z.string(),
        modifiedAt: z.string(),
        accessedAt: z.string(),
        deviceId: z.string(),
      })),
    }).parse(req.body);
    
    const metadata: FileMetadata[] = files.map(f => ({
      ...f,
      createdAt: new Date(f.createdAt),
      modifiedAt: new Date(f.modifiedAt),
      accessedAt: new Date(f.accessedAt),
    }));
    
    const separation = await hotColdSeparator.separateFiles(metadata);
    res.json({ success: true, separation: separation.statistics });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/search", async (req, res) => {
  try {
    const query = z.object({
      text: z.string(),
      deviceId: z.string().optional(),
      maxResults: z.number().optional(),
    }).parse(req.body);
    
    const results = await instantRetrieval.search(query);
    res.json({ success: true, ...results });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/search/index", async (req, res) => {
  try {
    const scanRequest = scanRequestSchema.parse(req.body);
    const scanResult = await fileScanner.processScanResult(scanRequest);
    await instantRetrieval.indexFiles(scanResult.files);
    
    res.json({ success: true, indexSize: instantRetrieval.getIndexSize() });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.post("/search/related", async (req, res) => {
  try {
    const { filePath, deviceId } = z.object({
      filePath: z.string(),
      deviceId: z.string(),
    }).parse(req.body);
    
    const related = await instantRetrieval.findRelatedFiles(filePath, deviceId);
    res.json({ success: true, related });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

router.get("/search/autocomplete", async (req, res) => {
  try {
    const prefix = String(req.query.prefix || '');
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : undefined;
    
    const suggestions = await instantRetrieval.autocomplete(prefix, deviceId);
    res.json({ success: true, suggestions });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

export default router;
