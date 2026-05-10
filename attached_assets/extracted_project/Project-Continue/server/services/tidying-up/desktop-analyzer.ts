/**
 * 断舍离协议 - 桌面视觉分析器
 * 
 * 功能：
 * 1. 分析桌面截图，识别图标混乱度
 * 2. 检测快捷方式、临时文件、重复图标
 * 3. 生成整理建议和分组方案
 * 4. 支持Windows/macOS/Linux桌面
 */

import vllmGrounding from '../vllm-grounding';

export interface DesktopIcon {
  name: string;
  type: 'shortcut' | 'file' | 'folder' | 'temp' | 'unknown';
  position: { x: number; y: number };
  category?: string;
  isDuplicate?: boolean;
  isTemp?: boolean;
}

export interface DesktopAnalysisResult {
  icons: DesktopIcon[];
  clutterScore: number;
  totalIcons: number;
  categories: Record<string, number>;
  issues: DesktopIssue[];
  suggestions: TidySuggestion[];
  layout: DesktopLayout;
  timestamp: number;
}

export interface DesktopIssue {
  type: 'duplicate' | 'temp_file' | 'broken_shortcut' | 'clutter' | 'misplaced';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedItems: string[];
  recommendation: string;
}

export interface TidySuggestion {
  id: string;
  action: 'group' | 'delete' | 'move' | 'rename' | 'archive';
  priority: number;
  title: string;
  description: string;
  affectedItems: string[];
  targetLocation?: string;
  estimatedImpact: string;
}

export interface DesktopLayout {
  screenWidth: number;
  screenHeight: number;
  iconDensity: number;
  freeSpace: number;
  distribution: 'even' | 'clustered' | 'scattered';
}

export interface GroupingSuggestion {
  groupName: string;
  items: string[];
  folderPath: string;
  reason: string;
}

const DESKTOP_ANALYSIS_PROMPT = `分析这张桌面截图，识别所有图标并评估整洁度。

返回JSON格式：
{
  "icons": [
    {
      "name": "图标名称",
      "type": "shortcut/file/folder/temp/unknown",
      "position": {"x": 0, "y": 0},
      "category": "工作/娱乐/系统/开发/文档/其他"
    }
  ],
  "layout": {
    "distribution": "even/clustered/scattered",
    "iconDensity": 0-100,
    "freeSpace": 0-100
  },
  "issues": [
    {
      "type": "duplicate/temp_file/clutter/misplaced",
      "description": "问题描述",
      "items": ["相关项目"]
    }
  ],
  "overallClutter": 0-100,
  "summary": "桌面整洁度概述"
}

分析要点：
1. 识别临时文件（.tmp, ~开头, 副本等）
2. 发现重复快捷方式
3. 评估图标分布密度
4. 识别可分组的相关图标
5. 检测过期/无用快捷方式`;

const GROUPING_PROMPT = `基于以下桌面图标列表，生成分组整理建议：

图标列表:
{icons}

请返回JSON格式的分组建议：
{
  "groups": [
    {
      "groupName": "建议的文件夹名",
      "items": ["图标1", "图标2"],
      "reason": "分组原因"
    }
  ],
  "deleteRecommendations": ["应删除的项目"],
  "keepOnDesktop": ["应保留在桌面的项目"]
}

分组原则：
1. 相同类型的应用放一起（如：开发工具、办公软件）
2. 临时文件建议删除
3. 常用程序可保留在桌面
4. 不常用的移入文件夹`;

export class DesktopAnalyzer {
  private analysisCache: Map<string, DesktopAnalysisResult> = new Map();
  private cacheTimeout: number = 60000;

  async analyzeDesktop(screenshot: string): Promise<DesktopAnalysisResult> {
    const cacheKey = screenshot.substring(0, 100);
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached;
    }

    try {
      const analysis = await vllmGrounding.analyzeScreen(screenshot);
      
      const icons = this.extractIcons(analysis);
      const issues = this.detectIssues(icons);
      const suggestions = await this.generateSuggestions(icons, issues);
      const clutterScore = this.calculateClutterScore(icons, issues);
      const categories = this.categorizeIcons(icons);
      
      const result: DesktopAnalysisResult = {
        icons,
        clutterScore,
        totalIcons: icons.length,
        categories,
        issues,
        suggestions,
        layout: {
          screenWidth: analysis.layout.screenWidth,
          screenHeight: analysis.layout.screenHeight,
          iconDensity: this.calculateDensity(icons, analysis.layout),
          freeSpace: 100 - this.calculateDensity(icons, analysis.layout),
          distribution: this.detectDistribution(icons),
        },
        timestamp: Date.now(),
      };

      this.analysisCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[DesktopAnalyzer] Analysis failed:', error);
      return this.createEmptyResult();
    }
  }

  async analyzeWithAI(screenshot: string): Promise<DesktopAnalysisResult> {
    try {
      const analysis = await vllmGrounding.analyzeScreen(screenshot);
      
      const icons: DesktopIcon[] = analysis.elements.map((el: any) => ({
        name: el.label || 'Unknown',
        type: this.determineIconType(el.label, el.type),
        position: el.coordinates || { x: 0, y: 0 },
        category: this.guessCategory(el.label),
        isDuplicate: false,
        isTemp: this.isTempFile(el.label),
      }));

      this.markDuplicates(icons);
      const issues = this.detectIssues(icons);
      const suggestions = await this.generateSuggestions(icons, issues);
      const categories = this.categorizeIcons(icons);
      const clutterScore = this.calculateClutterScore(icons, issues);

      return {
        icons,
        clutterScore,
        totalIcons: icons.length,
        categories,
        issues,
        suggestions,
        layout: {
          screenWidth: analysis.layout.screenWidth,
          screenHeight: analysis.layout.screenHeight,
          iconDensity: this.calculateDensity(icons, analysis.layout),
          freeSpace: 100 - this.calculateDensity(icons, analysis.layout),
          distribution: this.detectDistribution(icons),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[DesktopAnalyzer] AI analysis failed:', error);
      return this.createEmptyResult();
    }
  }

  async generateGroupingSuggestions(icons: DesktopIcon[]): Promise<GroupingSuggestion[]> {
    return this.generateDefaultGroups(icons);
  }

  private async _generateGroupingSuggestionsWithAI(icons: DesktopIcon[]): Promise<GroupingSuggestion[]> {
    const iconList = icons.map(i => `${i.name} (${i.type}, ${i.category || '未分类'})`).join('\n');
    
    try {
      const _prompt = GROUPING_PROMPT.replace('{icons}', iconList);
      const response = '';
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.generateDefaultGroups(icons);
      }

      const data = JSON.parse(jsonMatch[0]);
      
      return (data.groups || []).map((g: any) => ({
        groupName: g.groupName,
        items: g.items,
        folderPath: `Desktop/${g.groupName}`,
        reason: g.reason,
      }));
    } catch (error) {
      console.error('[DesktopAnalyzer] Grouping suggestion failed:', error);
      return this.generateDefaultGroups(icons);
    }
  }

  private extractIcons(analysis: any): DesktopIcon[] {
    return (analysis.elements || []).map((el: any) => ({
      name: el.label || 'Unknown',
      type: this.determineIconType(el.label, el.type),
      position: el.coordinates || { x: 0, y: 0 },
      category: this.guessCategory(el.label),
      isDuplicate: false,
      isTemp: this.isTempFile(el.label),
    }));
  }

  private determineIconType(name: string, elementType: string): DesktopIcon['type'] {
    if (!name) return 'unknown';
    
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('.lnk') || lowerName.includes('快捷') || lowerName.includes('shortcut')) {
      return 'shortcut';
    }
    if (lowerName.endsWith('.tmp') || lowerName.startsWith('~') || lowerName.includes('副本')) {
      return 'temp';
    }
    if (elementType === 'container' || lowerName.includes('文件夹') || lowerName.includes('folder')) {
      return 'folder';
    }
    if (lowerName.includes('.')) {
      return 'file';
    }
    
    return 'shortcut';
  }

  private isTempFile(name: string): boolean {
    if (!name) return false;
    const lowerName = name.toLowerCase();
    return (
      lowerName.endsWith('.tmp') ||
      lowerName.startsWith('~') ||
      lowerName.includes('副本') ||
      lowerName.includes(' copy') ||
      lowerName.includes('(1)') ||
      lowerName.includes('(2)') ||
      lowerName.match(/\(\d+\)/) !== null
    );
  }

  private markDuplicates(icons: DesktopIcon[]): void {
    const nameCount = new Map<string, number>();
    
    for (const icon of icons) {
      const baseName = this.getBaseName(icon.name);
      nameCount.set(baseName, (nameCount.get(baseName) || 0) + 1);
    }
    
    for (const icon of icons) {
      const baseName = this.getBaseName(icon.name);
      if ((nameCount.get(baseName) || 0) > 1) {
        icon.isDuplicate = true;
      }
    }
  }

  private getBaseName(name: string): string {
    return name
      .replace(/\([0-9]+\)/g, '')
      .replace(/-\s*副本/g, '')
      .replace(/\s*copy\s*\d*/gi, '')
      .replace(/\.lnk$/i, '')
      .trim()
      .toLowerCase();
  }

  private guessCategory(name: string): string {
    if (!name) return '其他';
    const lowerName = name.toLowerCase();
    
    const categoryMap: Record<string, string[]> = {
      '开发': ['code', 'visual studio', 'vscode', 'idea', 'pycharm', 'webstorm', 'android', 'xcode', 'git', 'terminal', 'iterm', 'sublime', 'atom', 'notepad++', 'postman', 'docker', 'mysql', 'mongodb', 'redis'],
      '办公': ['word', 'excel', 'powerpoint', 'outlook', 'teams', 'zoom', 'slack', 'notion', 'evernote', '飞书', '钉钉', '企业微信', 'wps', 'pdf', 'acrobat'],
      '浏览器': ['chrome', 'firefox', 'safari', 'edge', 'opera', 'brave', '浏览器'],
      '娱乐': ['spotify', 'music', '音乐', 'steam', 'game', '游戏', 'netflix', 'youtube', 'bilibili', '视频', 'vlc', 'itunes'],
      '通讯': ['wechat', '微信', 'qq', 'telegram', 'whatsapp', 'discord', 'skype', 'line', 'messenger'],
      '系统': ['settings', '设置', 'control', '控制面板', 'system', 'finder', 'explorer', '回收站', 'recycle', 'trash'],
      '设计': ['photoshop', 'illustrator', 'figma', 'sketch', 'xd', 'indesign', 'lightroom', 'premiere', 'after effects', 'blender', 'canva'],
    };
    
    for (const [category, keywords] of Object.entries(categoryMap)) {
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) {
          return category;
        }
      }
    }
    
    return '其他';
  }

  private detectIssues(icons: DesktopIcon[]): DesktopIssue[] {
    const issues: DesktopIssue[] = [];
    
    const tempFiles = icons.filter(i => i.isTemp);
    if (tempFiles.length > 0) {
      issues.push({
        type: 'temp_file',
        severity: tempFiles.length > 3 ? 'high' : 'medium',
        description: `发现 ${tempFiles.length} 个临时文件`,
        affectedItems: tempFiles.map(i => i.name),
        recommendation: '建议删除这些临时文件以保持桌面整洁',
      });
    }
    
    const duplicates = icons.filter(i => i.isDuplicate);
    if (duplicates.length > 0) {
      issues.push({
        type: 'duplicate',
        severity: 'medium',
        description: `发现 ${duplicates.length} 个重复项`,
        affectedItems: duplicates.map(i => i.name),
        recommendation: '保留最新版本，删除重复的快捷方式',
      });
    }
    
    if (icons.length > 30) {
      issues.push({
        type: 'clutter',
        severity: 'high',
        description: `桌面图标过多 (${icons.length} 个)`,
        affectedItems: [],
        recommendation: '建议将不常用的项目整理到文件夹中',
      });
    } else if (icons.length > 20) {
      issues.push({
        type: 'clutter',
        severity: 'medium',
        description: `桌面图标较多 (${icons.length} 个)`,
        affectedItems: [],
        recommendation: '可以考虑将相关图标分组整理',
      });
    }
    
    return issues;
  }

  private async generateSuggestions(icons: DesktopIcon[], issues: DesktopIssue[]): Promise<TidySuggestion[]> {
    const suggestions: TidySuggestion[] = [];
    let priority = 1;
    
    const tempFiles = icons.filter(i => i.isTemp);
    if (tempFiles.length > 0) {
      suggestions.push({
        id: `delete_temp_${Date.now()}`,
        action: 'delete',
        priority: priority++,
        title: '清理临时文件',
        description: `删除 ${tempFiles.length} 个临时/副本文件`,
        affectedItems: tempFiles.map(i => i.name),
        estimatedImpact: '释放桌面空间，提升整洁度',
      });
    }
    
    const duplicates = icons.filter(i => i.isDuplicate);
    if (duplicates.length > 0) {
      suggestions.push({
        id: `remove_duplicates_${Date.now()}`,
        action: 'delete',
        priority: priority++,
        title: '移除重复项',
        description: `清理 ${duplicates.length} 个重复的图标`,
        affectedItems: duplicates.map(i => i.name),
        estimatedImpact: '减少视觉混乱',
      });
    }
    
    const categories = this.categorizeIcons(icons.filter(i => !i.isTemp && !i.isDuplicate));
    for (const [category, count] of Object.entries(categories)) {
      if (category !== '其他' && count >= 3) {
        const categoryIcons = icons.filter(i => i.category === category && !i.isTemp);
        suggestions.push({
          id: `group_${category}_${Date.now()}`,
          action: 'group',
          priority: priority++,
          title: `整理${category}类应用`,
          description: `将 ${count} 个${category}相关图标整理到文件夹`,
          affectedItems: categoryIcons.map(i => i.name),
          targetLocation: `Desktop/${category}`,
          estimatedImpact: `减少 ${count - 1} 个桌面图标`,
        });
      }
    }
    
    if (icons.length > 20) {
      const lessUsedIcons = icons.filter(i => !['系统', '浏览器'].includes(i.category || ''));
      suggestions.push({
        id: `archive_unused_${Date.now()}`,
        action: 'archive',
        priority: priority++,
        title: '归档不常用项目',
        description: '将不常用的图标移至归档文件夹',
        affectedItems: lessUsedIcons.slice(0, 10).map(i => i.name),
        targetLocation: 'Desktop/Archive',
        estimatedImpact: '大幅提升桌面整洁度',
      });
    }
    
    return suggestions;
  }

  private calculateClutterScore(icons: DesktopIcon[], issues: DesktopIssue[]): number {
    let score = 0;
    
    if (icons.length <= 10) score += 0;
    else if (icons.length <= 20) score += 20;
    else if (icons.length <= 30) score += 40;
    else if (icons.length <= 50) score += 60;
    else score += 80;
    
    const tempCount = icons.filter(i => i.isTemp).length;
    score += Math.min(tempCount * 5, 20);
    
    const duplicateCount = icons.filter(i => i.isDuplicate).length;
    score += Math.min(duplicateCount * 3, 15);
    
    const issueScore = issues.reduce((sum, issue) => {
      switch (issue.severity) {
        case 'high': return sum + 10;
        case 'medium': return sum + 5;
        case 'low': return sum + 2;
        default: return sum;
      }
    }, 0);
    score += Math.min(issueScore, 20);
    
    return Math.min(100, Math.max(0, score));
  }

  private categorizeIcons(icons: DesktopIcon[]): Record<string, number> {
    const categories: Record<string, number> = {};
    for (const icon of icons) {
      const cat = icon.category || '其他';
      categories[cat] = (categories[cat] || 0) + 1;
    }
    return categories;
  }

  private calculateDensity(icons: DesktopIcon[], layout: any): number {
    const iconArea = icons.length * 80 * 80;
    const screenArea = (layout.screenWidth || 1920) * (layout.screenHeight || 1080);
    return Math.min(100, (iconArea / screenArea) * 100 * 10);
  }

  private detectDistribution(icons: DesktopIcon[]): 'even' | 'clustered' | 'scattered' {
    if (icons.length < 5) return 'even';
    
    const xCoords = icons.map(i => i.position.x);
    const yCoords = icons.map(i => i.position.y);
    
    const xVariance = this.calculateVariance(xCoords);
    const yVariance = this.calculateVariance(yCoords);
    
    const avgVariance = (xVariance + yVariance) / 2;
    
    if (avgVariance < 50000) return 'clustered';
    if (avgVariance > 200000) return 'scattered';
    return 'even';
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private calculateSeverity(issueType: string): 'low' | 'medium' | 'high' {
    switch (issueType) {
      case 'duplicate':
      case 'temp_file':
        return 'medium';
      case 'clutter':
        return 'high';
      case 'misplaced':
        return 'low';
      default:
        return 'low';
    }
  }

  private getRecommendation(issueType: string): string {
    switch (issueType) {
      case 'duplicate':
        return '保留一个快捷方式，删除其他重复项';
      case 'temp_file':
        return '删除临时文件以保持桌面整洁';
      case 'clutter':
        return '将相关图标分组到文件夹中';
      case 'misplaced':
        return '将文件移动到正确的位置';
      default:
        return '建议整理以提升工作效率';
    }
  }

  private generateDefaultGroups(icons: DesktopIcon[]): GroupingSuggestion[] {
    const groups: GroupingSuggestion[] = [];
    const categories = this.categorizeIcons(icons);
    
    for (const [category, count] of Object.entries(categories)) {
      if (category !== '其他' && count >= 2) {
        const categoryIcons = icons.filter(i => i.category === category);
        groups.push({
          groupName: category,
          items: categoryIcons.map(i => i.name),
          folderPath: `Desktop/${category}`,
          reason: `将 ${count} 个${category}相关应用整理在一起`,
        });
      }
    }
    
    return groups;
  }

  private createEmptyResult(): DesktopAnalysisResult {
    return {
      icons: [],
      clutterScore: 0,
      totalIcons: 0,
      categories: {},
      issues: [],
      suggestions: [],
      layout: {
        screenWidth: 1920,
        screenHeight: 1080,
        iconDensity: 0,
        freeSpace: 100,
        distribution: 'even',
      },
      timestamp: Date.now(),
    };
  }

  clearCache(): void {
    this.analysisCache.clear();
  }
}

export const desktopAnalyzer = new DesktopAnalyzer();
