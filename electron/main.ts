import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerJsonHandlers } from './ipc/json'
import { registerEnvHandlers } from './ipc/env'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerProviderHandlers, seedDefaultProviders } from './ipc/providers'
import { ipcMain } from 'electron'

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

function createWindow() {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    // macOS: hidden 让标题栏不显示文字，但保留交通灯按钮
    // Windows: frameless 隐藏原生标题栏
    titleBarStyle: isMac ? 'hidden' : 'default',
    frame: isMac ? undefined : false,
    // macOS 上给交通灯按钮预留偏移，让其在内容区正确呈现
    trafficLightPosition: isMac ? { x: 14, y: 16 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  registerJsonHandlers(win)
  registerEnvHandlers()
  registerTerminalHandlers(win)
  registerProviderHandlers()

  if (isDev) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

app.whenReady().then(async () => {
  // 窗口控制 IPC
  ipcMain.handle('win:minimize', () => mainWindow?.minimize())
  ipcMain.handle('win:maximize', () => mainWindow?.isMaximized() ? mainWindow?.unmaximize() : mainWindow?.maximize())
  ipcMain.handle('win:close', () => mainWindow?.close())

  const templatePath = join(__dirname, '../../public/templates/providers.json')
  await seedDefaultProviders(templatePath)
  mainWindow = createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
