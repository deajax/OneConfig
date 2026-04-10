import { ipcMain } from 'electron'
import { app } from 'electron'
import fs from 'fs-extra'
import { homedir } from 'os'
import { join } from 'path'

const PROVIDERS_PATH = join(app.getPath('userData'), 'providers.json')
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
      return JSON.parse(raw)
    }
  } catch {}
  return { profiles: [] }
}

async function saveProviders(data: ProvidersData): Promise<void> {
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

export function registerProviderHandlers() {
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
    const resolved = resolveShellFile(shellFile)
    if (!resolved) throw new Error('不允许的 shell 文件')

    const data = await loadProviders()
    const active = data.profiles.find(p => p.isActive)
    if (!active) return { success: false, message: '没有已激活的 Provider' }

    await fs.ensureFile(resolved)
    const original = await fs.readFile(resolved, 'utf-8')

    // 构建 export 块
    const lines = Object.entries(active.envVars)
      .filter(([_, v]) => v.trim() !== '')
      .map(([k, v]) => `export ${k}="${v}"`)
    const blockContent = lines.join('\n')

    // 移除旧托管块
    const blockRegex = new RegExp(
      `\\n?${escapeRegex(BLOCK_START)}[\\s\\S]*?${escapeRegex(BLOCK_END)}\\n?`,
      'g'
    )
    let cleaned = original.replace(blockRegex, '')

    // 追加新块
    const managed = `\n${BLOCK_START}\n${blockContent}\n${BLOCK_END}\n`
    const newContent = cleaned.trimEnd() + managed

    // 备份
    const backupPath = resolved + '.oneconfig.bak'
    await fs.writeFile(backupPath, original, 'utf-8')
    await fs.writeFile(resolved, newContent, 'utf-8')
    return { success: true }
  })
}
