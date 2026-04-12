export {}

declare global {
  interface ProviderProfile {
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

  interface Window {
    electronAPI: {
      // JSON
      openJsonFile(): Promise<{ filePath: string; content: string } | null>
      openRecentFile(filePath: string): Promise<{ filePath: string; content: string } | null>
      openContent(fileName: string, content: string): Promise<{ filePath: string; fileName: string; content: string } | null>
      saveJsonFile(filePath: string, content: string): Promise<{ success: boolean }>
      saveJsonFileAs(content: string): Promise<{ filePath: string } | null>

      // 持久化管理文件
      listManaged(): Promise<{ id: string; name: string; path: string; addedAt: number }[]>
      addManaged(filePath: string): Promise<{ id: string; name: string; path: string; addedAt: number } | null>
      removeManaged(id: string): Promise<{ success: boolean }>

      // Shell 环境（macOS / Linux）
      readShellEnv(shellFile: string): Promise<string>
      writeShellEnv(shellFile: string, block: string): Promise<{ success: boolean }>

      // 终端
      terminalStart(sessionId: string, cols: number, rows: number): Promise<{ pid: number }>
      terminalInput(sessionId: string, data: string): Promise<void>
      terminalResize(sessionId: string, cols: number, rows: number): Promise<void>
      terminalStop(sessionId: string): Promise<void>
      onTerminalData(sessionId: string, callback: (data: string) => void): () => void

      // Windows 系统环境变量
      setSystemEnv(key: string, value: string): Promise<{ success: boolean }>
      getSystemEnv(key: string): Promise<string | null>
      listSystemEnv(): Promise<Record<string, string>>
      deleteSystemEnv(key: string): Promise<{ success: boolean }>

      // Provider 配置
      listProviders(): Promise<ProviderProfile[]>
      createProvider(profile: { name: string; icon: string; envVars: Record<string, string>; models?: string[]; isActive: boolean }): Promise<ProviderProfile>
      updateProvider(id: string, profile: { name?: string; icon?: string; envVars?: Record<string, string>; models?: string[]; isActive?: boolean }): Promise<ProviderProfile | null>
      deleteProvider(id: string): Promise<{ success: boolean }>
      activateProvider(id: string): Promise<{ success: boolean }>
      applyProvider(shellFile: string): Promise<{ success: boolean; message?: string }>
      uploadProviderIcon(data: string): Promise<{ success: boolean; dataUrl: string }>
      getProviderIconData(icon: string): Promise<string>
      onProvidersChanged(callback: () => void): () => void

      platform: NodeJS.Platform
    }
  }
}
