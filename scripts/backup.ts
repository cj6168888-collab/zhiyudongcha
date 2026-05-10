import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

interface BackupMetadata {
  timestamp: string;
  type: 'full' | 'code' | 'database';
  gitCommit: string;
  gitBranch: string;
  databaseBackupFile?: string;
  codeTag?: string;
}

function getGitInfo(): { commit: string; branch: string } {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { commit, branch };
  } catch {
    return { commit: 'unknown', branch: 'unknown' };
  }
}

function createBackupTag(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const tagName = `backup-${timestamp}`;
  
  try {
    execSync(`git tag ${tagName}`, { encoding: 'utf-8' });
    console.log(`  ✅ Git标签创建成功: ${tagName}`);
    return tagName;
  } catch (error) {
    console.log(`  ⚠️  Git标签创建失败 (可能已存在): ${error}`);
    return tagName;
  }
}

async function backupDatabase(): Promise<string | null> {
  const backupDir = path.join(process.cwd(), 'backups');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `db-${timestamp}.sql`);
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('  ⚠️  DATABASE_URL未设置，跳过数据库备份');
    return null;
  }
  
  try {
    console.log('  正在备份数据库...');
    execSync(`pg_dump "${databaseUrl}" > "${backupFile}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`  ✅ 数据库备份成功: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.log(`  ⚠️  数据库备份失败: ${error}`);
    return null;
  }
}

function saveSystemSnapshot(): void {
  const snapshotDir = path.join(process.cwd(), 'backups', 'snapshots');
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotFile = path.join(snapshotDir, `snapshot-${timestamp}.json`);
  
  const snapshot = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    git: getGitInfo(),
    files: {
      serverRoutes: countFiles('server/routes'),
      serverServices: countFiles('server/services'),
      tests: countFiles('tests'),
    },
  };
  
  writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
  console.log(`  ✅ 系统快照保存成功: ${snapshotFile}`);
}

function countFiles(dir: string): number {
  try {
    const result = execSync(`find ${dir} -type f -name "*.ts" | wc -l`, { encoding: 'utf-8' });
    return parseInt(result.trim(), 10);
  } catch {
    return 0;
  }
}

async function runBackup(type: 'full' | 'code' | 'database' = 'full') {
  console.log('='.repeat(60));
  console.log('  小智系统备份工具');
  console.log('='.repeat(60));
  console.log(`\n  备份类型: ${type}`);
  console.log(`  时间: ${new Date().toISOString()}`);
  
  const gitInfo = getGitInfo();
  console.log(`\n  Git状态:`);
  console.log(`  - 分支: ${gitInfo.branch}`);
  console.log(`  - 提交: ${gitInfo.commit.substring(0, 8)}`);
  
  const metadata: BackupMetadata = {
    timestamp: new Date().toISOString(),
    type,
    gitCommit: gitInfo.commit,
    gitBranch: gitInfo.branch,
  };
  
  if (type === 'full' || type === 'code') {
    console.log('\n  [1/3] 创建代码备份标签...');
    metadata.codeTag = createBackupTag();
    
    console.log('\n  [2/3] 保存系统快照...');
    saveSystemSnapshot();
  }
  
  if (type === 'full' || type === 'database') {
    console.log('\n  [3/3] 备份数据库...');
    const dbBackup = await backupDatabase();
    if (dbBackup) {
      metadata.databaseBackupFile = dbBackup;
    }
  }
  
  const metadataDir = path.join(process.cwd(), 'backups');
  if (!existsSync(metadataDir)) {
    mkdirSync(metadataDir, { recursive: true });
  }
  
  const metadataFile = path.join(metadataDir, 'latest-backup.json');
  writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('  ✅ 备份完成');
  console.log('='.repeat(60));
  console.log(`\n  元数据保存至: ${metadataFile}`);
}

const args = process.argv.slice(2);
const backupType = (args[0] as 'full' | 'code' | 'database') || 'full';

runBackup(backupType).catch(console.error);
