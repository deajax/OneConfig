<template>
  <div
    ref="containerRef"
    class="w-full h-full bg-[#1a1a1a] rounded-md overflow-hidden pointer-events-auto cursor-text"
    @click="focusTerminal"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  ready: [pid: number]
  exit: [sessionId: string]
}>()

const containerRef = ref<HTMLElement>()
let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let removeDataListener: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

function focusTerminal() {
  term?.focus()
}

onMounted(async () => {
  await nextTick()

  term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    allowProposedApi: true,
    theme: {
      background: '#1a1a1a',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      selectionBackground: 'rgba(255, 255, 255, 0.2)'
    }
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(containerRef.value!)

  await nextTick()
  fitAddon.fit()
  term.focus()

  const { pid } = await window.electronAPI.terminalStart(props.sessionId, term.cols, term.rows)
  emit('ready', pid)

  removeDataListener = window.electronAPI.onTerminalData(props.sessionId, (data) => {
    term?.write(data)
  })

  term.onData((data) => {
    window.electronAPI.terminalInput(props.sessionId, data)
  })

  resizeObserver = new ResizeObserver(() => {
    if (!term || !fitAddon) return
    fitAddon.fit()
    window.electronAPI.terminalResize(props.sessionId, term.cols, term.rows)
  })
  resizeObserver.observe(containerRef.value!)
})

onUnmounted(async () => {
  resizeObserver?.disconnect()
  removeDataListener?.()
  term?.dispose()
  await window.electronAPI.terminalStop(props.sessionId)
  emit('exit', props.sessionId)
})
</script>

<style scoped>
/* xterm 内部 DOM 无法用 Tailwind 覆盖，必须保留 :deep() */
:deep(.xterm) {
  height: 100%;
  padding: 8px;
}
:deep(.xterm-viewport) {
  border-radius: 6px;
}
:deep(.xterm-screen) {
  pointer-events: auto;
}
</style>
