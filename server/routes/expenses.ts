import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Expenses');

import type { Express } from "express";
import type { IStorage } from "../storage";
import { z } from "zod";
import { requireMaster, auditAction } from "../middleware/auth";
import { financeService } from "../services/FinanceService";

const invoiceItemSchema = z.object({
  description: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  unitPrice: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
});

const extractedInvoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  vendorName: z.string().optional(),
  vendorTaxId: z.string().optional(),
  buyerName: z.string().optional(),
  buyerTaxId: z.string().optional(),
  totalAmount: z.union([z.string(), z.number()]).optional(),
  taxAmount: z.union([z.string(), z.number()]).optional(),
  preTaxAmount: z.union([z.string(), z.number()]).optional(),
  invoiceType: z.string().optional(),
  items: z.array(invoiceItemSchema).optional(),
  confidence: z.union([z.string(), z.number()]).transform(v => typeof v === 'string' ? parseFloat(v) : v).pipe(z.number().min(0).max(1)).optional(),
});

export function registerExpensesRoutes(
  app: Express,
  storage: IStorage
) {
  // ===== Invoice & Expense APIs =====

  app.get("/api/invoices", async (req, res) => {
    try {
      const { status } = req.query;
      const invoices = await financeService.getAllInvoices("master", status as string);
      return res.json({ success: true, data: invoices });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch invoices');
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "获取发票失败" }
      });
    }
  });

  app.get("/api/invoices/unassigned", async (req, res) => {
    try {
      const invoices = await financeService.getUnassignedInvoices("master");
      return res.json({ success: true, data: invoices });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch unassigned invoices');
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "获取未分配发票失败" }
      });
    }
  });

  app.post("/api/invoices", requireMaster, async (req, res) => {
    try {
      const invoice = await financeService.createInvoice({
        userId: "master",
        sourceType: "manual",
        ...req.body,
      });
      return res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      logger.error({ err: error }, 'Failed to create invoice');
      return res.status(500).json({
        success: false,
        error: { code: 'CREATE_ERROR', message: "创建发票失败" }
      });
    }
  });

  app.post("/api/invoices/extract", requireMaster, async (req, res) => {
    try {
      const { text, imageUrl } = req.body;
      if (!text && !imageUrl) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: "需要提供发票文本或图片URL" }
        });
      }

      const extractionPrompt = `你是一个专业的发票信息提取专家。请从以下发票内容中提取关键信息，以JSON格式返回：
{
  "invoiceNumber": "发票号码",
  "invoiceDate": "开票日期 (YYYY-MM-DD格式)",
  "vendorName": "销售方名称",
  "vendorTaxId": "销售方税号",
  "buyerName": "购买方名称",
  "buyerTaxId": "购买方税号",
  "totalAmount": "价税合计金额(数字)",
  "taxAmount": "税额(数字)",
  "preTaxAmount": "不含税金额(数字)",
  "invoiceType": "发票类型 (如: 增值税专用发票/增值税普通发票/电子发票)",
  "items": [{"description": "项目名称", "quantity": "数量", "unitPrice": "单价", "amount": "金额"}],
  "confidence": 0.0-1.0的置信度
}

发票内容:
${text || '(图片发票，请根据常见格式推断结构)'}`;

      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: { code: 'SERVICE_NOT_CONFIGURED', message: "AI服务未配置" }
        });
      }

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [{ role: 'user', content: extractionPrompt }],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        return res.status(502).json({
          success: false,
          error: { code: 'AI_SERVICE_ERROR', message: "AI服务调用失败" },
          retryable: true
        });
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: "无法从AI响应中提取JSON",
            details: { suggestion: "请提供更清晰的发票文本", raw: content.substring(0, 500) }
          }
        });
      }

      let rawData: unknown;
      try {
        rawData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        return res.status(422).json({
          success: false,
          error: { code: 'INVALID_JSON', message: "AI返回的JSON格式无效" }
        });
      }

      const validation = extractedInvoiceSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: "提取的数据格式不符合预期",
            details: validation.error.issues.map(i => i.message).join(', ')
          }
        });
      }

      const extractedData = validation.data;
      const confidence = extractedData.confidence ?? 0.5;

      await auditAction('INVOICE_EXTRACTED', req.userRole || 'MASTER', 'invoice', 'new',
        { source: imageUrl ? 'image' : 'text', confidence },
        'SUCCESS', req);

      return res.json({
        success: true,
        data: {
          extracted: extractedData,
          canAutoCreate: confidence >= 0.8,
        }
      });
    } catch (error) {
      logger.error({ err: error }, 'Invoice extraction failed');
      return res.status(500).json({
        success: false,
        error: { code: 'EXTRACTION_ERROR', message: "发票提取失败" }
      });
    }
  });

  app.post("/api/invoices/auto-create", requireMaster, async (req, res) => {
    try {
      const { extracted } = req.body;

      const validation = extractedInvoiceSchema.safeParse(extracted);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: "发票数据格式无效",
            details: validation.error.issues.map(i => i.message).join(', ')
          }
        });
      }

      const validData = validation.data;
      if (!validData.invoiceNumber) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: "发票号码为必填项" }
        });
      }

      const invoice = await financeService.createInvoice({
        userId: "master",
        sourceType: "ocr",
        invoiceNo: validData.invoiceNumber,
        invoiceDate: validData.invoiceDate ? new Date(validData.invoiceDate) : undefined,
        sellerName: validData.vendorName,
        sellerTaxNo: validData.vendorTaxId,
        totalAmount: String(validData.totalAmount || 0),
        taxAmount: String(validData.taxAmount || 0),
        amount: String(validData.preTaxAmount || 0),
        invoiceType: validData.invoiceType,
        status: (validData.confidence ?? 0) >= 0.9 ? 'verified' : 'pending_review',
      });

      await auditAction('INVOICE_AUTO_CREATED', req.userRole || 'MASTER', 'invoice', invoice.id,
        { confidence: validData.confidence }, 'SUCCESS', req);

      return res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      logger.error({ err: error }, 'Auto-create invoice failed');
      return res.status(500).json({
        success: false,
        error: { code: 'CREATE_ERROR', message: "自动创建发票失败" }
      });
    }
  });

  app.put("/api/invoices/:id", requireMaster, async (req, res) => {
    try {
      const invoice = await financeService.updateInvoice(req.params.id, req.body);
      return res.json({ success: true, data: invoice });
    } catch (error) {
      logger.error({ err: error }, 'Failed to update invoice');
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ERROR', message: "更新发票失败" }
      });
    }
  });

  app.delete("/api/invoices/:id", requireMaster, async (req, res) => {
    try {
      const deleted = await financeService.deleteInvoice(req.params.id);
      return res.json({ success: true, data: { deleted } });
    } catch (error) {
      logger.error({ err: error }, 'Failed to delete invoice');
      return res.status(500).json({
        success: false,
        error: { code: 'DELETE_ERROR', message: "删除发票失败" }
      });
    }
  });

  // Expense Reports
  app.get("/api/expense-reports", async (req, res) => {
    try {
      const { status } = req.query;
      const reports = await financeService.getAllExpenseReports("master", status as string);
      return res.json({ success: true, data: reports });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch expense reports');
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "获取报销单失败" }
      });
    }
  });

  app.get("/api/expense-reports/:id", async (req, res) => {
    try {
      const result = await financeService.getExpenseReportWithInvoices(req.params.id);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "报销单不存在" }
        });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch expense report');
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: "获取报销单失败" }
      });
    }
  });

  app.post("/api/expense-reports", requireMaster, async (req, res) => {
    try {
      const report = await financeService.createExpenseReport({
        userId: "master",
        ...req.body,
      });
      return res.status(201).json({ success: true, data: report });
    } catch (error) {
      logger.error({ err: error }, 'Failed to create expense report');
      return res.status(500).json({
        success: false,
        error: { code: 'CREATE_ERROR', message: "创建报销单失败" }
      });
    }
  });

  app.put("/api/expense-reports/:id", requireMaster, async (req, res) => {
    try {
      const report = await financeService.updateExpenseReport(req.params.id, req.body);
      return res.json({ success: true, data: report });
    } catch (error) {
      logger.error({ err: error }, 'Failed to update expense report');
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ERROR', message: "更新报销单失败" }
      });
    }
  });

  app.post("/api/expense-reports/:id/invoices", requireMaster, async (req, res) => {
    try {
      const { invoiceIds } = req.body;
      const report = await financeService.getExpenseReport(req.params.id);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "报销单不存在" }
        });
      }

      let totalAmount = parseFloat(report.totalAmount || '0');
      let invoiceCount = report.invoiceCount || 0;

      for (const invoiceId of invoiceIds) {
        const invoice = await financeService.getInvoice(invoiceId);
        if (invoice && !invoice.expenseReportId) {
          await financeService.updateInvoice(invoiceId, { expenseReportId: req.params.id });
          totalAmount += parseFloat(invoice.totalAmount || '0');
          invoiceCount++;
        }
      }

      const updatedReport = await financeService.updateExpenseReport(req.params.id, {
        totalAmount: totalAmount.toString(),
        invoiceCount,
      });

      return res.json({ success: true, data: updatedReport });
    } catch (error) {
      logger.error({ err: error }, 'Failed to add invoice');
      return res.status(500).json({
        success: false,
        error: { code: 'ADD_INVOICE_ERROR', message: "添加发票失败" }
      });
    }
  });

  app.delete("/api/expense-reports/:id/invoices/:invoiceId", requireMaster, async (req, res) => {
    try {
      const invoice = await financeService.getInvoice(req.params.invoiceId);
      if (!invoice || invoice.expenseReportId !== req.params.id) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "发票不存在或不属于此报销单" }
        });
      }

      await financeService.updateInvoice(req.params.invoiceId, { expenseReportId: null });

      const report = await financeService.getExpenseReport(req.params.id);
      if (report) {
        const totalAmount = parseFloat(report.totalAmount || '0') - parseFloat(invoice.totalAmount || '0');
        await financeService.updateExpenseReport(req.params.id, {
          totalAmount: Math.max(0, totalAmount).toString(),
          invoiceCount: Math.max(0, (report.invoiceCount || 0) - 1),
        });
      }

      return res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, 'Failed to remove invoice');
      return res.status(500).json({
        success: false,
        error: { code: 'REMOVE_INVOICE_ERROR', message: "移除发票失败" }
      });
    }
  });

  app.post("/api/expense-reports/:id/submit", requireMaster, async (req, res) => {
    try {
      const report = await financeService.updateExpenseReport(req.params.id, {
        status: 'pending',
        submittedAt: new Date(),
      });
      return res.json({ success: true, data: report });
    } catch (error) {
      logger.error({ err: error }, 'Failed to submit expense report');
      return res.status(500).json({
        success: false,
        error: { code: 'SUBMIT_ERROR', message: "提交报销单失败" }
      });
    }
  });

  app.delete("/api/expense-reports/:id", requireMaster, async (req, res) => {
    try {
      const deleted = await financeService.deleteExpenseReport(req.params.id);
      return res.json({ success: true, data: { deleted } });
    } catch (error) {
      logger.error({ err: error }, 'Failed to delete expense report');
      return res.status(500).json({
        success: false,
        error: { code: 'DELETE_ERROR', message: "删除报销单失败" }
      });
    }
  });
}
