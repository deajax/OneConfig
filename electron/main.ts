import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerJsonHandlers } from './ipc/json'
import { registerEnvHandlers } from './ipc/env'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerProviderHandlers, seedDefaultProviders } from './ipc/providers'
import { join } from 'path'

const isDev = !app.isPackaged

function createWindow() {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    // macOS: hidden 让标题栏不显示文字，但保留交通灯按钮（不用 hiddenInset 避免 inset 偏移）
    titleBarStyle: isMac ? 'hidden' : 'default',
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
  const templatePath = join(__dirname, '../../public/templates/providers.json')
  await seedDefaultProviders(templatePath)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
