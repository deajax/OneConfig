<template>
  <PageContainer :show-back="false">
    <template #extra>
      <!-- 可视化视图工具栏 -->
      <template v-if="activeView === 'visual'">
        <a-button type="primary" :disabled="!isDirty" :loading="saving" size="small" @click="saveVisual">
          <template #icon><h(SaveOutlined) /></template>
          保存
        </a-button>
      </template>
      <!-- 源码视图工具栏（仅 macOS/Linux） -->
      <template v-else>
        <a-select
          v-model:value="selectedShellFile"
          :options="shellFileOptions"
          style="width: 160px"
          size="small"
          @change="loadShellFile"
        />
        <a-button size="small" :loading="loadingShell" @click="loadShellFile">
          <template #icon><h(ReloadOutlined) /></template>
        </a-button>
        <a-button type="primary" size="small" :disabled="!shellDirty" :loading="savingShell" @click="saveShellFile">
          <template #icon><h(SaveOutlined) /></template>
          保存
        </a-button>
        <a-tag v-if="shellDirty" color="warning" style="margin:0">未保存</a-tag>
      </template>
    </template>

    <!-- ── 可视化视图 ── -->
    <div v-show="activeView === 'visual'" class="flex flex-col h-full overflow-hidden">
      <!-- Windows 提示 -->
      <a-alert
        v-if="isWindows"
        type="warning"
        show-icon
        banner
        class="shrink-0"
        message="修改系统环境变量需要管理员权限。保存时将弹出 UAC 授权请求。setx 有 1024 字符限制，PATH 等长变量请谨慎操作。"
      />
      <!-- macOS/Linux 提示 -->
      <a-alert
        v-else
        type="info"
        show-icon
        banner
        class="shrink-0"
        :message="`正在编辑 ~/${selectedShellFile}。变量按条管理，保存后写入 OneConfig 托管块，不影响文件其他内容。修改在新开终端后生效。`"
      />

      <!-- 变量表格 -->
      <div class="flex-1 overflow-y-auto">
        <a-table
          :data-source="envRows"
          :columns="tableColumns"
          :pagination="false"
          :bordered="false"
          row-key="id"
          size="middle"
          class="env-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'key'">
              <a-input
                v-if="editingId === record.id && editingField === 'key'"
                v-model:value="editingRecord.key"
                class="font-mono"
                @blur="commitEdit"
                @keydown.enter="commitEdit"
                @keydown.escape="cancelEdit"
                @click.stop
              />
              <span
                v-else
                class="font-mono text-sm text-gray-800 cursor-text block truncate"
                :class="record.key ? '' : 'text-gray-300 italic'"
                @dblclick="startEdit(record, 'key')"
              >{{ record.key || '双击编辑' }}</span>
            </template>

            <template v-else-if="column.key === 'value'">
              <a-input
                v-if="editingId === record.id && editingField === 'value'"
                v-model:value="editingRecord.value"
                class="font-mono"
                @blur="commitEdit"
                @keydown.enter="commitEdit"
                @keydown.escape="cancelEdit"
                @click.stop
              />
              <span
                v-else
                class="font-mono text-sm text-gray-600 cursor-text block truncate"
                :class="record.value ? '' : 'text-gray-300 italic'"
                @dblclick="startEdit(record, 'value')"
              >{{ record.value || '双击编辑' }}</span>
            </template>

            <template v-else-if="column.key === 'comment'">
              <a-input
                v-if="editingId === record.id && editingField === 'comment'"
                v-model:value="editingRecord.comment"
                placeholder="添加说明…"
                @blur="commitEdit"
                @keydown.enter="commitEdit"
                @keydown.escape="cancelEdit"
                @click.stop
              />
              <span
                v-else
                class="text-sm text-gray-400 cursor-text block truncate"
                @dblclick="startEdit(record, 'comment')"
              >{{ record.comment || '' }}</span>
            </template>

            <template v-else-if="column.key === 'action'">
              <a-space size="small">
                <a-typography-link @click="startEdit(record, 'key')">编辑</a-typography-link>
                <a-typography-link type="danger" @click="deleteRow(record.id)">删除</a-typography-link>
              </a-space>
            </template>
          </template>
        </a-table>

        <div class="px-4 py-3 border-t border-gray-100">
          <a-button type="dashed" class="w-full text-gray-400 hover:text-blue-500! hover:border-blue-400!" @click="addRow">
            <template #icon><h(PlusOutlined) /></template>
            添加变量
          </a-button>
        </div>
      </div>
    </div>

    <!-- ── 源码视图（仅 macOS/Linux） ── -->
    <div v-if="!isWindows" v-show="activeView === 'source'" class="flex-1 overflow-hidden">
      <div ref="shellMonacoContainer" class="w-full h-full" />
    </div>

    <!-- Windows 权限确认 -->
    <PermissionDialog
      v-model:open="showPermDialog"
      :command="pendingCommands.join('\n')"
      warning="此操作将修改系统级环境变量，需要管理员权限（UAC 弹窗）。"
      @confirm="doSaveWin"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { monaco } from '@/monaco'
import PermissionDialog from '@/components/PermissionDialog.vue'
import PageContainer from '@/components/PageContainer.vue'

const isWindows = window.electronAPI.platform === 'win32'

// ── 视图切换（仅 macOS/Linux） ──
const activeView = ref<'visual' | 'source'>('visual')

// ── 环境变量行数据 ──
interface EnvRow {
  id: string
  key: string
  value: string
  comment: string
}

let rowCounter = 0
function newRow(key = '', value = '', comment = ''): EnvRow {
  return { id: `row-${++rowCounter}`, key, value, comment }
}

const envRows = ref<EnvRow[]>([])
const isDirty = ref(false)
const saving = ref(false)

watch(envRows, () => { isDirty.value = true }, { deep: true })

// ── 表格列定义 ──
const tableColumns = [
  { title: '变量名', key: 'key', width: 200, ellipsis: true },
  { title: '变量值', key: 'value', ellipsis: true },
  { title: '注释 / 说明', key: 'comment', width: 220, ellipsis: true },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const }
]

// ── 内联编辑 ──
const editingId = ref<string | null>(null)
const editingField = ref<'key' | 'value' | 'comment'>('key')
const editingRecord = ref<EnvRow>({ id: '', key: '', value: '', comment: '' })

function startEdit(record: EnvRow, field: 'key' | 'value' | 'comment') {
  editingId.value = record.id
  editingField.value = field
  editingRecord.value = { ...record }
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.env-table .ant-input:focus-within input, .env-table input:focus')
    input?.focus()
  })
}

function commitEdit() {
  const idx = envRows.value.findIndex(r => r.id === editingId.value)
  if (idx !== -1) {
    envRows.value[idx] = { ...editingRecord.value }
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function addRow() {
  envRows.value.push(newRow())
  nextTick(() => {
    const last = envRows.value[envRows.value.length - 1]
    startEdit(last, 'key')
  })
}

function deleteRow(id: string) {
  envRows.value = envRows.value.filter(r => r.id !== id)
}

// ── macOS/Linux: 从 shell 文件加载托管块变量 ──
const selectedShellFile = ref('.zshrc')
const shellFileOptions = [
  { label: '~/.zshrc', value: '.zshrc' },
  { label: '~/.bashrc', value: '.bashrc' },
  { label: '~/.bash_profile', value: '.bash_profile' },
  { label: '~/.profile', value: '.profile' },
  { label: '~/.zprofile', value: '.zprofile' }
]
const loadingShell = ref(false)

function parseShellExports(content: string): EnvRow[] {
  const rows: EnvRow[] = []
  const lines = content.split('\n')
  let pendingComment = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) {
      pendingComment = trimmed.replace(/^#+\s*/, '')
      continue
    }
    const match = trimmed.match(/^export\s+([\w]+)=(.*)$/)
    if (match) {
      const key = match[1]
      let val = match[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      rows.push(newRow(key, val, pendingComment))
      pendingComment = ''
    } else {
      pendingComment = ''
    }
  }
  return rows
}

function serializeToExports(rows: EnvRow[]): string {
  return rows
    .filter(r => r.key.trim())
    .map(r => {
      const comment = r.comment.trim() ? `# ${r.comment.trim()}\n` : ''
      const val = r.value.includes(' ') ? `"${r.value}"` : r.value
      return `${comment}export ${r.key}=${val}`
    })
    .join('\n')
}

async function loadShellFile() {
  loadingShell.value = true
  try {
    const content = await window.electronAPI.readShellEnv(selectedShellFile.value)
    const blockMatch = content.match(/# >>> OneConfig managed block >>>([\s\S]*?)# <<< OneConfig managed block <<</s)
    const blockContent = blockMatch ? blockMatch[1].trim() : ''
    envRows.value = blockContent ? parseShellExports(blockContent) : []
    if (envRows.value.length === 0) envRows.value = [newRow()]
    isDirty.value = false
    if (shellEditor) {
      shellEditor.setValue(content)
      shellDirty.value = false
    }
  } catch (e: any) {
    message.error(`读取失败：${e?.message || e}`)
  } finally {
    loadingShell.value = false
  }
}

// ── 保存（可视化视图） ──
async function saveVisual() {
  saving.value = true
  try {
    if (isWindows) {
      pendingCommands.value = envRows.value
        .filter(r => r.key.trim())
        .map(r => `setx "${r.key}" "${r.value}" /M`)
      if (pendingCommands.value.length === 0) { saving.value = false; return }
      showPermDialog.value = true
    } else {
      const block = serializeToExports(envRows.value)
      const res = await window.electronAPI.writeShellEnv(selectedShellFile.value, block)
      if (res.success) {
        isDirty.value = false
        message.success('已保存，修改在新开终端后生效')
        await loadShellFile()
      }
    }
  } catch (e: any) {
    message.error(`保存失败：${e?.message || e}`)
  } finally {
    saving.value = false
  }
}

// ── Windows 权限保存 ──
const showPermDialog = ref(false)
const pendingCommands = ref<string[]>([])

async function doSaveWin() {
  try {
    for (const row of envRows.value.filter(r => r.key.trim())) {
      await window.electronAPI.setSystemEnv(row.key.trim(), row.value)
    }
    isDirty.value = false
    message.success('系统环境变量已设置，新进程中生效')
  } catch (e: any) {
    message.error(`设置失败：${e?.message || e}`)
  }
}

// ── 源码视图（macOS/Linux） ──
const shellMonacoContainer = ref<HTMLElement>()
let shellEditor: monaco.editor.IStandaloneCodeEditor | null = null
const shellDirty = ref(false)
const savingShell = ref(false)

async function saveShellFile() {
  savingShell.value = true
  try {
    const content = shellEditor?.getValue() || ''
    const res = await window.electronAPI.writeShellEnv(selectedShellFile.value, content)
    if (res.success) {
      shellDirty.value = false
      message.success('保存成功')
      envRows.value = parseShellExports(content)
      isDirty.value = false
    }
  } catch (e: any) {
    message.error(`保存失败：${e?.message || e}`)
  } finally {
    savingShell.value = false
  }
}

watch(activeView, async (v) => {
  if (v === 'source' && shellEditor) {
    requestAnimationFrame(() => shellEditor?.layout())
  }
})

onMounted(async () => {
  if (!isWindows && shellMonacoContainer.value) {
    shellEditor = monaco.editor.create(shellMonacoContainer.value, {
      value: '',
      language: 'shell',
      theme: 'vs',
      fontSize: 13,
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
    })
    shellEditor.onDidChangeModelContent(() => {
      shellDirty.value = true
    })
  }

  if (!isWindows) {
    await loadShellFile()
  } else {
    envRows.value = [newRow()]
    isDirty.value = false
  }
})

onUnmounted(() => {
  shellEditor?.dispose()
})
</script>

<style scoped>
:deep(.env-table .ant-table-cell) {
  cursor: default;
  padding: 8px 12px;
}
</style>
