<template>
  <PageContainer
    :title="displayName"
    :show-back="true"
    :on-back="handleBack"
  >
    <template #extra>
      <div class="flex items-center gap-2">
        <a-segmented v-model:value="activeView" :options="viewOptions" size="small" />
        <a-tag v-if="configStore.isDirty" color="warning" style="margin: 0">未保存</a-tag>
        <a-tag v-if="!configStore.isValid && activeView === 'source'" color="error" style="margin: 0">语法错误</a-tag>
        <div class="flex items-center gap-1 ml-2">
          <a-button :icon="h(FolderOpenOutlined)" size="small" @click="handleOpenFile"> 打开 </a-button>
          <a-button type="primary" :icon="h(SaveOutlined)" size="small" :disabled="!configStore.isDirty" @click="handleSave"> 保存 </a-button>
          <a-dropdown>
            <a-button :icon="h(EllipsisOutlined)" size="small" />
            <template #overlay>
              <a-menu>
                <a-menu-item key="saveAs" @click="handleSaveAs">另存为</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="format" @click="handleFormat" :disabled="activeView !== 'source'">格式化 JSON</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </template>

    <!-- 主体：可视化 -->
    <div v-show="activeView === 'visual'" class="flex flex-col h-full overflow-hidden">
      <template v-if="configStore.parsedJson !== null && typeof configStore.parsedJson === 'object'">
        <!-- 列头 -->
        <div class="shrink-0 flex items-center h-10 px-2 border-b border-gray-100 text-xs font-semibold select-none">
          <span class="w-5 shrink-0" />
          <span class="w-[180px] shrink-0 pr-2 border-r border-gray-200 mr-3">字段名</span>
          <span class="flex-1">值</span>
        </div>
        <!-- 数据行 -->
        <div class="flex-1 overflow-y-auto">
          <template v-if="!Array.isArray(configStore.parsedJson)">
            <JsonTreeNode
              v-for="k in Object.keys(configStore.parsedJson as object)"
              :key="k"
              :prop-key="k"
              :model-value="(configStore.parsedJson as Record<string, unknown>)[k]"
              :depth="0"
              :show-key="true"
              @update:model-value="(v) => handleRootKeyUpdate(k, v)"
              @rename-key="(oldK, newK) => handleRootRename(oldK, newK)"
              @delete="handleRootDelete(k)"
            />
            <div class="flex items-center h-11 px-3 border-b border-gray-100" style="padding-left: 32px">
              <a-input
                v-if="addingRootKey"
                ref="rootKeyInputRef"
                v-model:value="newRootKeyName"
                placeholder="输入字段名…"
                class="w-[200px] font-mono"
                @blur="commitRootKey"
                @keydown.enter="commitRootKey"
                @keydown.escape="addingRootKey = false"
              />
              <a-button
                v-else
                type="dashed"
                block
                class="text-gray-400 hover:text-blue-500! hover:border-blue-400!"
                :icon="h(PlusOutlined)"
                @click="startAddRootKey"
              >
                添加根字段
              </a-button>
            </div>
          </template>
          <template v-else>
            <JsonTreeNode
              v-for="(item, idx) in configStore.parsedJson as unknown[]"
              :key="idx"
              :prop-key="String(idx)"
              :model-value="item"
              :depth="0"
              :show-key="true"
              :is-array-item="true"
              @update:model-value="(v) => handleRootArrUpdate(idx, v)"
              @delete="handleRootArrDelete(idx)"
            />
          </template>
        </div>
      </template>
      <div v-else class="flex-1 flex items-center justify-center">
        <a-result status="warning" title="JSON 格式错误" sub-title="请切换到「源码视图」修正语法后再使用可视化编辑">
          <template #extra>
            <a-button type="primary" @click="activeView = 'source'">切换到源码视图</a-button>
          </template>
        </a-result>
      </div>
    </div>

    <!-- 主体：源码 Monaco -->
    <div v-show="activeView === 'source'" class="flex-1 overflow-hidden relative">
      <div ref="monacoContainer" class="absolute inset-0" />
    </div>

    <!-- 底栏 -->
    <template #footer>
      <div class="flex items-center justify-between px-2">
        <span class="text-[11px] text-gray-400 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[60%]" :title="configStore.filePath || ''">
          {{ configStore.filePath || "未保存文件" }}
        </span>
        <span class="text-[11px] shrink-0" :class="configStore.isValid ? 'text-green-500' : 'text-red-500'">
          {{ configStore.isValid ? "✓ 有效 JSON" : "✗ 语法错误" }}
        </span>
      </div>
    </template>
  </PageContainer>
</template>

<script setup lang="ts">
import { h, ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { FolderOpenOutlined, SaveOutlined, EllipsisOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { monaco } from '@/monaco'
import { useConfigStore } from '@/stores/configStore'
import { openDroppedFile } from '@/composables/useFileDrop'
import JsonTreeNode from '@/components/JsonTreeNode.vue'
import PageContainer from '@/components/PageContainer.vue'

const router = useRouter()
const configStore = useConfigStore()
const monacoContainer = ref<HTMLElement>()
const activeView = ref<'visual' | 'source'>('visual')
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let ignoreChange = false

const viewOptions = [
  { label: '可视化', value: 'visual' },
  { label: '源码', value: 'source' }
]

const displayName = computed(() => {
  const p = configStore.filePath
  if (!p) return '新建配置'
  return p.replace(/\\/g, '/').split('/').pop() || p
})

onMounted(() => {
  if (!monacoContainer.value) return
  editor = monaco.editor.create(monacoContainer.value, {
    value: configStore.rawJson || '{}',
    language: 'json',
    theme: 'vs',
    fontSize: 13,
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    formatOnPaste: true,
    wordWrap: 'off',
    renderLineHighlight: 'line',
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
  })
  editor.onDidChangeModelContent(() => {
    if (ignoreChange) return
    configStore.updateRaw(editor!.getValue())
  })
})

onUnmounted(() => editor?.dispose())

watch(() => configStore.rawJson, (v) => {
  if (!editor) return
  if (editor.getValue() === v) return
  ignoreChange = true
  const pos = editor.getPosition()
  editor.setValue(v)
  if (pos) editor.setPosition(pos)
  ignoreChange = false
})

watch(activeView, (v) => {
  if (v === 'source' && editor) {
    const current = editor.getValue()
    if (current !== configStore.rawJson) {
      ignoreChange = true
      editor.setValue(configStore.rawJson)
      ignoreChange = false
    }
    requestAnimationFrame(() => editor?.layout())
  }
})

const addingRootKey = ref(false)
const newRootKeyName = ref('')
const rootKeyInputRef = ref<any>()

function handleRootKeyUpdate(key: string, val: unknown) {
  const obj = { ...(configStore.parsedJson as Record<string, unknown>) }
  obj[key] = val
  configStore.updateParsed(obj)
}

function handleRootRename(oldK: string, newK: string) {
  const obj = configStore.parsedJson as Record<string, unknown>
  if (newK in obj) return
  const newObj: Record<string, unknown> = {}
  for (const k of Object.keys(obj)) newObj[k === oldK ? newK : k] = obj[k]
  configStore.updateParsed(newObj)
}

function handleRootDelete(key: string) {
  const obj = { ...(configStore.parsedJson as Record<string, unknown>) }
  delete obj[key]
  configStore.updateParsed(obj)
}

function startAddRootKey() {
  addingRootKey.value = true
  newRootKeyName.value = ''
  nextTick(() => rootKeyInputRef.value?.focus())
}

function commitRootKey() {
  addingRootKey.value = false
  const key = newRootKeyName.value.trim()
  if (!key) return
  const obj = configStore.parsedJson as Record<string, unknown>
  if (key in obj) return
  handleRootKeyUpdate(key, '')
  newRootKeyName.value = ''
}

function handleRootArrUpdate(idx: number, val: unknown) {
  const arr = [...(configStore.parsedJson as unknown[])]
  arr[idx] = val
  configStore.updateParsed(arr as any)
}

function handleRootArrDelete(idx: number) {
  const arr = [...(configStore.parsedJson as unknown[])]
  arr.splice(idx, 1)
  configStore.updateParsed(arr as any)
}

function handleFormat() {
  if (!editor) return
  editor.getAction('editor.action.formatDocument')?.run()
}

function handleBack() {
  if (configStore.isDirty && !window.confirm('有未保存的修改，确定离开吗？')) return
  router.push('/config')
}

async function handleOpenFile() {
  const result = await window.electronAPI.openJsonFile()
  if (!result) return
  configStore.setFile(result.filePath, result.content)
  message.success('文件已打开')
}

async function handleSave() {
  if (!configStore.filePath) return handleSaveAs()
  if (!configStore.isValid) {
    message.error('JSON 格式错误，无法保存')
    return
  }
  const res = await window.electronAPI.saveJsonFile(configStore.filePath, configStore.rawJson)
  if (res.success) {
    configStore.markSaved()
    message.success('已保存')
  }
}

async function handleSaveAs() {
  if (!configStore.isValid) {
    message.error('JSON 格式错误，无法保存')
    return
  }
  const res = await window.electronAPI.saveJsonFileAs(configStore.rawJson)
  if (res) {
    configStore.markSaved(res.filePath)
    message.success('已另存为')
  }
}

async function handleDrop(e: DragEvent) {
  const jsonFiles = Array.from(e.dataTransfer?.files || []).filter((f) => f.name.endsWith('.json'))
  if (jsonFiles.length === 0) {
    message.warning('请拖入 .json 文件')
    return
  }
  if (configStore.isDirty && !window.confirm('有未保存的修改，确定替换吗？')) return
  try {
    const result = await openDroppedFile(jsonFiles[0])
    if (!result) {
      message.error('文件读取失败')
      return
    }
    configStore.setFile(result.filePath, result.content)
    if (!result.filePath) message.info(`已读取「${result.fileName}」，请「另存为」保存修改`)
    else message.success('文件已打开')
  } catch {
    message.error('无法读取文件')
  }
}
</script>
