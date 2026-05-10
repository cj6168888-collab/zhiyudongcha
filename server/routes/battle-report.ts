import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('BattleReport');

import type { Request, Response } from 'express';
import { battleReportGenerator } from '../services/battle-report-generator';
import type { RegisterRouteFn } from './types';

export const registerBattleReportRoutes: RegisterRouteFn = (app) => {
  app.post('/api/report/generate', async (req: Request, res: Response) => {
    try {
      const { date } = req.body;
      const reportDate = date ? new Date(date) : new Date();
      const report = await battleReportGenerator.generateDailyReport(reportDate);

      res.json({
        success: true,
        report: {
          id: report.id,
          date: report.date,
          summary: report.summary,
          risksCount: report.riskAlerts.length,
          recommendationsCount: report.recommendations.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/api/report/latest', async (_req: Request, res: Response) => {
    try {
      const report = battleReportGenerator.getLatestReport();

      if (!report) {
        return res.status(404).json({ error: 'No report available; generate one first' });
      }

      res.json(report);
    } catch (_error) {
      res.status(500).json({ error: 'Failed to get report' });
    }
  });

  app.get('/api/report/list', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const reports = battleReportGenerator.listReports(limit);

      res.json({
        reports: reports.map((report) => ({
          id: report.id,
          date: report.date,
          generatedAt: report.generatedAt,
          overallHealth: report.summary.overallHealth,
          risksCount: report.riskAlerts.length,
          actionItems: report.summary.actionItems,
        })),
        count: reports.length,
      });
    } catch (_error) {
      res.status(500).json({ error: 'Failed to list reports' });
    }
  });

  app.get('/api/report/summary', async (_req: Request, res: Response) => {
    try {
      const report = battleReportGenerator.getLatestReport();

      if (!report) {
        return res.json({
          available: false,
          message: 'No report available',
        });
      }

      res.json({
        available: true,
        date: report.date,
        overallHealth: report.summary.overallHealth,
        highlights: report.summary.highlights,
        concerns: report.summary.concerns,
        actionItems: report.summary.actionItems,
        criticalRisks: report.riskAlerts.filter((risk) => risk.level === 'CRITICAL').length,
        urgentRecommendations: report.recommendations.filter((recommendation) => recommendation.priority === 'URGENT').length,
      });
    } catch (_error) {
      res.status(500).json({ error: 'Failed to get summary' });
    }
  });

  app.get('/api/report/stats', async (_req: Request, res: Response) => {
    try {
      const stats = battleReportGenerator.getStats();

      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '11.6',
      });
    } catch (_error) {
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  app.get('/api/report/:id', async (req: Request, res: Response) => {
    try {
      const report = battleReportGenerator.getReport(req.params.id);

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json(report);
    } catch (_error) {
      res.status(500).json({ error: 'Failed to get report detail' });
    }
  });

  logger.info('[BattleReport] HTTP routes registered at /api/report/*');
};
