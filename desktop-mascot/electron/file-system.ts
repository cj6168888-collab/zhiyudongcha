import { app, ipcMain, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

const FILE_CATEGORIES: Record<string, string[]> = {
  '文档': ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
  '图片': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff'],
  '视频': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  '音乐': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  '压缩包': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  '代码': ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.json', '.xml'],
  '安装包': ['.exe', '.msi', '.dmg', '.deb', '.rpm', '.apk'],
}

function getDesktopPath(): string {
  return path.join(os.homedir(), 'Desktop')
}

function getFileCategory(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category
    }
  }
  
  return '其他'
}

function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    
    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export function setupFileSystemHandlers() {
  ipcMain.handle('list-desktop-files', async () => {
    const desktopPath = getDesktopPath()
    
    try {
      const files = fs.readdirSync(desktopPath)
      
      return files
        .filter(file => !file.startsWith('.'))
        .map(file => {
          const filePath = path.join(desktopPath, file)
          const stats = fs.statSync(filePath)
          
          return {
            name: file,
            path: filePath,
            size: stats.size,
            type: stats.isDirectory() ? 'folder' : getFileCategory(file),
            modifiedTime: stats.mtimeMs,
          }
        })
    } catch (error) {
      console.error('Failed to list desktop files:', error)
      return []
    }
  })

  ipcMain.handle('organize-desktop', async () => {
    const desktopPath = getDesktopPath()
    const result = {
      moved: 0,
      categories: {} as Record<string, string[]>,
    }

    try {
      const files = fs.readdirSync(desktopPath)
      
      for (const file of files) {
        if (file.startsWith('.')) continue
        
        const filePath = path.join(desktopPath, file)
        const stats = fs.statSync(filePath)
        
        if (stats.isDirectory()) continue
        
        const category = getFileCategory(file)
        const categoryFolder = path.join(desktopPath, category)
        
        if (!fs.existsSync(categoryFolder)) {
          fs.mkdirSync(categoryFolder, { recursive: true })
        }
        
        const newPath = path.join(categoryFolder, file)
        
        if (!fs.existsSync(newPath)) {
          fs.renameSync(filePath, newPath)
          result.moved++
          
          if (!result.categories[category]) {
            result.categories[category] = []
          }
          result.categories[category].push(file)
        }
      }
    } catch (error) {
      console.error('Failed to organize desktop:', error)
    }

    return result
  })

  ipcMain.handle('find-duplicates', async (_event, directory?: string) => {
    const searchPath = directory || os.homedir()
    const fileHashes = new Map<string, { path: string; size: number }[]>()
    
    const result = {
      groups: [] as { hash: string; files: { path: string; size: number }[] }[],
      totalDuplicates: 0,
      potentialSavings: 0,
    }

    async function scanDirectory(dir: string, depth = 0) {
      if (depth > 3) return
      
      try {
        const files = fs.readdirSync(dir)
        
        for (const file of files) {
          if (file.startsWith('.')) continue
          
          const filePath = path.join(dir, file)
          
          try {
            const stats = fs.statSync(filePath)
            
            if (stats.isDirectory()) {
              await scanDirectory(filePath, depth + 1)
            } else if (stats.size > 1024) {
              const hash = await getFileHash(filePath)
              
              if (!fileHashes.has(hash)) {
                fileHashes.set(hash, [])
              }
              fileHashes.get(hash)!.push({ path: filePath, size: stats.size })
            }
          } catch (e) {
            // Skip files we can't access
          }
        }
      } catch (e) {
        // Skip directories we can't access
      }
    }

    await scanDirectory(searchPath)

    for (const [hash, files] of fileHashes) {
      if (files.length > 1) {
        result.groups.push({ hash, files })
        result.totalDuplicates += files.length - 1
        result.potentialSavings += files[0].size * (files.length - 1)
      }
    }

    return result
  })

  ipcMain.handle('find-large-files', async (_event, minSizeMB = 100) => {
    const minSize = minSizeMB * 1024 * 1024
    const largeFiles: { name: string; path: string; size: number }[] = []

    function scanDirectory(dir: string, depth = 0) {
      if (depth > 4) return
      
      try {
        const files = fs.readdirSync(dir)
        
        for (const file of files) {
          if (file.startsWith('.')) continue
          
          const filePath = path.join(dir, file)
          
          try {
            const stats = fs.statSync(filePath)
            
            if (stats.isDirectory()) {
              scanDirectory(filePath, depth + 1)
            } else if (stats.size >= minSize) {
              largeFiles.push({
                name: file,
                path: filePath,
                size: stats.size,
              })
            }
          } catch (e) {
            // Skip inaccessible files
          }
        }
      } catch (e) {
        // Skip inaccessible directories
      }
    }

    scanDirectory(os.homedir())
    
    return largeFiles.sort((a, b) => b.size - a.size).slice(0, 50)
  })

  ipcMain.handle('open-file', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath)
      return true
    } catch (error) {
      console.error('Failed to open file:', error)
      return false
    }
  })

  ipcMain.handle('show-in-folder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return true
    } catch (error) {
      console.error('Failed to show in folder:', error)
      return false
    }
  })

  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    try {
      await shell.trashItem(filePath)
      return true
    } catch (error) {
      console.error('Failed to delete file:', error)
      return false
    }
  })
}
