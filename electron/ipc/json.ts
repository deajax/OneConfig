import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'
import fs from 'fs-extra'

const TEMPLATES_DIR = join(__dirname, '../../public/templates')
const USER_DATA_TEMPLATES = join(app.getPath('userData'), 'templates')
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
      // showHiddenFiles 让用户可以看到 . 开头的隐藏目录（如 ~/.config）
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

  // 渲染层通过 FileReader 读取内容后直接传入（拖拽无路径场景）
  ipcMain.handle('json:openContent', async (_e, { fileName, content }: { fileName: string; content: string }) => {
    if (typeof content !== 'string') return null
    // 无真实路径，filePath 为空字符串，由用户稍后「另存为」保存到磁盘
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

  ipcMain.handle('json:listTemplates', async () => {
    // 首次启动时将内置模板复制到 userData
    await fs.ensureDir(USER_DATA_TEMPLATES)
    const builtin = await fs.readdir(TEMPLATES_DIR).catch(() => [] as string[])
    for (const f of builtin) {
      const dest = join(USER_DATA_TEMPLATES, f)
      if (!(await fs.pathExists(dest))) {
        await fs.copy(join(TEMPLATES_DIR, f), dest)
      }
    }
    const files = await fs.readdir(USER_DATA_TEMPLATES).catch(() => [] as string[])
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
  })

  ipcMain.handle('json:loadTemplate', async (_e, { name }: { name: string }) => {
    if (!name || /[/\\]/.test(name)) return null
    const schemaPath = join(USER_DATA_TEMPLATES, `${name}.json`)
    if (!(await fs.pathExists(schemaPath))) return null
    const raw = await fs.readFile(schemaPath, 'utf-8')
    const tpl = JSON.parse(raw)
    return { schema: tpl.schema ?? {}, defaults: tpl.defaults ?? {} }
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
