import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useProviderStore = defineStore('provider', () => {
  const profiles = ref<ProviderProfile[]>([])
  const loading = ref(false)
  const applied = ref(true) // 是否已应用到 .zshrc

  const activeProfile = computed(() => profiles.value.find(p => p.isActive) || null)
  const hasConfiguredProvider = computed(() => profiles.value.some(p => p.envVars['ANTHROPIC_API_KEY']?.trim()))

  async function loadProfiles() {
    loading.value = true
    try {
      profiles.value = await window.electronAPI.listProviders()
      applied.value = true
    } finally {
      loading.value = false
    }
  }

  async function createProfile(name: string, icon: string, envVars: Record<string, string>, models?: string[]) {
    const newProfile = await window.electronAPI.createProvider({
      name, icon, envVars, models, isActive: profiles.value.length === 0
    })
    profiles.value.push(newProfile)
    return newProfile
  }

  async function updateProfile(id: string, updates: { name?: string; icon?: string; envVars?: Record<string, string>; models?: string[] }) {
    const updated = await window.electronAPI.updateProvider(id, updates)
    if (!updated) return
    const idx = profiles.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      profiles.value[idx] = updated
      applied.value = false
    }
  }

  async function deleteProfile(id: string) {
    const res = await window.electronAPI.deleteProvider(id)
    if (!res.success) return
    profiles.value = profiles.value.filter(p => p.id !== id)
  }

  async function activateProfile(id: string) {
    const res = await window.electronAPI.activateProvider(id)
    if (!res.success) return
    profiles.value.forEach(p => p.isActive = p.id === id)
    applied.value = false
  }

  async function applyProfile(shellFile = '.zshrc') {
    const res = await window.electronAPI.applyProvider(shellFile)
    if (res.success) {
      applied.value = true
    }
    return res
  }

  async function setModel(id: string, model: string) {
    const idx = profiles.value.findIndex(p => p.id === id)
    if (idx === -1) return
    const newEnvVars = { ...profiles.value[idx].envVars, ANTHROPIC_MODEL: model }
    await window.electronAPI.updateProvider(id, { envVars: newEnvVars })
    profiles.value[idx].envVars = newEnvVars
    applied.value = false
  }

  function reset() {
    profiles.value = []
    loading.value = false
    applied.value = true
  }

  return {
    profiles, loading, applied, activeProfile, hasConfiguredProvider,
    loadProfiles, createProfile, updateProfile, deleteProfile, activateProfile, applyProfile, setModel, reset
  }
})
