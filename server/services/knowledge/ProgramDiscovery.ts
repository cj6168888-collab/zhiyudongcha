/**
 * 程序自动发现服务 - 发现和学习未知程序
 *
 * 功能：
 * - 扫描未知程序
 * - 从网上自动查询程序能力
 * - 生成操作建议
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
import { programKnowledgeBase, ProgramCapability } from './ProgramKnowledgeBase';
import { browserAgent } from '../agent/BrowserAgent';

const logger = createServiceLogger('ProgramDiscovery');

export interface DiscoveredProgram {
  packageName: string;
  name: string;
  platform: 'android' | 'windows' | 'macos' | 'linux';
  installedAt?: Date;
  deeplink?: string;
  website?: string;
  description?: string;
  capabilities?: string[];
  operations?: string[];
  confidence: number;
}

export interface DiscoveryResult {
  program: DiscoveredProgram;
  status: 'known' | 'learned' | 'unknown' | 'error';
  message: string;
}

class ProgramDiscoveryService {
  private static instance: ProgramDiscoveryService | null = null;
  private discoveredPrograms: Map<string, DiscoveredProgram> = new Map();

  private constructor() {}

  public static getInstance(): ProgramDiscoveryService {
    if (!ProgramDiscoveryService.instance) {
      ProgramDiscoveryService.instance = new ProgramDiscoveryService();
    }
    return ProgramDiscoveryService.instance;
  }

  /**
   * 发现程序
   */
  public async discoverProgram(
    packageName: string,
    platform: DiscoveredProgram['platform']
  ): Promise<DiscoveryResult> {
    logger.info({ packageName, platform }, 'Discovering program');

    // 1. 检查是否已知
    const known = programKnowledgeBase.getProgramByPackage(packageName);
    if (known) {
      return {
        program: this.knownToDiscovered(known),
        status: 'known',
        message: '程序已在知识库中',
      };
    }

    // 2. 检查是否已发现
    const cached = this.discoveredPrograms.get(`${platform}:${packageName}`);
    if (cached) {
      return {
        program: cached,
        status: 'learned',
        message: '程序已发现过',
      };
    }

    // 3. 从网上查询
    try {
      const discovered = await this.queryProgramFromWeb(packageName, platform);

      if (discovered) {
        this.discoveredPrograms.set(`${platform}:${packageName}`, discovered);

        // 4. 如果置信度高，自动学习
        if (discovered.confidence > 0.8) {
          await this.learnProgram(discovered);
          return {
            program: discovered,
            status: 'learned',
            message: '程序已自动学习',
          };
        }

        return {
          program: discovered,
          status: 'unknown',
          message: '需要更多信息',
        };
      }

      return {
        program: {
          packageName,
          name: packageName,
          platform,
          confidence: 0,
        },
        status: 'error',
        message: '无法获取程序信息',
      };
    } catch (error) {
      logger.error({ error, packageName }, 'Discovery failed');
      return {
        program: {
          packageName,
          name: packageName,
          platform,
          confidence: 0,
        },
        status: 'error',
        message: '查询失败',
      };
    }
  }

  /**
   * 从网上查询程序信息
   */
  private async queryProgramFromWeb(
    packageName: string,
    platform: DiscoveredProgram['platform']
  ): Promise<DiscoveredProgram | null> {
    // 构建搜索查询
    const searchQueries = this.buildSearchQueries(packageName, platform);

    for (const query of searchQueries) {
      try {
        // 使用浏览器代理搜索
        const result = await this.searchAndParse(query, platform);

        if (result) {
          return result;
        }
      } catch (error) {
        logger.debug({ query, error }, 'Search query failed');
      }
    }

    return null;
  }

  /**
   * 构建搜索查询
   */
  private buildSearchQueries(
    packageName: string,
    platform: DiscoveredProgram['platform']
  ): string[] {
    const queries: string[] = [];

    if (platform === 'android') {
      queries.push(`${packageName} android app deeplink scheme`);
      queries.push(`${packageName} google play`);
    } else if (platform === 'windows') {
      queries.push(`${packageName} windows app`);
      queries.push(`${packageName} microsoft store`);
    } else if (platform === 'macos') {
      queries.push(`${packageName} mac app`);
      queries.push(`${packageName} app store mac`);
    }

    // 添加API文档查询
    queries.push(`${packageName} deeplink scheme documentation`);
    queries.push(`${packageName} intent uri scheme`);

    return queries;
  }

  /**
   * 搜索并解析结果
   */
  private async searchAndParse(
    query: string,
    platform: DiscoveredProgram['platform']
  ): Promise<DiscoveredProgram | null> {
    try {
      // 简化的搜索 - 实际应该使用搜索引擎
      // 这里假设有一个搜索引擎可用

      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

      // 使用浏览器代理访问
      const pageSnapshot = await browserAgent.getPageSnapshot('default', searchUrl);

      if (!pageSnapshot) return null;

      // 解析页面内容提取信息
      const extracted = this.parseSearchResults(pageSnapshot.content);

      if (extracted.name) {
        return {
          packageName: extracted.packageName || query.split(' ')[0],
          name: extracted.name,
          platform,
          website: extracted.website,
          description: extracted.description,
          capabilities: extracted.capabilities,
          operations: extracted.operations,
          deeplink: extracted.deeplink,
          confidence: 0.6,
        };
      }

      return null;
    } catch (error) {
      logger.debug({ query, error }, 'Search and parse failed');
      return null;
    }
  }

  /**
   * 解析搜索结果
   */
  private parseSearchResults(content: string): Partial<DiscoveredProgram> & { packageName?: string } {
    const result: Partial<DiscoveredProgram> & { packageName?: string } = {};

    // 提取包名
    const packageMatch = content.match(/package[\s_-]?name[:\s]+([a-z0-9.]+)/i);
    if (packageMatch) {
      result.packageName = packageMatch[1];
    }

    // 提取名称
    const nameMatch = content.match(/(?:official\s+)?(?:app\s+name|name)[:\s]+([A-Z][a-zA-Z\s]+?)(?:\s|,|$)/i);
    if (nameMatch) {
      result.name = nameMatch[1].trim();
    }

    // 提取Deeplink
    const deeplinkMatch = content.match(/(?:deeplink|scheme|uri)[:\s]+([a-z]+:\/\/[^\s]+)/i);
    if (deeplinkMatch) {
      result.deeplink = deeplinkMatch[1];
    }

    // 提取网站
    const websiteMatch = content.match(/https?:\/\/[a-z0-9.-]+\.(?:com|org|io|app|dev)[^\s]*/i);
    if (websiteMatch) {
      result.website = websiteMatch[0];
    }

    // 提取描述
    const descMatch = content.match(/description[:\s]+([^.]+\.)/i);
    if (descMatch) {
      result.description = descMatch[1].trim();
    }

    // 提取能力关键词
    const capabilities: string[] = [];
    const capabilityKeywords = ['messaging', 'payment', 'navigation', 'camera', 'location', 'storage', 'network', 'social'];
    for (const keyword of capabilityKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        capabilities.push(keyword);
      }
    }
    if (capabilities.length > 0) {
      result.capabilities = capabilities;
    }

    return result;
  }

  /**
   * 将已知程序转换为发现格式
   */
  private knownToDiscovered(program: ProgramCapability): DiscoveredProgram {
    return {
      packageName: program.packageNames.android ||
                   program.packageNames.windows ||
                   program.packageNames.macos ||
                   program.id,
      name: program.name,
      platform: program.platforms[0] as DiscoveredProgram['platform'],
      description: program.description,
      capabilities: program.operations.map(op => op.name),
      operations: program.operations.map(op => op.description),
      deeplink: program.deeplink,
      confidence: 1.0,
    };
  }

  /**
   * 学习程序
   */
  private async learnProgram(discovered: DiscoveredProgram): Promise<void> {
    const operations = (discovered.operations || []).map((desc, index) => ({
      id: `op_${index}`,
      name: desc,
      description: desc,
      keywords: [desc],
      examples: [],
    }));

    const program: ProgramCapability = {
      id: discovered.packageName.toLowerCase(),
      name: discovered.name,
      category: 'other',
      description: discovered.description || discovered.name,
      keywords: [discovered.name.toLowerCase()],
      platforms: [discovered.platform],
      packageNames: {
        [discovered.platform]: discovered.packageName,
      },
      deeplink: discovered.deeplink,
      operations,
      lastUpdated: new Date(),
    };

    programKnowledgeBase.learnProgram(program);
    logger.info({ programId: program.id }, 'Program learned');
  }

  /**
   * 批量发现
   */
  public async batchDiscover(
    programs: Array<{ packageName: string; platform: DiscoveredProgram['platform'] }>
  ): Promise<Map<string, DiscoveryResult>> {
    const results = new Map<string, DiscoveryResult>();

    for (const { packageName, platform } of programs) {
      const result = await this.discoverProgram(packageName, platform);
      results.set(packageName, result);
    }

    return results;
  }

  /**
   * 获取已发现的程序
   */
  public getDiscoveredPrograms(): DiscoveredProgram[] {
    return Array.from(this.discoveredPrograms.values());
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.discoveredPrograms.clear();
    logger.info('Discovery cache cleared');
  }

  /**
   * 生成发现报告
   */
  public generateDiscoveryReport(): {
    total: number;
    byPlatform: Record<string, number>;
    confidence: {
      high: number;
      medium: number;
      low: number;
    };
    learned: number;
    pending: number;
  } {
    const programs = this.getDiscoveredPrograms();

    const byPlatform: Record<string, number> = {};
    let high = 0, medium = 0, low = 0;

    for (const program of programs) {
      byPlatform[program.platform] = (byPlatform[program.platform] || 0) + 1;

      if (program.confidence >= 0.8) high++;
      else if (program.confidence >= 0.5) medium++;
      else low++;
    }

    return {
      total: programs.length,
      byPlatform,
      confidence: { high, medium, low },
      learned: high,
      pending: medium + low,
    };
  }
}

export const programDiscoveryService = ProgramDiscoveryService.getInstance();
export default programDiscoveryService;
