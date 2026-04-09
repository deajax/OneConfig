<template>
  <div class="flex flex-col h-full bg-[#1a1a1a]">
    <!-- 注入头部中区：terminal tabs -->
    <Teleport v-if="headerStore.centerEl" :to="headerStore.centerEl">
      <div class="flex items-center gap-1">
        <div
          v-for="session in terminalStore.sessions"
          :key="session.id"
          role="tab"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs cursor-pointer transition-colors border select-none"
          :class="terminalStore.activeSessionId === session.id
            ? 'bg-white/12 border-white/15 text-white/85'
            : 'bg-white/6 border-transparent text-white/55 hover:bg-white/10 hover:text-white/85'"
          @click="terminalStore.setActive(session.id)"
        >
          <ConsoleSqlOutlined class="text-[13px] shrink-0" />
          <span>{{ session.title }}</span>
          <span
            role="button"
            tabindex="0"
            class="inline-flex items-center justify-center w-4 h-4 rounded ml-0.5 hover:bg-white/15"
            @click.stop="closeSession(session.id)"
            @keydown.enter.stop="closeSession(session.id)"
          >
            <CloseOutlined class="text-[10px]" />
          </span>
        </div>
      </div>
    </Teleport>

    <!-- 注入头部右区：新建按钮 -->
    <Teleport v-if="headerStore.rightEl" :to="headerStore.rightEl">
      <a-button size="small" @click="openNewSession">
        <template #icon><PlusOutlined /></template>
        新建
      </a-button>
    </Teleport>

    <!-- 终端内容 -->
    <div class="flex-1 overflow-hidden relative">
      <template v-for="session in terminalStore.sessions" :key="session.id">
        <div
          class="absolute inset-0 p-2"
          :class="terminalStore.activeSessionId === session.id ? 'flex' : 'hidden'"
        >
          <TerminalPane
            :session-id="session.id"
            @ready="(pid) => onReady(session.id, pid)"
            @exit="onExit"
          />
        </div>
      </template>

      <!-- 空态 -->
      <div v-if="terminalStore.sessions.length === 0" class="flex items-center justify-center h-full">
        <a-empty description="点击「新建」打开一个终端会话">
          <template #description>
            <span class="text-white/45">点击「新建」打开一个终端会话</span>
          </template>
          <a-button type="primary" @click="openNewSession">
            <template #icon><PlusOutlined /></template>
            新建终端
          </a-button>
        </a-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { ConsoleSqlOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useTerminalStore } from '@/stores/terminalStore'
import { useHeaderStore } from '@/stores/headerStore'
import TerminalPane from '@/components/TerminalPane.vue'

const terminalStore = useTerminalStore()
const headerStore = useHeaderStore()

onMounted(() => {
  headerStore.setTitle('终端')
  headerStore.setBack(null)
})
onUnmounted(() => headerStore.setTitle(''))
let sessionCounter = 0

function openNewSession() {
  sessionCounter += 1
  const id = `session-${sessionCounter}-${Date.now()}`
  terminalStore.addSession({ id, pid: 0, title: `终端 ${sessionCounter}` })
}

function closeSession(id: string) {
  terminalStore.removeSession(id)
}

function onReady(sessionId: string, pid: number) {
  const session = terminalStore.sessions.find((s) => s.id === sessionId)
  if (session) session.pid = pid
}

function onExit(sessionId: string) {
  terminalStore.removeSession(sessionId)
}
</script>
