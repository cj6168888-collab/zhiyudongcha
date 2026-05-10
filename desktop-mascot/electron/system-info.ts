import { ipcMain } from 'electron'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const cpus = os.cpus()
    
    let totalIdle = 0
    let totalTick = 0
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times]
      }
      totalIdle += cpu.times.idle
    }
    
    const idle = totalIdle / cpus.length
    const total = totalTick / cpus.length
    const usage = 100 - (idle / total) * 100
    
    resolve(Math.round(usage * 10) / 10)
  })
}

function getMemoryUsage(): number {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  
  return Math.round((used / total) * 1000) / 10
}

async function getDiskUsage(): Promise<number> {
  const platform = os.platform()
  
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:value')
      const lines = stdout.split('\n').filter(l => l.trim())
      
      let freeSpace = 0
      let totalSize = 0
      
      for (const line of lines) {
        if (line.startsWith('FreeSpace=')) {
          freeSpace = parseInt(line.split('=')[1])
        } else if (line.startsWith('Size=')) {
          totalSize = parseInt(line.split('=')[1])
        }
      }
      
      if (totalSize > 0) {
        return Math.round(((totalSize - freeSpace) / totalSize) * 1000) / 10
      }
    } else {
      const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $3/$2*100}'")
      return Math.round(parseFloat(stdout) * 10) / 10
    }
  } catch (error) {
    console.error('Failed to get disk usage:', error)
  }
  
  return 0
}

async function cleanTempFiles(): Promise<{
  freedSpace: number
  itemsCleaned: number
  details: string[]
}> {
  const result = {
    freedSpace: 0,
    itemsCleaned: 0,
    details: [] as string[],
  }

  const tempDirs = [
    os.tmpdir(),
    path.join(os.homedir(), 'AppData', 'Local', 'Temp'),
  ]

  for (const tempDir of tempDirs) {
    if (!fs.existsSync(tempDir)) continue
    
    try {
      const files = fs.readdirSync(tempDir)
      
      for (const file of files) {
        try {
          const filePath = path.join(tempDir, file)
          const stats = fs.statSync(filePath)
          
          const age = Date.now() - stats.mtimeMs
          if (age > 7 * 24 * 60 * 60 * 1000) {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true })
            } else {
              result.freedSpace += stats.size
              fs.unlinkSync(filePath)
            }
            result.itemsCleaned++
          }
        } catch (e) {
          // Skip files in use
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }

  result.details.push(`清理了 ${result.itemsCleaned} 个临时文件`)
  
  return result
}

async function cleanBrowserCache(): Promise<{
  freedSpace: number
  itemsCleaned: number
  details: string[]
}> {
  const result = {
    freedSpace: 0,
    itemsCleaned: 0,
    details: [] as string[],
  }

  const cachePaths = [
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
    path.join(os.homedir(), '.cache', 'google-chrome'),
    path.join(os.homedir(), '.cache', 'mozilla'),
  ]

  for (const cachePath of cachePaths) {
    if (!fs.existsSync(cachePath)) continue
    
    try {
      const stats = fs.statSync(cachePath)
      if (stats.isDirectory()) {
        const files = fs.readdirSync(cachePath)
        
        for (const file of files) {
          try {
            const filePath = path.join(cachePath, file)
            const fileStats = fs.statSync(filePath)
            
            if (fileStats.isFile()) {
              result.freedSpace += fileStats.size
              fs.unlinkSync(filePath)
              result.itemsCleaned++
            }
          } catch (e) {
            // Skip files in use
          }
        }
      }
    } catch (e) {
      // Skip inaccessible caches
    }
  }

  result.details.push(`清理了 ${result.itemsCleaned} 个浏览器缓存文件`)
  
  return result
}

async function emptyRecycleBin(): Promise<{
  freedSpace: number
  itemsCleaned: number
  details: string[]
}> {
  const result = {
    freedSpace: 0,
    itemsCleaned: 0,
    details: [] as string[],
  }

  const platform = os.platform()
  
  try {
    if (platform === 'win32') {
      await execAsync('PowerShell.exe -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"')
      result.details.push('已清空回收站')
    } else if (platform === 'darwin') {
      const trashPath = path.join(os.homedir(), '.Trash')
      if (fs.existsSync(trashPath)) {
        const files = fs.readdirSync(trashPath)
        for (const file of files) {
          try {
            const filePath = path.join(trashPath, file)
            const stats = fs.statSync(filePath)
            result.freedSpace += stats.size
            fs.rmSync(filePath, { recursive: true, force: true })
            result.itemsCleaned++
          } catch (e) {
            // Skip
          }
        }
      }
      result.details.push('已清空废纸篓')
    } else {
      const trashPath = path.join(os.homedir(), '.local', 'share', 'Trash', 'files')
      if (fs.existsSync(trashPath)) {
        const files = fs.readdirSync(trashPath)
        for (const file of files) {
          try {
            const filePath = path.join(trashPath, file)
            fs.rmSync(filePath, { recursive: true, force: true })
            result.itemsCleaned++
          } catch (e) {
            // Skip
          }
        }
      }
      result.details.push('已清空回收站')
    }
  } catch (error) {
    result.details.push('清空回收站时遇到问题')
  }

  return result
}

export function setupSystemInfoHandlers() {
  ipcMain.handle('get-system-info', async () => {
    const [cpuUsage, diskUsage] = await Promise.all([
      getCpuUsage(),
      getDiskUsage(),
    ])

    return {
      platform: os.platform(),
      cpuUsage,
      memoryUsage: getMemoryUsage(),
      diskUsage,
      uptime: os.uptime(),
    }
  })

  ipcMain.handle('clean-temp-files', cleanTempFiles)
  ipcMain.handle('clean-browser-cache', cleanBrowserCache)
  ipcMain.handle('empty-recycle-bin', emptyRecycleBin)
}
