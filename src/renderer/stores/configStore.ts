import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ConfigState {
  filePath: string | null
  rawJson: string
  parsedJson: object | null
  isDirty: boolean
  activeTemplate: string | null
  templates: string[]
}

export const useConfigStore = defineStore('config', () => {
  const filePath = ref<string | null>(null)
  const rawJson = ref('')
  const parsedJson = ref<object | null>(null)
  const isDirty = ref(false)
  const activeTemplate = ref<string | null>(null)
  const templates = ref<string[]>([])
  const schema = ref<object | null>(null)

  const hasFile = computed(() => filePath.value !== null)
  const isValid = computed(() => {
    try {
      if (!rawJson.value) return true
      JSON.parse(rawJson.value)
      return true
    } catch {
      return false
    }
  })

  function setFile(path: string, content: string) {
    filePath.value = path
    rawJson.value = content
    try {
      parsedJson.value = JSON.parse(content)
    } catch {
      parsedJson.value = null
    }
    isDirty.value = false
  }

  function updateRaw(content: string) {
    rawJson.value = content
    try {
      parsedJson.value = JSON.parse(content)
    } catch {
      parsedJson.value = null
    }
    isDirty.value = true
  }

  function updateParsed(data: object) {
    parsedJson.value = data
    rawJson.value = JSON.stringify(data, null, 2)
    isDirty.value = true
  }

  function markSaved(path?: string) {
    if (path) filePath.value = path
    isDirty.value = false
  }

  function setTemplate(name: string, tplSchema: object, defaults: object) {
    activeTemplate.value = name
    schema.value = tplSchema
    if (!hasFile.value) {
      rawJson.value = JSON.stringify(defaults, null, 2)
      parsedJson.value = defaults
    }
  }

  function setTemplates(list: string[]) {
    templates.value = list
  }

  function reset() {
    filePath.value = null
    rawJson.value = ''
    parsedJson.value = null
    isDirty.value = false
    activeTemplate.value = null
    schema.value = null
  }

  return {
    filePath, rawJson, parsedJson, isDirty, activeTemplate, templates, schema,
    hasFile, isValid,
    setFile, updateRaw, updateParsed, markSaved, setTemplate, setTemplates, reset
  }
})
