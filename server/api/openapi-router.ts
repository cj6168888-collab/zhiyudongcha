import { createServiceLogger } from '../lib/logger';
import { Request, Response, NextFunction } from 'express';

const logger = createServiceLogger('OpenAPIRouter');

interface OpenAPISpecification {
  openapi: string;
  info: Record<string, unknown>;
  paths: Record<string, unknown>;
  components?: Record<string, unknown>;
  [key: string]: unknown;
}

export class OpenAPIRouter {
  private static instance: OpenAPIRouter;
  private specification: OpenAPISpecification | null = null;

  private constructor() {
    this.specification = null;
  }

  public static getInstance(): OpenAPIRouter {
    if (!OpenAPIRouter.instance) {
      OpenAPIRouter.instance = new OpenAPIRouter();
    }
    return OpenAPIRouter.instance;
  }

  public generateSpecification(): OpenAPISpecification | null {
    logger.info('Generating OpenAPI specification');
    return this.specification;
  }

  public getSpecificationJSON(): OpenAPISpecification | null {
    if (!this.specification) {
      this.generateSpecification();
    }
    return this.specification;
  }

  public getSwaggerUI(): string {
    if (!this.specification) {
      this.generateSpecification();
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>领航者 (Navigator-X) API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.11.1/swagger-ui.css">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.11.1/swagger-ui-dark.css">
  <script src="https://unpkg.com/swagger-ui-dist@4.11.1/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.11.1/swagger-ui-standalone-preset.js"></script>
</head>
<body>
  <div id="swagger-ui"></div>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset.dark
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        persistAuthorization: "Bearer Token",
        tryItOut: true
      });
    };
  </script>
</body>
</html>`;
  }

  public middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.path === '/openapi.json') {
          res.setHeader('Content-Type', 'application/json');
          res.send(this.getSpecificationJSON());
        } else if (req.path === '/docs') {
          res.setHeader('Content-Type', 'text/html');
          res.send(this.getSwaggerUI());
        } else {
          next();
        }
      } catch (error) {
        logger.error({ error: (error as Error).message, path: req.path }, 'OpenAPI middleware error');

        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'OpenAPI服务错误',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  public registerRoutes(app: { use: (router: unknown) => void }): void {
    const router = this.middleware();
    app.use(router);
    logger.info('OpenAPI routes registered');
  }
}

export const openAPIRouter = OpenAPIRouter.getInstance();
