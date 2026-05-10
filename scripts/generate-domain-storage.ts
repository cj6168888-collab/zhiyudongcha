/**
 * 领域存储模块生成器
 * 
 * 用于自动生成领域存储模块的模板代码
 * 运行: npx tsx scripts/generate-domain-storage.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOMAINS = [
  {
    name: 'user',
    entities: ['User', 'UserSettings', 'Voiceprint', 'VoiceAuthorization'],
    repo: 'userRepository'
  },
  {
    name: 'person',
    entities: ['Person', 'RelationshipInsight'],
    repo: 'personRepository'
  },
  {
    name: 'vault',
    entities: ['VaultItem'],
    repo: 'vaultRepository'
  },
  {
    name: 'device',
    entities: ['Device', 'RemoteCommand', 'SatelliteDevice'],
    repo: 'deviceRepository'
  },
  {
    name: 'project',
    entities: ['Project', 'ProjectNote', 'ProjectFile', 'ProjectTemplate'],
    repo: 'projectRepository'
  },
  {
    name: 'conversation',
    entities: ['TalkSession', 'ConversationSegment', 'ExtractedEntity'],
    repo: 'insightRepository'
  },
  {
    name: 'system',
    entities: ['AuditLog', 'ExpertDecision', 'EvolutionEvent', 'DailyReport'],
    repo: 'auditRepository'
  },
  {
    name: 'integration',
    entities: ['IntegrationProvider', 'IntegrationAccount', 'EmailAccount'],
    repo: 'integrationRepository'
  }
];

function generateDomainStorage(domain: typeof DOMAINS[0]): string {
  const interfaceName = `I${capitalize(domain.name)}Storage`;
  const className = `${capitalize(domain.name)}Storage`;
  const exportName = `${domain.name}Storage`;

  const methods = domain.entities.map(entity => {
    const lowerEntity = entity.toLowerCase();
    return `
  async get${entity}(id: string): Promise<${entity} | undefined> {
    return await ${domain.repo}.findById(id);
  }

  async create${entity}(data: any): Promise<${entity}> {
    return await ${domain.repo}.create(data);
  }

  async update${entity}(id: string, updates: any): Promise<${entity} | undefined> {
    return await ${domain.repo}.update(id, updates);
  }

  async delete${entity}(id: string): Promise<boolean> {
    return await ${domain.repo}.delete(id);
  }`;
  }).join('\n');

  return `import { ${domain.repo} } from '../../repositories';
import type { ${domain.entities.join(', ')} } from '@shared/schema';

export interface ${interfaceName} {
${methods}
}

export class ${className} implements ${interfaceName} {
${methods}
}

export const ${exportName} = new ${className}();
`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateAll() {
  const outputDir = path.join(__dirname, '..', 'server', 'storage', 'domains');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  DOMAINS.forEach(domain => {
    const content = generateDomainStorage(domain);
    const filePath = path.join(outputDir, `${domain.name}.ts`);
    fs.writeFileSync(filePath, content);
    console.log(`Generated: ${filePath}`);
  });

  // Generate index
  const indexContent = DOMAINS.map(domain => {
    const className = `${capitalize(domain.name)}Storage`;
    return `export { ${className}, type I${capitalize(domain.name)}Storage, ${domain.name}Storage } from './${domain.name}';`;
  }).join('\n');

  fs.writeFileSync(path.join(outputDir, 'index.ts'), indexContent);
  console.log('Generated: index.ts');
}

generateAll();
