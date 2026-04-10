import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHeaderStore = defineStore('header', () => {
  const title = ref('')

  function setTitle(t: string) {
    title.value = t
  }

  return { title, setTitle }
})
