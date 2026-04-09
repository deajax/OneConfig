import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TerminalSession {
  id: string
  pid: number
  title: string
}

export const useTerminalStore = defineStore('terminal', () => {
  const sessions = ref<TerminalSession[]>([])
  const activeSessionId = ref<string | null>(null)

  function addSession(session: TerminalSession) {
    sessions.value.push(session)
    activeSessionId.value = session.id
  }

  function removeSession(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0]?.id ?? null
    }
  }

  function setActive(id: string) {
    activeSessionId.value = id
  }

  return { sessions, activeSessionId, addSession, removeSession, setActive }
})
