/**
 * 拖拽打开 JSON 文件的通用 composable
 *
 * Electron contextIsolation 场景下，从隐藏目录拖入的 File 对象 .path 可能为空，
 * 此时降级用 FileReader 读取内容，通过 IPC 传入主进程（不依赖文件路径）。
 */
import { useConfigStore } from '@/stores/configStore'

export interface DropResult {
  filePath: string    // 有路径时为绝对路径，无路径时为空字符串
  fileName: string
  content: string
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}

export async function openDroppedFile(file: File): Promise<DropResult | null> {
  if (!file.name.endsWith('.json')) return null

  const filePath = (file as File & { path?: string }).path || ''

  if (filePath) {
    // 有真实路径：通过主进程读取（保证内容与磁盘一致）
    const result = await window.electronAPI.openRecentFile(filePath)
    if (!result) return null
    return { filePath: result.filePath, fileName: file.name, content: result.content }
  } else {
    // 无路径（隐藏目录、沙箱限制等）：FileReader 读内容，传主进程
    try {
      const content = await readFileAsText(file)
      const result = await window.electronAPI.openContent(file.name, content)
      if (!result) return null
      return { filePath: '', fileName: file.name, content: result.content }
    } catch {
      return null
    }
  }
}

export function useConfigStore_saveRecent() {
  const RECENT_KEY = 'oneconfig_recent_files'
  const MAX_RECENT = 10

  function saveRecent(path: string) {
    if (!path) return
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const existing: { name: string; path: string }[] = raw ? JSON.parse(raw) : []
      const name = path.replace(/\\/g, '/').split('/').pop() || path
      const filtered = existing.filter((f) => f.path !== path)
      localStorage.setItem(RECENT_KEY, JSON.stringify([{ name, path }, ...filtered].slice(0, MAX_RECENT)))
    } catch { /* ignore */ }
  }

  return { saveRecent }
}
