import { Router, Request, Response } from "express";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { documentDecoderService } from "../services/document-decoder";
import { insertUploadedDocumentSchema } from "@shared/schema";

const router = Router();

const uploadDir = "./uploads/documents";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
});

router.post("/upload", upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: "请上传至少一个文件" });
    }

    const { title, description, documentType, category } = req.body;

    const doc = await documentDecoderService.createDocument({
      title: title || `文档_${new Date().toISOString().slice(0, 10)}`,
      description,
      documentType: documentType || "OTHER",
      category,
      totalFiles: files.length,
      totalPages: files.length,
      status: "PENDING",
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = documentDecoderService.detectFileType(file.mimetype, file.originalname);

      await documentDecoderService.addPage({
        documentId: doc.id,
        pageNumber: i + 1,
        fileName: file.originalname,
        fileType,
        fileMimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        status: "PENDING",
      });
    }

    documentDecoderService.processDocument(doc.id).catch((err) => {
      console.error(`[DocumentDecoder] 处理文档 ${doc.id} 失败:`, err);
    });

    res.json({
      success: true,
      document: doc,
      filesUploaded: files.length,
      message: "文件上传成功，正在后台处理...",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/documents", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const documents = await documentDecoderService.getDocuments(limit);
    res.json({ success: true, documents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/documents/:id", async (req: Request, res: Response) => {
  try {
    const doc = await documentDecoderService.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: "文档不存在" });
    }
    const pages = await documentDecoderService.getPages(req.params.id);
    res.json({ success: true, document: doc, pages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/documents/:id/reprocess", async (req: Request, res: Response) => {
  try {
    const doc = await documentDecoderService.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: "文档不存在" });
    }

    documentDecoderService.processDocument(req.params.id).catch((err) => {
      console.error(`[DocumentDecoder] 重新处理文档 ${req.params.id} 失败:`, err);
    });

    res.json({ success: true, message: "已开始重新处理" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/analyze-text", async (req: Request, res: Response) => {
  try {
    const { text, type } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: "请提供文本内容" });
    }

    if (type === "CONTRACT" || !type) {
      const analysis = await documentDecoderService.analyzeContract(text);
      res.json({ success: true, analysis });
    } else {
      res.json({ success: true, analysis: { summary: text.slice(0, 500) } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === 文档对话 API ===

router.get("/documents/:id/conversation", async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const thread = await documentDecoderService.getThread(documentId);
    const messages = await documentDecoderService.listMessages(documentId);
    
    res.json({
      success: true,
      thread,
      messages: messages.reverse(), // 按时间正序返回
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/documents/:id/conversation/message", async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const { messageType, content, affectedFields, structuredDiff } = req.body;

    if (!messageType || !content) {
      return res.status(400).json({ success: false, error: "请提供消息类型和内容" });
    }

    const validTypes = ["SUPPLEMENT", "CORRECTION", "HIGHLIGHT", "REVISION", "QUESTION"];
    if (!validTypes.includes(messageType)) {
      return res.status(400).json({ success: false, error: "无效的消息类型" });
    }

    const thread = await documentDecoderService.getOrCreateThread(documentId);
    
    const { userMessage, aiResponse } = await documentDecoderService.processUserFeedback(
      documentId,
      thread.id,
      messageType as any,
      content,
      affectedFields,
      structuredDiff
    );

    res.json({
      success: true,
      userMessage,
      aiResponse,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/documents/:id/conversation/analyze", async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const doc = await documentDecoderService.getDocument(documentId);
    
    if (!doc) {
      return res.status(404).json({ success: false, error: "文档不存在" });
    }

    const thread = await documentDecoderService.getOrCreateThread(documentId);
    
    // 使用综合分析，包含所有补充资料
    const analysis = await documentDecoderService.generateComprehensiveAnalysis(documentId);

    const message = await documentDecoderService.appendMessage({
      threadId: thread.id,
      documentId,
      role: "AI",
      messageType: "ANALYSIS",
      content: analysis,
      relevanceScore: 1.0,
    });

    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === 补充资料 API ===

router.get("/documents/:id/supplements", async (req: Request, res: Response) => {
  try {
    const supplements = await documentDecoderService.getSupplements(req.params.id);
    res.json({ success: true, supplements });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/documents/:id/supplements", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "请上传文件" });
    }

    const documentId = req.params.id;
    const thread = await documentDecoderService.getOrCreateThread(documentId);
    const fileType = documentDecoderService.detectFileType(file.mimetype, file.originalname);

    const supplement = await documentDecoderService.addSupplement({
      documentId,
      threadId: thread.id,
      fileName: file.originalname,
      fileType,
      fileMimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      status: "PENDING",
    });

    // 后台处理补充资料
    documentDecoderService.processSupplement(supplement.id).then(async () => {
      // 处理完成后自动生成综合分析
      const analysis = await documentDecoderService.generateComprehensiveAnalysis(documentId);
      await documentDecoderService.appendMessage({
        threadId: thread.id,
        documentId,
        role: "AI",
        messageType: "ANALYSIS",
        content: `📎 补充资料「${file.originalname}」已接收并分析：\n\n${analysis}`,
        relevanceScore: 1.0,
      });
    }).catch(console.error);

    res.json({
      success: true,
      supplement,
      message: "补充资料上传成功，正在分析中...",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
