import { ipcMain } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import fs from 'fs-extra'
import { runAsAdmin } from '../utils/sudoWrapper'

const BLOCK_START = '# >>> OneConfig managed block >>>'
const BLOCK_END = '# <<< OneConfig managed block <<<'

const ALLOWED_SHELL_FILES = ['.zshrc', '.bashrc', '.bash_profile', '.profile', '.zprofile']

function resolveShellFile(name: string): string | null {
  const base = name.replace(/^.*[/\\]/, '') // basename only
  if (!ALLOWED_SHELL_FILES.includes(base)) return null
  return join(homedir(), base)
}

export function registerEnvHandlers() {
  // macOS / Linux: 读取 shell 配置文件
  ipcMain.handle('env:readShell', async (_e, { shellFile }: { shellFile: string }) => {
    const resolved = resolveShellFile(shellFile)
    if (!resolved) throw new Error('不允许的 shell 文件')
    await fs.ensureFile(resolved)
    return fs.readFile(resolved, 'utf-8')
  })

  // macOS / Linux: 幂等写入托管块（带备份）
  ipcMain.handle('env:writeShell', async (_e, { shellFile, block }: { shellFile: string; block: string }) => {
    const resolved = resolveShellFile(shellFile)
    if (!resolved) throw new Error('不允许的 shell 文件')
    await fs.ensureFile(resolved)
    const original = await fs.readFile(resolved, 'utf-8')

    // 移除旧托管块
    const blockRegex = new RegExp(
      `\n?${escapeRegex(BLOCK_START)}[\\s\\S]*?${escapeRegex(BLOCK_END)}\n?`,
      'g'
    )
    let cleaned = original.replace(blockRegex, '')

    // 追加新块
    const managed = `\n${BLOCK_START}\n${block.trim()}\n${BLOCK_END}\n`
    const newContent = cleaned.trimEnd() + managed

    // 备份
    const backupPath = resolved + '.oneconfig.bak'
    await fs.writeFile(backupPath, original, 'utf-8')

    await fs.writeFile(resolved, newContent, 'utf-8')
    return { success: true }
  })

  // Windows: 系统级环境变量（需要管理员权限）
  ipcMain.handle('env:setSystem', async (_e, { key, value }: { key: string; value: string }) => {
    if (process.platform !== 'win32') throw new Error('仅支持 Windows')
    if (!/^[\w]+$/.test(key)) throw new Error('无效的变量名')
    // 提示用户：setx 有 1024 字符限制；PATH 等长变量建议使用注册表接口
    const cmd = `setx "${key}" "${value.replace(/"/g, '\\"')}" /M`
    await runAsAdmin(cmd, { name: 'OneConfig' })
    return { success: true }
  })

  ipcMain.handle('env:getSystem', async (_e, { key }: { key: string }) => {
    if (process.platform !== 'win32') return process.env[key] ?? null
    return process.env[key] ?? null
  })

  // Windows: 列出所有系统环境变量（读取注册表不需要管理员权限）
  ipcMain.handle('env:listSystem', async () => {
    if (process.platform !== 'win32') throw new Error('仅支持 Windows')
    const { execSync } = await import('child_process')
    const output = execSync(
      'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"',
      { encoding: 'utf8', windowsHide: true }
    )
    const envMap: Record<string, string> = {}
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('HK') || trimmed === '') continue
      // Format: NAME    TYPE    VALUE  (tab or multi-space separated)
      const parts = trimmed.split(/\s{2,}|\t/)
      if (parts.length < 2) continue
      const name = parts[0].trim()
      const value = parts.length >= 3 ? parts.slice(2).join('  ').trim() : ''
      if (value !== '') envMap[name] = value
    }
    return envMap
  })

  // Windows: 删除系统环境变量
  ipcMain.handle('env:deleteSystem', async (_e, { key }: { key: string }) => {
    if (process.platform !== 'win32') throw new Error('仅支持 Windows')
    if (!/^[\w]+$/.test(key)) throw new Error('无效的变量名')
    const cmd = `reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v "${key}" /f`
    await runAsAdmin(cmd, { name: 'OneConfig' })
    return { success: true }
  })
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
