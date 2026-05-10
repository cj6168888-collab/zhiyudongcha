#!/usr/bin/env node

/**
 * 依赖更新脚本
 * 安全地升级项目依赖，包括主版本、次版本和补丁版本
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface PackageUpdate {
  name: string;
  current: string;
  latest: string;
  type: 'major' | 'minor' | 'patch';
  breaking: boolean;
}

interface UpdatePlan {
  safe: PackageUpdate[];
  risky: PackageUpdate[];
  blocked: PackageUpdate[];
}

class DependencyUpdater {
  private packageJson: any;
  private originalPackageJson: string;

  constructor() {
    this.loadPackageJson();
  }

  private loadPackageJson(): void {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      this.originalPackageJson = readFileSync(packageJsonPath, 'utf-8');
      this.packageJson = JSON.parse(this.originalPackageJson);
    } catch (error) {
      console.error('❌ 无法读取package.json:', error);
      process.exit(1);
    }
  }

  private savePackageJson(): void {
    const packageJsonPath = join(process.cwd(), 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify(this.packageJson, null, 2) + '\n');
  }

  private restorePackageJson(): void {
    const packageJsonPath = join(process.cwd(), 'package.json');
    writeFileSync(packageJsonPath, this.originalPackageJson);
  }

  private execCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf-8' });
    } catch (error: any) {
      console.error(`❌ 命令执行失败: ${command}`);
      console.error(error.stdout || error.message);
      throw error;
    }
  }

  private checkOutdatedPackages(): PackageUpdate[] {
    console.log('🔍 检查过时的依赖...');
    
    try {
      const output = this.execCommand('npm outdated --json');
      const outdated = JSON.parse(output);
      
      const updates: PackageUpdate[] = [];
      
      for (const [name, info] of Object.entries(outdated as any)) {
        const current = (info as any).current;
        const latest = (info as any).latest;
        const wanted = (info as any).wanted;
        
        if (!current || !latest) continue;
        
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);
        
        let type: 'major' | 'minor' | 'patch';
        let breaking = false;
        
        if (latestParts[0] > currentParts[0]) {
          type = 'major';
          breaking = true;
        } else if (latestParts[1] > currentParts[1]) {
          type = 'minor';
          breaking = false;
        } else {
          type = 'patch';
          breaking = false;
        }
        
        updates.push({
          name,
          current,
          latest,
          type,
          breaking,
        });
      }
      
      return updates;
    } catch (error) {
      console.warn('⚠️ 无法检查过时的依赖，可能所有依赖都是最新的');
      return [];
    }
  }

  private analyzeSecurityIssues(): any[] {
    console.log('🔒 分析安全漏洞...');
    
    try {
      const output = this.execCommand('npm audit --json');
      const audit = JSON.parse(output);
      const vulnerabilities = audit.vulnerabilities || {};
      
      return Object.values(vulnerabilities).map((vuln: any) => ({
        name: vuln.name,
        severity: vuln.severity,
        title: vuln.title,
        url: vuln.url,
        fixAvailable: vuln.fixAvailable,
      }));
    } catch (error) {
      console.warn('⚠️ 无法分析安全漏洞');
      return [];
    }
  }

  private createUpdatePlan(updates: PackageUpdate[]): UpdatePlan {
    const plan: UpdatePlan = {
      safe: [],
      risky: [],
      blocked: [],
    };

    // 安全升级的包列表（根据项目经验）
    const safePackages = [
      'eslint', 'prettier', 'typescript', 'vitest', 'playwright',
      '@types/node', '@types/react', '@types/express',
      'tailwindcss', 'postcss', 'autoprefixer',
      'drizzle-kit', 'drizzle-orm',
    ];

    // 高风险包列表
    const riskyPackages = [
      'react', 'react-dom', 'express', 'node-fetch',
      'ws', 'socket.io', 'passport',
    ];

    for (const update of updates) {
      if (safePackages.includes(update.name)) {
        plan.safe.push(update);
      } else if (riskyPackages.includes(update.name) || update.breaking) {
        plan.risky.push(update);
      } else {
        plan.blocked.push(update);
      }
    }

    return plan;
  }

  private runTests(): boolean {
    console.log('🧪 运行测试...');
    
    try {
      this.execCommand('npm run test:run');
      console.log('✅ 所有测试通过');
      return true;
    } catch (error) {
      console.error('❌ 测试失败');
      return false;
    }
  }

  private updateDependencies(updates: PackageUpdate[]): void {
    if (updates.length === 0) {
      console.log('✅ 没有需要更新的依赖');
      return;
    }

    console.log(`📦 更新 ${updates.length} 个依赖...`);
    
    for (const update of updates) {
      console.log(`  - ${update.name}: ${update.current} → ${update.latest}`);
      
      if (this.packageJson.dependencies && this.packageJson.dependencies[update.name]) {
        this.packageJson.dependencies[update.name] = update.latest;
      }
      
      if (this.packageJson.devDependencies && this.packageJson.devDependencies[update.name]) {
        this.packageJson.devDependencies[update.name] = update.latest;
      }
    }
    
    this.savePackageJson();
    this.execCommand('npm install');
  }

  private async performSafeUpdate(plan: UpdatePlan): Promise<boolean> {
    if (plan.safe.length === 0) {
      console.log('✅ 没有需要安全更新的依赖');
      return true;
    }

    console.log(`🔒 执行安全更新 (${plan.safe.length} 个包)...`);
    
    try {
      this.updateDependencies(plan.safe);
      
      if (!this.runTests()) {
        console.log('❌ 安全更新后测试失败，回滚...');
        this.restorePackageJson();
        this.execCommand('npm install');
        return false;
      }
      
      console.log('✅ 安全更新完成');
      return true;
    } catch (error) {
      console.error('❌ 安全更新失败:', error);
      this.restorePackageJson();
      this.execCommand('npm install');
      return false;
    }
  }

  private async performRiskyUpdate(plan: UpdatePlan): Promise<void> {
    if (plan.risky.length === 0) {
      console.log('✅ 没有需要风险评估的依赖');
      return;
    }

    console.log(`⚠️ 风险评估更新 (${plan.risky.length} 个包):`);
    plan.risky.forEach(update => {
      console.log(`  - ${update.name}: ${update.current} → ${update.latest} (${update.type}, 破坏性变更: ${update.breaking})`);
    });

    console.log('\n📋 建议的手动更新步骤:');
    for (const update of plan.risky) {
      console.log(`1. 更新 ${update.name}`);
      console.log(`2. 运行 npm install`);
      console.log(`3. 检查 breaking changes: https://github.com/${update.name}/releases`);
      console.log(`4. 运行测试`);
      console.log(`5. 检查应用功能`);
      console.log('');
    }
  }

  private async performBlockedUpdate(plan: UpdatePlan): Promise<void> {
    if (plan.blocked.length === 0) {
      console.log('✅ 没有被阻止的依赖');
      return;
    }

    console.log(`🚫 阻止更新的依赖 (${plan.blocked.length} 个包):`);
    plan.blocked.forEach(update => {
      console.log(`  - ${update.name}: ${update.current} → ${update.latest}`);
      console.log(`    原因: 需要手动验证兼容性`);
    });
  }

  private generateReport(plan: UpdatePlan, vulnerabilities: any[]): void {
    console.log('\n📊 依赖更新报告');
    console.log('='.repeat(50));
    
    console.log(`✅ 安全更新: ${plan.safe.length} 个包`);
    if (plan.safe.length > 0) {
      plan.safe.forEach(update => {
        console.log(`  - ${update.name}: ${update.current} → ${update.latest}`);
      });
    }
    
    console.log(`⚠️ 风险更新: ${plan.risky.length} 个包`);
    if (plan.risky.length > 0) {
      plan.risky.forEach(update => {
        console.log(`  - ${update.name}: ${update.current} → ${update.latest} (${update.type})`);
      });
    }
    
    console.log(`🚫 阻止更新: ${plan.blocked.length} 个包`);
    
    if (vulnerabilities.length > 0) {
      console.log(`🔒 安全漏洞: ${vulnerabilities.length} 个`);
      vulnerabilities.forEach((vuln: any) => {
        console.log(`  - ${vuln.name}: ${vuln.severity} - ${vuln.title}`);
      });
    }
    
    console.log('\n📝 建议:');
    if (plan.safe.length > 0) {
      console.log('  - 已自动应用安全更新');
    }
    if (plan.risky.length > 0) {
      console.log('  - 手动评估风险更新中的包');
      console.log('  - 在测试环境中先进行验证');
    }
    if (vulnerabilities.length > 0) {
      console.log('  - 尽快修复安全漏洞');
      console.log('  - 运行 npm audit fix 自动修复可修复的漏洞');
    }
  }

  public async update(options: {
    safe?: boolean;
    risky?: boolean;
    all?: boolean;
  } = {}): Promise<void> {
    console.log('🚀 开始依赖更新流程...\n');
    
    try {
      // 检查过时的依赖
      const updates = this.checkOutdatedPackages();
      if (updates.length === 0) {
        console.log('✅ 所有依赖都是最新的');
        return;
      }
      
      // 分析安全漏洞
      const vulnerabilities = this.analyzeSecurityIssues();
      
      // 创建更新计划
      const plan = this.createUpdatePlan(updates);
      
      // 执行更新
      if (options.all || options.safe) {
        await this.performSafeUpdate(plan);
      }
      
      if (options.all || options.risky) {
        await this.performRiskyUpdate(plan);
      }
      
      if (!options.risky && !options.safe && !options.all) {
        await this.performSafeUpdate(plan);
        await this.performRiskyUpdate(plan);
        await this.performBlockedUpdate(plan);
      }
      
      // 生成报告
      this.generateReport(plan, vulnerabilities);
      
      console.log('\n✨ 依赖更新完成');
      
    } catch (error) {
      console.error('❌ 依赖更新过程中发生错误:', error);
      this.restorePackageJson();
      this.execCommand('npm install');
      process.exit(1);
    }
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const options = {
    safe: args.includes('--safe'),
    risky: args.includes('--risky'),
    all: args.includes('--all'),
  };
  
  const updater = new DependencyUpdater();
  await updater.update(options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}