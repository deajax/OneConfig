import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'
import fs from 'fs-extra'

const MANAGED_FILES_PATH = join(app.getPath('userData'), 'managed-files.json')

interface ManagedFile {
  id: string
  name: string
  path: string
  addedAt: number
}

async function loadManagedFiles(): Promise<ManagedFile[]> {
  try {
    if (await fs.pathExists(MANAGED_FILES_PATH)) {
      const raw = await fs.readFile(MANAGED_FILES_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch {}
  return []
}

async function saveManagedFiles(files: ManagedFile[]): Promise<void> {
  await fs.writeFile(MANAGED_FILES_PATH, JSON.stringify(files, null, 2), 'utf-8')
}

function validateFilePath(filePath: string): boolean {
  return typeof filePath === 'string' && filePath.length > 0 && !filePath.includes('\0')
}

function generateId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function registerJsonHandlers(win: BrowserWindow) {
  ipcMain.handle('json:open', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: '打开配置文件',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile', 'showHiddenFiles']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')
    return { filePath, content }
  })

  ipcMain.handle('json:openRecent', async (_e, { filePath }: { filePath: string }) => {
    if (!validateFilePath(filePath)) return null
    if (!(await fs.pathExists(filePath))) return null
    const content = await fs.readFile(filePath, 'utf-8')
    return { filePath, content }
  })

  ipcMain.handle('json:openContent', async (_e, { fileName, content }: { fileName: string; content: string }) => {
    if (typeof content !== 'string') return null
    return { filePath: '', fileName: fileName || 'untitled.json', content }
  })

  ipcMain.handle('json:save', async (_e, { filePath, content }: { filePath: string; content: string }) => {
    if (!validateFilePath(filePath)) return { success: false }
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  })

  ipcMain.handle('json:saveAs', async (_e, { content }: { content: string }) => {
    const result = await dialog.showSaveDialog(win, {
      title: '另存为',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['showHiddenFiles']
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, content, 'utf-8')
    return { filePath: result.filePath }
  })

  ipcMain.handle('json:listManaged', async () => {
    return await loadManagedFiles()
  })

  ipcMain.handle('json:addManaged', async (_e, { filePath }: { filePath: string }) => {
    if (!validateFilePath(filePath)) return null
    if (!(await fs.pathExists(filePath))) return null

    const files = await loadManagedFiles()
    const exists = files.find((f) => f.path === filePath)
    if (exists) return exists

    const name = filePath.replace(/\\/g, '/').split('/').pop() || filePath
    const newFile: ManagedFile = {
      id: generateId(),
      name,
      path: filePath,
      addedAt: Date.now()
    }
    files.push(newFile)
    await saveManagedFiles(files)
    return newFile
  })

  ipcMain.handle('json:removeManaged', async (_e, { id }: { id: string }) => {
    const files = await loadManagedFiles()
    const filtered = files.filter((f) => f.id !== id)
    if (filtered.length === files.length) return { success: false }
    await saveManagedFiles(filtered)
    return { success: true }
  })
}
