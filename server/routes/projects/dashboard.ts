import type { Express } from "express";
import type { IStorage } from "../../storage";
import { createServiceLogger } from '../../lib/logger';
import { requireAuth } from "../../middleware/auth";
import { generateProjectInsights } from './ai-helpers';
import type { ProjectData } from './types';
import { projectService } from "../../services/ProjectService";

const logger = createServiceLogger('ProjectDashboard');

export function registerProjectDashboardRoutes(app: Express, storage: IStorage): void {
  app.get("/api/projects/dashboard/summary", async (req, res) => {
    try {
      const projects = await projectService.getProjects();
      const now = new Date();
      
      const statusCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      
      for (const project of projects) {
        const status = project.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        const category = project.category || 'OTHER';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
      
      const criticalCount = projects.filter(p => (p.priority ?? 5) <= 2).length;
      const pendingCount = projects.filter(p => p.status === 'PENDING_REVIEW').length;
      
      return res.json({
        total: projects.length,
        statusBreakdown: statusCounts,
        categoryBreakdown: categoryCounts,
        alerts: {
          critical: criticalCount,
          pending: pendingCount,
        },
        recentProjects: projects.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          priority: p.priority,
        })),
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      logger.error({ err: error }, '[Dashboard] Summary error');
      return res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  app.get("/api/projects/dashboard/ai-insights", requireAuth, async (req, res) => {
    try {
      const projects = await projectService.getProjects();
      const projectData: ProjectData[] = projects.map(p => ({
        id: p.id,
        title: p.title,
        name: p.title,
        status: p.status,
        priority: p.priority,
        category: p.category,
        description: p.description || undefined,
        updatedAt: p.updatedAt,
        createdAt: p.createdAt,
      }));
      
      const insights = await generateProjectInsights(projectData);
      return res.json({
        insights,
        projectCount: projects.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ err: error }, '[Dashboard] AI insights error');
      return res.status(500).json({ error: "Failed to generate AI insights" });
    }
  });

  app.get("/api/projects/dashboard/risk-alerts", async (req, res) => {
    try {
      const projects = await projectService.getProjects();
      const now = new Date();
      const alerts: Array<{
        type: 'stalled' | 'priority' | 'pending' | 'info';
        severity: 'critical' | 'warning' | 'info';
        projectId: string;
        projectTitle: string;
        message: string;
      }> = [];
      
      for (const project of projects) {
        if (project.status === 'COMPLETED' || project.status === 'CANCELLED') continue;
        
        if (project.updatedAt) {
          const lastUpdate = new Date(project.updatedAt);
          const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceUpdate > 30 && project.status === 'IN_PROGRESS') {
            alerts.push({
              type: 'stalled',
              severity: 'warning',
              projectId: project.id,
              projectTitle: project.title,
              message: `项目已 ${daysSinceUpdate} 天未更新`,
            });
          }
        }
        
        const priority = project.priority ?? 5;
        if (priority <= 2 && project.status !== 'COMPLETED') {
          alerts.push({
            type: 'priority',
            severity: 'critical',
            projectId: project.id,
            projectTitle: project.title,
            message: `紧急优先级项目 (P${priority})`,
          });
        }
        
        if (project.status === 'PENDING_REVIEW') {
          alerts.push({
            type: 'pending',
            severity: 'warning',
            projectId: project.id,
            projectTitle: project.title,
            message: `待审批`,
          });
        }
      }
      
      alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
      
      return res.json({
        alerts,
        totalAlerts: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        warningCount: alerts.filter(a => a.severity === 'warning').length,
        infoCount: alerts.filter(a => a.type === 'info').length,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      logger.error({ err: error }, '[Dashboard] Risk alerts error');
      return res.status(500).json({ error: "Failed to fetch risk alerts" });
    }
  });

  logger.info('[ProjectDashboard] Routes registered');
}
