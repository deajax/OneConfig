import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

interface Session {
  pty: pty.IPty
  dispose: () => void
}

const sessions = new Map<string, Session>()

function safeSend(win: BrowserWindow, channel: string, data: string) {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

function validateSessionId(id: string): boolean {
  return typeof id === 'string' && /^[\w-]{1,64}$/.test(id)
}

function validateSize(cols: number, rows: number): boolean {
  return (
    Number.isInteger(cols) && cols >= 2 && cols <= 500 &&
    Number.isInteger(rows) && rows >= 2 && rows <= 200
  )
}

export function registerTerminalHandlers(win: BrowserWindow) {
  ipcMain.handle('terminal:start', (_e, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    if (!validateSessionId(sessionId)) throw new Error('invalid sessionId')
    if (!validateSize(cols, rows)) throw new Error('invalid terminal size')
    if (sessions.has(sessionId)) {
      sessions.get(sessionId)!.dispose()
    }

    const isWin = os.platform() === 'win32'
    // macOS/Linux 下优先使用用户默认 shell，回退到 /bin/zsh → /bin/bash
    // 注意：Electron dev 模式下 process.env.SHELL 可能为空，用绝对路径兜底
    const shellBin = isWin
      ? 'powershell.exe'
      : (process.env.SHELL || '/bin/zsh')

    // 补全 PATH，避免 macOS 启动 Electron 时 PATH 不完整导致 spawn 失败
    const baseEnv = Object.assign({}, process.env) as Record<string, string>
    if (!isWin) {
      const paths = [
        '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
        '/opt/homebrew/bin', '/opt/homebrew/sbin'
      ]
      const existing = (baseEnv.PATH || '').split(':')
      const merged = [...new Set([...paths, ...existing])].join(':')
      baseEnv.PATH = merged
    }

    const ptyProcess = pty.spawn(shellBin, isWin ? [] : ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: os.homedir(),
      env: baseEnv
    })

    const dataChannel = `terminal:data:${sessionId}`
    const onData = ptyProcess.onData((data) => safeSend(win, dataChannel, data))

    const dispose = () => {
      try { onData.dispose() } catch { /* ignore */ }
      try { ptyProcess.kill() } catch { /* ignore */ }
      sessions.delete(sessionId)
    }

    sessions.set(sessionId, { pty: ptyProcess, dispose })
    return { pid: ptyProcess.pid }
  })

  ipcMain.handle('terminal:input', (_e, { sessionId, data }: { sessionId: string; data: string }) => {
    if (!validateSessionId(sessionId)) return
    sessions.get(sessionId)?.pty.write(data)
  })

  ipcMain.handle('terminal:resize', (_e, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    if (!validateSessionId(sessionId) || !validateSize(cols, rows)) return
    sessions.get(sessionId)?.pty.resize(cols, rows)
  })

  ipcMain.handle('terminal:stop', (_e, { sessionId }: { sessionId: string }) => {
    if (!validateSessionId(sessionId)) return
    sessions.get(sessionId)?.dispose()
  })

  // 应用退出时清理全部 session
  win.on('closed', () => {
    sessions.forEach((s) => s.dispose())
    sessions.clear()
  })
}
