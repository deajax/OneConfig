import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// 每个 channel 都是白名单，渲染层只能调用此处声明的方法
const electronAPI = {
  // JSON 配置文件
  openJsonFile: (): Promise<{ filePath: string; content: string } | null> =>
    ipcRenderer.invoke('json:open'),
  openRecentFile: (filePath: string): Promise<{ filePath: string; content: string } | null> =>
    ipcRenderer.invoke('json:openRecent', { filePath }),
  openContent: (fileName: string, content: string): Promise<{ filePath: string; fileName: string; content: string } | null> =>
    ipcRenderer.invoke('json:openContent', { fileName, content }),
  saveJsonFile: (filePath: string, content: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('json:save', { filePath, content }),
  saveJsonFileAs: (content: string): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke('json:saveAs', { content }),

  // 模板
  listTemplates: (): Promise<string[]> =>
    ipcRenderer.invoke('json:listTemplates'),
  loadTemplate: (name: string): Promise<{ schema: object; defaults: object } | null> =>
    ipcRenderer.invoke('json:loadTemplate', { name }),

  // 持久化管理文件
  listManaged: (): Promise<{ id: string; name: string; path: string; addedAt: number }[]> =>
    ipcRenderer.invoke('json:listManaged'),
  addManaged: (filePath: string): Promise<{ id: string; name: string; path: string; addedAt: number } | null> =>
    ipcRenderer.invoke('json:addManaged', { filePath }),
  removeManaged: (id: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('json:removeManaged', { id }),

  // 用户级 shell 环境（macOS / Linux）
  readShellEnv: (shellFile: string): Promise<string> =>
    ipcRenderer.invoke('env:readShell', { shellFile }),
  writeShellEnv: (shellFile: string, block: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('env:writeShell', { shellFile, block }),

  // 终端（pty）
  terminalStart: (sessionId: string, cols: number, rows: number): Promise<{ pid: number }> =>
    ipcRenderer.invoke('terminal:start', { sessionId, cols, rows }),
  terminalInput: (sessionId: string, data: string): Promise<void> =>
    ipcRenderer.invoke('terminal:input', { sessionId, data }),
  terminalResize: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('terminal:resize', { sessionId, cols, rows }),
  terminalStop: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('terminal:stop', { sessionId }),
  onTerminalData: (
    sessionId: string,
    callback: (data: string) => void
  ): (() => void) => {
    const channel = `terminal:data:${sessionId}`
    const handler = (_: IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  // Provider 配置
  listProviders: (): Promise<Array<{ id: string; name: string; icon: string; envVars: Record<string, string>; models?: string[]; helpUrl?: string; helpTip?: string; isActive: boolean; createdAt: number; updatedAt: number }>> =>
    ipcRenderer.invoke('providers:list'),
  createProvider: (profile: { name: string; icon: string; envVars: Record<string, string>; models?: string[]; isActive: boolean }): Promise<{ id: string; name: string; icon: string; envVars: Record<string, string>; models?: string[]; isActive: boolean; createdAt: number; updatedAt: number }> =>
    ipcRenderer.invoke('providers:create', { profile }),
  updateProvider: (id: string, profile: { name?: string; icon?: string; envVars?: Record<string, string>; models?: string[]; isActive?: boolean }): Promise<{ id: string; name: string; icon: string; envVars: Record<string, string>; models?: string[]; isActive: boolean; createdAt: number; updatedAt: number } | null> =>
    ipcRenderer.invoke('providers:update', { id, profile }),
  deleteProvider: (id: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('providers:delete', { id }),
  activateProvider: (id: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('providers:activate', { id }),
  applyProvider: (shellFile: string): Promise<{ success: boolean; message?: string }> =>
    ipcRenderer.invoke('providers:apply', { shellFile }),

  // Windows 系统环境变量（仅 win32）
  setSystemEnv: (key: string, value: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('env:setSystem', { key, value }),
  getSystemEnv: (key: string): Promise<string | null> =>
    ipcRenderer.invoke('env:getSystem', { key }),

  // 工具
  platform: process.platform as NodeJS.Platform,

  // 窗口控制（frameless 模式下需要）
  minimizeWindow: () => ipcRenderer.invoke('win:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('win:maximize'),
  closeWindow: () => ipcRenderer.invoke('win:close')
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
