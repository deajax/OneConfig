<template>
  <PageContainer>
    <template #extra>
      <a-button type="primary" size="small" :icon="h(FolderOpenOutlined)" @click="handleOpenFile">
        导入文件
      </a-button>
    </template>

    <div
      class="relative flex flex-col h-full overflow-hidden"
      :class="isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <!-- 拖拽遮罩 -->
      <div
        v-if="isDragOver"
        class="absolute inset-0 bg-blue-500/5 border-2 border-dashed border-blue-400 rounded-xl z-[100] flex items-center justify-center pointer-events-none"
      >
        <div class="flex flex-col items-center gap-3 text-blue-500 font-medium">
          <InboxOutlined class="text-[48px]" />
          <span>松开以导入 JSON 文件</span>
        </div>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- 拖拽提示条 -->
        <div
          v-if="managedFiles.length === 0"
          class="flex items-center gap-2 text-gray-400 text-sm px-4 py-3 border border-dashed border-gray-300 rounded-md mb-4 bg-gray-50"
        >
          <InboxOutlined class="text-base shrink-0" />
          <span>拖拽 JSON 文件到此处，或点击「导入文件」</span>
        </div>

        <!-- 管理文件列表 -->
        <section v-if="managedFiles.length > 0" class="mb-8">
          <h2 class="text-sm font-semibold text-gray-500 m-0 mb-3">已管理的配置文件</h2>
          <div class="flex flex-col gap-1">
            <div
              v-for="item in managedFiles"
              :key="item.id"
              class="group flex items-center gap-3 px-4 py-3 rounded-md border border-gray-100 bg-white cursor-pointer transition-all hover:border-blue-400 hover:shadow-sm"
              @click="openManagedFile(item)"
            >
              <div class="text-[20px] text-blue-500 flex items-center shrink-0">
                <FileOutlined />
              </div>
              <div class="flex-1 overflow-hidden flex flex-col gap-0.5">
                <span class="text-sm font-medium text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis">{{ item.name }}</span>
                <span class="text-xs text-gray-400 font-mono whitespace-nowrap overflow-hidden text-ellipsis">{{ item.path }}</span>
              </div>
              <a-popconfirm
                title="确定移除此文件？"
                ok-text="移除"
                cancel-text="取消"
                @confirm="removeManaged(item.id)"
              >
                <a-button
                  type="text"
                  size="small"
                  class="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity text-gray-400 hover:!text-red-500"
                  @click.stop
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </section>

        <!-- 空态 -->
        <div v-if="managedFiles.length === 0" class="flex items-center justify-center h-full min-h-[300px]">
          <a-empty description="暂无已管理的文件">
            <a-button type="primary" :icon="h(FolderOpenOutlined)" @click="handleOpenFile">
              导入 JSON 文件
            </a-button>
          </a-empty>
        </div>
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { h, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { FolderOpenOutlined, FileOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons-vue'
import { useConfigStore } from '@/stores/configStore'
import { openDroppedFile } from '@/composables/useFileDrop'
import PageContainer from '@/components/PageContainer.vue'

interface ManagedFile {
  id: string
  name: string
  path: string
  addedAt: number
}

const router = useRouter()
const configStore = useConfigStore()
const isDragOver = ref(false)
const managedFiles = ref<ManagedFile[]>([])

async function loadManagedFiles() {
  managedFiles.value = await window.electronAPI.listManaged()
}

async function handleOpenFile() {
  const result = await window.electronAPI.openJsonFile()
  if (!result) return
  configStore.setFile(result.filePath, result.content)
  await window.electronAPI.addManaged(result.filePath)
  await loadManagedFiles()
  router.push('/config/edit')
}

async function openManagedFile(item: ManagedFile) {
  try {
    const result = await window.electronAPI.openRecentFile(item.path)
    if (!result) {
      message.error('文件不存在或无法读取')
      await window.electronAPI.removeManaged(item.id)
      await loadManagedFiles()
      return
    }
    configStore.setFile(result.filePath, result.content)
    router.push('/config/edit')
  } catch {
    message.error('无法打开文件')
    await window.electronAPI.removeManaged(item.id)
    await loadManagedFiles()
  }
}

async function removeManaged(id: string) {
  await window.electronAPI.removeManaged(id)
  await loadManagedFiles()
  message.success('已移除')
}

function handleDragLeave(e: DragEvent) {
  const rel = e.relatedTarget as Node | null
  if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) {
    isDragOver.value = false
  }
}

async function handleDrop(e: DragEvent) {
  isDragOver.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  const jsonFiles = files.filter((f) => f.name.endsWith('.json'))
  if (jsonFiles.length === 0) {
    message.warning('请拖入 .json 文件')
    return
  }
  try {
    const result = await openDroppedFile(jsonFiles[0])
    if (!result) {
      message.error('文件读取失败')
      return
    }
    configStore.setFile(result.filePath, result.content)
    if (result.filePath) {
      await window.electronAPI.addManaged(result.filePath)
      await loadManagedFiles()
    } else {
      message.info(`已读取「${result.fileName}」，路径未知，请「另存为」保存修改`)
    }
    router.push('/config/edit')
  } catch {
    message.error('无法读取文件')
  }
}

onMounted(loadManagedFiles)
</script>
