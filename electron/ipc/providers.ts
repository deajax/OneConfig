import { ipcMain, app, BrowserWindow } from 'electron'
import fs from 'fs-extra'
import { homedir } from 'os'
import { join, extname } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
const execAsync = promisify(exec)

// 开发环境：项目下的 src/renderer/data/，方便 IDE 编辑
// 生产环境：用户主目录下的 ~/.OneConfig/，参照 Claude/OpenCode 做法
const isDev = !app.isPackaged
const ONECONFIG_DIR = isDev
  ? join(app.getAppPath(), 'src/renderer/data')
  : join(homedir(), '.OneConfig')
const PROVIDERS_PATH = join(ONECONFIG_DIR, 'providers.json')
const BLOCK_START = '# >>> OneConfig managed block >>>'
const BLOCK_END = '# <<< OneConfig managed block <<<'
const ALLOWED_SHELL_FILES = ['.zshrc', '.bashrc', '.bash_profile', '.profile', '.zprofile']

export interface ProviderProfile {
  id: string
  name: string
  icon: string
  envVars: Record<string, string>
  models?: string[]
  helpUrl?: string
  helpTip?: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

interface ProvidersData {
  profiles: ProviderProfile[]
}

function generateId(): string {
  return `provider_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

async function loadProviders(): Promise<ProvidersData> {
  try {
    if (await fs.pathExists(PROVIDERS_PATH)) {
      const raw = await fs.readFile(PROVIDERS_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      const data: ProvidersData = Array.isArray(parsed) ? { profiles: parsed } : parsed
      // 迁移：为缺失 id 的 profile 补发 ID 并持久化
      let changed = false
      for (const p of data.profiles) {
        if (!p.id) {
          p.id = generateId()
          changed = true
        }
      }
      if (changed) {
        await saveProviders(data)
      }
      return data
    }
  } catch {}
  return { profiles: [] }
}

async function saveProviders(data: ProvidersData): Promise<void> {
  markProviderWrite()
  await fs.writeFile(PROVIDERS_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveShellFile(name: string): string | null {
  const base = name.replace(/^.*[/\\]/, '')
  if (!ALLOWED_SHELL_FILES.includes(base)) return null
  return join(homedir(), base)
}

export async function seedDefaultProviders(templatePath: string): Promise<void> {
  // 确保数据目录存在
  await fs.ensureDir(ONECONFIG_DIR)

  const data = await loadProviders()
  if (data.profiles.length > 0) return

  try {
    if (await fs.pathExists(templatePath)) {
      const raw = await fs.readFile(templatePath, 'utf-8')
      const templates: ProviderProfile[] = JSON.parse(raw)
      if (templates.length > 0) {
        templates[0].isActive = true
        data.profiles = templates.map(t => ({
          ...t,
          id: generateId(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          models: t.models || [],
          helpUrl: t.helpUrl || undefined,
          helpTip: t.helpTip || undefined
        }))
        await saveProviders(data)
      }
    }
  } catch {}
}

export function registerProviderHandlers(win: BrowserWindow) {
  startWatchingProviders(win)

  ipcMain.handle('providers:list', async () => {
    const data = await loadProviders()
    return data.profiles
  })

  ipcMain.handle('providers:create', async (_e, { profile }: { profile: Omit<ProviderProfile, 'id' | 'createdAt' | 'updatedAt'> }) => {
    const data = await loadProviders()
    const now = Date.now()
    const newProfile: ProviderProfile = {
      ...profile,
      models: profile.models || [],
      id: generateId(),
      createdAt: now,
      updatedAt: now
    }
    if (profile.isActive) {
      data.profiles.forEach(p => p.isActive = false)
    }
    data.profiles.push(newProfile)
    await saveProviders(data)
    return newProfile
  })

  ipcMain.handle('providers:update', async (_e, { id, profile }: { id: string; profile: Partial<ProviderProfile> }) => {
    const data = await loadProviders()
    const idx = data.profiles.findIndex(p => p.id === id)
    if (idx === -1) return null
    if (profile.isActive) {
      data.profiles.forEach(p => p.isActive = false)
    }
    data.profiles[idx] = { ...data.profiles[idx], ...profile, updatedAt: Date.now() }
    await saveProviders(data)
    return data.profiles[idx]
  })

  ipcMain.handle('providers:delete', async (_e, { id }: { id: string }) => {
    const data = await loadProviders()
    const filtered = data.profiles.filter(p => p.id !== id)
    if (filtered.length === data.profiles.length) return { success: false }
    data.profiles = filtered
    await saveProviders(data)
    return { success: true }
  })

  ipcMain.handle('providers:activate', async (_e, { id }: { id: string }) => {
    const data = await loadProviders()
    const profile = data.profiles.find(p => p.id === id)
    if (!profile) return { success: false }
    data.profiles.forEach(p => p.isActive = false)
    profile.isActive = true
    profile.updatedAt = Date.now()
    await saveProviders(data)
    return { success: true }
  })

  ipcMain.handle('providers:apply', async (_e, { shellFile }: { shellFile: string }) => {
    const data = await loadProviders()
    const active = data.profiles.find(p => p.isActive)
    if (!active) return { success: false, message: '没有已激活的 Provider' }

    const envEntries = Object.entries(active.envVars).filter(([_, v]) => v.trim() !== '')

    // Windows: 使用 setx 写入用户级环境变量（无需管理员）
    if (process.platform === 'win32') {
      for (const [key, value] of envEntries) {
        if (!/^[\w]+$/.test(key)) continue
        const escapedValue = value.replace(/"/g, '\\"')
        const cmd = `setx "${key}" "${escapedValue}"`
        try {
          await execAsync(cmd)
        } catch (err: any) {
          return { success: false, message: `设置 ${key} 失败: ${err.message}` }
        }
      }
      return { success: true, message: '已写入 Windows 系统环境变量，请重启终端以生效' }
    }

    // macOS / Linux: 写入 shell 配置文件
    const resolved = resolveShellFile(shellFile)
    if (!resolved) throw new Error('不允许的 shell 文件')

    await fs.ensureFile(resolved)
    const original = await fs.readFile(resolved, 'utf-8')

    const lines = envEntries.map(([k, v]) => `export ${k}="${v}"`)
    const blockContent = lines.join('\n')

    const blockRegex = new RegExp(
      `\\n?${escapeRegex(BLOCK_START)}[\\s\\S]*?${escapeRegex(BLOCK_END)}\\n?`,
      'g'
    )
    let cleaned = original.replace(blockRegex, '')

    const managed = `\n${BLOCK_START}\n${blockContent}\n${BLOCK_END}\n`
    const newContent = cleaned.trimEnd() + managed

    const backupPath = resolved + '.oneconfig.bak'
    await fs.writeFile(backupPath, original, 'utf-8')
    await fs.writeFile(resolved, newContent, 'utf-8')
    return { success: true }
  })

  // 上传 Provider 图标：返回 base64 data URL，不写磁盘
  ipcMain.handle('providers:uploadIcon', async (_e, { data }: { data: string }) => {
    return { success: true, dataUrl: data }
  })

  // 获取图标 base64 data URL（内置图标转 base64，已上传的直接返回）
  ipcMain.handle('providers:iconData', async (_e, { icon }: { icon: string }) => {
    if (!icon) return ''
    // 已经是 data URL 直接返回
    if (icon.startsWith('data:')) return icon
    // 内置图标：来自 assets 目录
    if (/\.(svg|png|jpe?g|gif|webp|ico)$/i.test(icon)) {
      const assetsPath = join(__dirname, '../../src/renderer/assets', icon)
      if (await fs.pathExists(assetsPath)) {
        const buf = await fs.readFile(assetsPath)
        const mime = extname(icon).slice(1) === 'svg' ? 'image/svg+xml' : `image/${extname(icon).slice(1)}`
        return `data:${mime};base64,${buf.toString('base64')}`
      }
    }
    return ''
  })
}

// ── 文件监听：JSON 外部变更后通知渲染进程 ──
let watcher: ReturnType<typeof fs.watch> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSelfWrite = 0

/**
 * 在 providers.json 变更时通过 IPC 通知渲染进程重新加载
 * 用 lastSelfWrite 跳过自身写入产生的事件，debounce 200ms 避免多次触发
 */
export function startWatchingProviders(win: BrowserWindow) {
  try {
    // 如果文件还没创建（seedDefaultProviders 会在 createWindow 前创建），监听其所在目录
    if (!fs.existsSync(PROVIDERS_PATH)) {
      const dir = join(PROVIDERS_PATH, '..')
      fs.ensureDirSync(dir)
      const watcher = fs.watch(dir, { persistent: false }, (_, filename) => {
        if (filename && filename.includes('providers.json')) {
          watcher.close()
          startWatchingProviders(win)
        }
      })
      return
    }

    watcher = fs.watch(PROVIDERS_PATH, { persistent: false }, (event) => {
      if (event === 'change') {
        // 200ms 内如果是自身写入则忽略
        const now = Date.now()
        if (now - lastSelfWrite < 200) return
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          win.webContents.send('providers:changed')
        }, 200)
      }
    })
    watcher.on('error', () => {
      // 文件被删除或不可访问时静默忽略
    })
  } catch {
    // 文件不存在或无法访问时不启动监听
  }
}

export function stopWatchingProviders() {
  watcher?.close()
  watcher = null
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
}

/** 标记一次自身写入，使监听器忽略接下来的 200ms */
export function markProviderWrite() {
  lastSelfWrite = Date.now()
}
