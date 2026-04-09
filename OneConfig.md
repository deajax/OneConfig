# **OneConfig**

## 一、技术栈与核心开源库

| 功能                    | 推荐库                                                | 理由                                 |
| ----------------------- | ----------------------------------------------------- | ------------------------------------ |
| 桌面应用框架            | Electron 28+ + Vite                                   | 成熟，热重载快                       |
| 前端框架                | Vue 3 + TypeScript + TailwindCSS 4.2                  | 类型安全，组合式 API                 |
| 预编译器                | Less                                                  |                                      |
| 动态表单（JSON → 控件） | **Formily** (阿里) 或 **VJSF** (Vue JSON Schema Form) | 避免手写递归组件，支持数组/嵌套/校验 |
| 终端模拟器              | **xterm.js** + **node-pty**                           | VS Code 同款，稳定高效               |
| 提权（Windows）         | **sudo-prompt**                                       | 跨平台，动态弹 UAC                   |
| 文件/路径操作           | **fs-extra**                                          | 比原生 fs 更方便                     |
| 状态管理                | **Pinia**                                             | Vue 3 官方推荐                       |
| UI 组件库               | **Ant Design Vue**                                    | 提供对话框、按钮、消息提示等         |

---

## 二、项目架构（清晰分层）

```
my-ai-config-tool/
├── electron/
│   ├── main.ts                 # 主进程入口
│   ├── preload.ts              # 安全桥接
│   ├── ipc/
│   │   ├── json.ts             # JSON 文件读写
│   │   ├── env.ts              # .zshrc / Windows 环境变量
│   │   ├── terminal.ts         # node-pty 进程管理
│   │   └── permission.ts       # 提权辅助
│   └── utils/
│       └── sudoWrapper.ts      # 封装 sudo-prompt
├── src/
│   ├── components/
│   │   ├── JsonSchemaForm.vue  # 基于 Formily 的动态表单
│   │   ├── Terminal.vue        # xterm.js 终端组件
│   │   └── PermissionDialog.vue
│   ├── views/
│   │   ├── ConfigEditor.vue    # JSON 配置页
│   │   ├── EnvEditor.vue       # 环境变量页
│   │   └── TerminalView.vue    # 独立终端页（可选）
│   ├── stores/
│   │   ├── configStore.ts
│   │   └── terminalStore.ts
│   └── App.vue
└── package.json
```

---

## 三、关键实现（直接可用的方案）

### 1. 动态表单：使用 Formily（避免手写递归）

安装：
```bash
npm install @formily/vue @formily/core @formily/element-plus
```

`JsonSchemaForm.vue` 示例（简化版）：
```vue
<template>
  <SchemaField :schema="schema" />
</template>

<script setup lang="ts">
import { createForm } from '@formily/core'
import { createSchemaField } from '@formily/vue'
import { Input, NumberPicker, Switch, ArrayItems, FormItem } from '@formily/element-plus'

const { SchemaField } = createSchemaField({
  components: { Input, NumberPicker, Switch, ArrayItems, FormItem }
})

const props = defineProps<{ jsonData: any }>()

// 根据 JSON 数据自动推断 JSON Schema
const schema = computed(() => jsonToSchema(props.jsonData))

function jsonToSchema(obj: any): any {
  if (Array.isArray(obj)) {
    return {
      type: 'array',
      items: jsonToSchema(obj[0] || '')
    }
  }
  if (typeof obj === 'object' && obj !== null) {
    const properties = {}
    for (const [key, val] of Object.entries(obj)) {
      properties[key] = jsonToSchema(val)
    }
    return { type: 'object', properties }
  }
  return { type: typeof obj }
}
</script>
```

> **优点**：自动生成控件，支持数组增删、嵌套、拖拽排序。完全不需要自己写递归组件。

### 2. 集成终端（xterm.js + node-pty）

#### 安装
```bash
npm install xterm node-pty @types/node-pty
# 注意：node-pty 需要编译，确保有 node-gyp 环境
```

#### 主进程：`electron/ipc/terminal.ts`
```ts
import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

let ptyProcess: pty.IPty | null = null

export function registerTerminalHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('terminal-start', (event, { cols, rows }) => {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 30,
      cwd: os.homedir(),
      env: process.env
    })
    ptyProcess.onData((data) => {
      mainWindow.webContents.send('terminal-data', data)
    })
    return { pid: ptyProcess.pid }
  })

  ipcMain.handle('terminal-input', (event, data: string) => {
    ptyProcess?.write(data)
  })

  ipcMain.handle('terminal-resize', (event, { cols, rows }) => {
    ptyProcess?.resize(cols, rows)
  })
}
```

#### 渲染进程：`Terminal.vue`
```vue
<template>
  <div ref="terminalContainer" class="terminal"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

const terminalContainer = ref<HTMLElement>()
let term: Terminal
let fitAddon: FitAddon

onMounted(async () => {
  term = new Terminal({ cursorBlink: true })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(terminalContainer.value!)
  fitAddon.fit()

  // 启动后端 pty 进程
  await window.electronAPI.terminalStart({ cols: term.cols, rows: term.rows })

  // 监听来自主进程的输出
  window.electronAPI.onTerminalData((data: string) => {
    term.write(data)
  })

  // 用户输入发送到主进程
  term.onData((data) => {
    window.electronAPI.terminalInput(data)
  })

  // 窗口大小变化自适应
  window.addEventListener('resize', () => {
    fitAddon.fit()
    window.electronAPI.terminalResize({ cols: term.cols, rows: term.rows })
  })
})

onUnmounted(() => {
  term?.dispose()
})
</script>

<style scoped>
.terminal { height: 100%; width: 100%; }
</style>
```

#### 预加载暴露 API
```ts
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  terminalStart: (size) => ipcRenderer.invoke('terminal-start', size),
  terminalInput: (data) => ipcRenderer.invoke('terminal-input', data),
  terminalResize: (size) => ipcRenderer.invoke('terminal-resize', size),
  onTerminalData: (callback) => ipcRenderer.on('terminal-data', (_, data) => callback(data))
})
```

> **注意**：`node-pty` 在打包时需要额外配置 `electron-builder` 的 `asarUnpack`，否则无法找到原生模块。配置如下：
```json
"build": {
  "asarUnpack": ["**/node_modules/node-pty/**"]
}
```

### 3. 动态权限申请（Windows 系统环境变量）

复用 `sudo-prompt`，封装成 Promise：

`electron/utils/sudoWrapper.ts`:
```ts
import sudo from 'sudo-prompt'

export function runAsAdmin(command: string, options?: { name?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    sudo.exec(command, {
      name: options?.name || 'AI 配置工具'
    }, (error, stdout, stderr) => {
      if (error) return reject(error)
      resolve()
    })
  })
}
```

在 `env.ts` 中调用：
```ts
ipcMain.handle('set-system-env', async (event, key: string, value: string) => {
  await runAsAdmin(`setx "${key}" "${value}" /M`)
  return { success: true }
})
```

渲染进程调用前，可以用 `PermissionDialog` 组件告知用户即将执行的操作，再调用 API。

### 4. 预置配置模板市场

在 `public/templates/` 目录下存放常见 AI 工具的 JSON Schema 模板，例如：
- `claude-code.json`
- `ollama.json`
- `localai.json`

用户选择模板后，复制到用户配置目录，再通过 Formily 动态渲染编辑。

---

## 四、打包与部署注意事项

1. **node-pty 原生模块处理**：在 `electron-builder` 中配置 `asarUnpack`，并在打包后测试终端是否正常。
2. **Windows 提权**：不需要请求管理员权限启动应用，只有修改系统环境变量时才弹 UAC。
3. **macOS 签名**：如果要分发，建议申请开发者证书并对应用签名，否则 `sudo-prompt` 弹窗可能不美观。
4. **Linux 兼容**：`node-pty` 和 `sudo-prompt` 同样支持 Linux，终端 Shell 可设为 `bash` 或 `zsh`。

---

## 五、开发顺序建议（MVP 快速验证）

1. **搭建 Electron + Vue3 基础模板**（使用 `electron-vite` 脚手架）
2. **实现 JSON 文件读取 + Formily 动态表单**（打开/保存，无需终端和环境变量）
3. **添加终端组件**（先只集成，不涉及权限）
4. **添加 macOS `.zshrc` 编辑**（直接读写文件）
5. **添加 Windows 系统环境变量编辑 + 提权弹窗**
6. **优化 UI（标签页、快捷键、撤销/重做）**
7. **打包测试**

---

## 六、现成可参考的仓库（直接 fork 或借鉴）

| 需求                    | 仓库                                                         | 用途                       |
| ----------------------- | ------------------------------------------------------------ | -------------------------- |
| Electron+Vue3 模板      | [electron-vite](https://github.com/alex8088/electron-vite) 或 [Deluze/electron-vue-template](https://github.com/Deluze/electron-vue-template) | 直接 clone 作为起点        |
| 动态表单（JSON 转表单） | [formily](https://github.com/alibaba/formily)                | 复制示例就能用             |
| 终端集成（完整示例）    | [electerm](https://github.com/electerm/electerm)             | 查看其 `terminal` 模块实现 |
| Windows 环境变量编辑    | [windows-path-editor](https://github.com/Develooper/windows-path-editor) | 提权和注册表操作参考       |

---

## 七、总结

这份方案的特点：
- **最大化复用**：Formily 解决动态表单，xterm.js+node-pty 解决终端，sudo-prompt 解决提权。
- **用户体验好**：只有需要时才请求管理员权限，终端可内嵌在同一个窗口。
- **代码可维护**：TypeScript + Pinia + 清晰分层。
- **可交付**：每一步都有具体代码示例和参考仓库。
