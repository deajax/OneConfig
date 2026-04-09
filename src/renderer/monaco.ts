/**
 * Monaco Editor 初始化 — 在 Electron renderer 中禁用 Web Worker 方式，
 * 改用 monaco-editor 内建的 simplified worker（避免 CSP / origin 问题）
 */
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  }
}

export { monaco }
