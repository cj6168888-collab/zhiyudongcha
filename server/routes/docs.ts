import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('SwaggerDocs');

// 基础 swagger 配置
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Sheng-Yu-Zhu-Shou API',
    version: '1.0.0',
    description: '系统核心 API 文档',
  },
  servers: [{ url: process.env.BASE_URL || 'http://localhost:3000' }],
};

const options = {
  swaggerDefinition,
  // 自动从 server/**/*.ts 中提取 JSDoc 注释
  apis: ['server/**/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

const router = Router();
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

logger.info('Swagger 文档路由已注册');
export default router;
