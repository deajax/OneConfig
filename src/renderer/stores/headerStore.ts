import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useHeaderStore = defineStore('header', () => {
  const title = ref('')
  const backHandler = shallowRef<(() => void) | null>(null)

  // 中/右区的 DOM 挂载点（由 AppHeader 组件提供，其他页面 Teleport 进来）
  const centerEl = shallowRef<HTMLElement | null>(null)
  const rightEl = shallowRef<HTMLElement | null>(null)

  function setTitle(t: string) {
    title.value = t
  }

  function setBack(fn: (() => void) | null) {
    backHandler.value = fn
  }

  function setCenterEl(el: HTMLElement | null) {
    centerEl.value = el
  }

  function setRightEl(el: HTMLElement | null) {
    rightEl.value = el
  }

  return { title, backHandler, centerEl, rightEl, setTitle, setBack, setCenterEl, setRightEl }
})
