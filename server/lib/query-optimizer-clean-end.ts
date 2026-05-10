// Temporary file with clean ending

// Export便捷函数
export const queryOptimizer = new QueryOptimizer();
export const createQueryOptimizationReport = () => queryOptimizer.generatePerformanceReport();
export const analyzeQueryPerformance = (query: string, params?: unknown[]) => queryOptimizer.analyzeQuery(query, params);
export const getPerformanceTrends = (hours?: number) => queryOptimizer.monitorPerformanceTrends(hours);
