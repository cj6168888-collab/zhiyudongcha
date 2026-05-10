import type { Express } from "express";
import type { IStorage } from "../storage";
import { z } from "zod";
import { requireMaster, auditAction } from "../middleware/auth";

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
      const invoices = await storage.getAllInvoices("master", status as string);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "获取发票失败" });
    }
  });

  app.get("/api/invoices/unassigned", async (req, res) => {
    try {
      const invoices = await storage.getUnassignedInvoices("master");
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "获取未分配发票失败" });
    }
  });

  app.post("/api/invoices", requireMaster, async (req, res) => {
    try {
      const invoice = await storage.createInvoice({
        userId: "master",
        sourceType: "manual",
        ...req.body,
      });
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "创建发票失败" });
    }
  });

  app.post("/api/invoices/extract", requireMaster, async (req, res) => {
    try {
      const { text, imageUrl } = req.body;
      if (!text && !imageUrl) {
        return res.status(400).json({ error: "需要提供发票文本或图片URL" });
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
        return res.status(500).json({ error: "AI服务未配置" });
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
        return res.status(502).json({ error: "AI服务调用失败", retryable: true });
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({ 
          error: "无法从AI响应中提取JSON", 
          suggestion: "请提供更清晰的发票文本",
          raw: content.substring(0, 500),
        });
      }

      let rawData: unknown;
      try {
        rawData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        return res.status(422).json({ 
          error: "AI返回的JSON格式无效", 
          suggestion: "请重试或提供更清晰的发票内容",
        });
      }

      const validation = extractedInvoiceSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(422).json({ 
          error: "提取的数据格式不符合预期", 
          details: validation.error.issues.map(i => i.message).join(', '),
        });
      }

      const extractedData = validation.data;
      const confidence = extractedData.confidence ?? 0.5;
      
      await auditAction('INVOICE_EXTRACTED', req.userRole || 'MASTER', 'invoice', 'new', 
        { source: imageUrl ? 'image' : 'text', confidence }, 
        'SUCCESS', req);

      res.json({
        success: true,
        extracted: extractedData,
        canAutoCreate: confidence >= 0.8,
      });
    } catch (error) {
      console.error('Invoice extraction error:', error);
      res.status(500).json({ error: "发票提取失败", retryable: true });
    }
  });

  app.post("/api/invoices/auto-create", requireMaster, async (req, res) => {
    try {
      const { extracted } = req.body;
      
      const validation = extractedInvoiceSchema.safeParse(extracted);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "发票数据格式无效", 
          details: validation.error.issues.map(i => i.message).join(', '),
        });
      }
      
      const validData = validation.data;
      if (!validData.invoiceNumber) {
        return res.status(400).json({ error: "发票号码为必填项" });
      }

      const invoice = await storage.createInvoice({
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

      res.json(invoice);
    } catch (error) {
      console.error('Auto-create invoice error:', error);
      res.status(500).json({ error: "自动创建发票失败" });
    }
  });

  app.put("/api/invoices/:id", requireMaster, async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, req.body);
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "更新发票失败" });
    }
  });

  app.delete("/api/invoices/:id", requireMaster, async (req, res) => {
    try {
      const deleted = await storage.deleteInvoice(req.params.id);
      res.json({ success: deleted });
    } catch (error) {
      res.status(500).json({ error: "删除发票失败" });
    }
  });

  // Expense Reports
  app.get("/api/expense-reports", async (req, res) => {
    try {
      const { status } = req.query;
      const reports = await storage.getAllExpenseReports("master", status as string);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "获取报销单失败" });
    }
  });

  app.get("/api/expense-reports/:id", async (req, res) => {
    try {
      const result = await storage.getExpenseReportWithInvoices(req.params.id);
      if (!result) {
        return res.status(404).json({ error: "报销单不存在" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "获取报销单失败" });
    }
  });

  app.post("/api/expense-reports", requireMaster, async (req, res) => {
    try {
      const report = await storage.createExpenseReport({
        userId: "master",
        ...req.body,
      });
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "创建报销单失败" });
    }
  });

  app.put("/api/expense-reports/:id", requireMaster, async (req, res) => {
    try {
      const report = await storage.updateExpenseReport(req.params.id, req.body);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "更新报销单失败" });
    }
  });

  app.post("/api/expense-reports/:id/invoices", requireMaster, async (req, res) => {
    try {
      const { invoiceIds } = req.body;
      const report = await storage.getExpenseReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "报销单不存在" });
      }
      
      let totalAmount = parseFloat(report.totalAmount || '0');
      let invoiceCount = report.invoiceCount || 0;
      
      for (const invoiceId of invoiceIds) {
        const invoice = await storage.getInvoice(invoiceId);
        if (invoice && !invoice.expenseReportId) {
          await storage.updateInvoice(invoiceId, { expenseReportId: req.params.id });
          totalAmount += parseFloat(invoice.totalAmount || '0');
          invoiceCount++;
        }
      }
      
      const updatedReport = await storage.updateExpenseReport(req.params.id, {
        totalAmount: totalAmount.toString(),
        invoiceCount,
      });
      
      res.json(updatedReport);
    } catch (error) {
      res.status(500).json({ error: "添加发票失败" });
    }
  });

  app.delete("/api/expense-reports/:id/invoices/:invoiceId", requireMaster, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice || invoice.expenseReportId !== req.params.id) {
        return res.status(404).json({ error: "发票不存在或不属于此报销单" });
      }
      
      await storage.updateInvoice(req.params.invoiceId, { expenseReportId: null });
      
      const report = await storage.getExpenseReport(req.params.id);
      if (report) {
        const totalAmount = parseFloat(report.totalAmount || '0') - parseFloat(invoice.totalAmount || '0');
        await storage.updateExpenseReport(req.params.id, {
          totalAmount: Math.max(0, totalAmount).toString(),
          invoiceCount: Math.max(0, (report.invoiceCount || 0) - 1),
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "移除发票失败" });
    }
  });

  app.post("/api/expense-reports/:id/submit", requireMaster, async (req, res) => {
    try {
      const report = await storage.updateExpenseReport(req.params.id, {
        status: 'pending',
        submittedAt: new Date(),
      });
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "提交报销单失败" });
    }
  });

  app.delete("/api/expense-reports/:id", requireMaster, async (req, res) => {
    try {
      const deleted = await storage.deleteExpenseReport(req.params.id);
      res.json({ success: deleted });
    } catch (error) {
      res.status(500).json({ error: "删除报销单失败" });
    }
  });
}
