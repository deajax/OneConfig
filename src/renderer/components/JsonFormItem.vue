<template>
  <!-- 对象：递归展开每个 key -->
  <template v-if="valueType === 'object'">
    <div class="jfi-object">
      <div
        v-for="(_, k) in modelValue as Record<string, unknown>"
        :key="String(k)"
        class="jfi-row"
      >
        <div class="jfi-label" :title="String(k)">{{ String(k) }}</div>
        <div class="jfi-control">
          <JsonFormItem
            :model-value="(modelValue as Record<string, unknown>)[String(k)]"
            :field-key="String(k)"
            :depth="depth + 1"
            @update:model-value="(v) => updateKey(String(k), v)"
          />
        </div>
      </div>
      <div v-if="Object.keys(modelValue as object).length === 0" class="jfi-empty">
        <span class="jfi-empty-text">空对象 { }</span>
      </div>
    </div>
  </template>

  <!-- 数组 -->
  <template v-else-if="valueType === 'array'">
    <div class="jfi-array">
      <div
        v-for="(item, idx) in modelValue as unknown[]"
        :key="idx"
        class="jfi-array-item"
      >
        <span class="jfi-array-idx">[{{ idx }}]</span>
        <div class="jfi-array-item-control">
          <JsonFormItem
            :model-value="item"
            :field-key="String(idx)"
            :depth="depth + 1"
            @update:model-value="(v) => updateIndex(idx, v)"
          />
        </div>
        <a-button
          type="text"
          size="small"
          danger
          class="jfi-array-del"
          @click="deleteIndex(idx)"
        >
          <template #icon><DeleteOutlined /></template>
        </a-button>
      </div>
      <a-button
        type="dashed"
        size="small"
        class="jfi-array-add"
        @click="addArrayItem"
      >
        <template #icon><PlusOutlined /></template>
        添加一项
      </a-button>
    </div>
  </template>

  <!-- boolean -->
  <template v-else-if="valueType === 'boolean'">
    <a-switch
      :checked="modelValue as boolean"
      size="small"
      @change="(v: boolean) => emit('update:modelValue', v)"
    />
    <span class="jfi-bool-label">{{ modelValue ? 'true' : 'false' }}</span>
  </template>

  <!-- number -->
  <template v-else-if="valueType === 'number'">
    <a-input-number
      :value="modelValue as number"
      size="small"
      :controls="false"
      class="jfi-input-number"
      @change="(v: number | null) => emit('update:modelValue', v ?? 0)"
    />
  </template>

  <!-- null -->
  <template v-else-if="valueType === 'null'">
    <span class="jfi-null">null</span>
  </template>

  <!-- string（默认） -->
  <template v-else>
    <a-textarea
      v-if="isMultiline"
      :value="String(modelValue ?? '')"
      size="small"
      :auto-size="{ minRows: 1, maxRows: 6 }"
      class="jfi-textarea"
      @change="(e: InputEvent) => emit('update:modelValue', (e.target as HTMLInputElement).value)"
    />
    <a-input
      v-else
      :value="String(modelValue ?? '')"
      size="small"
      class="jfi-input"
      @change="(e: InputEvent) => emit('update:modelValue', (e.target as HTMLInputElement).value)"
    />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'

// 声明自引用（递归）
import JsonFormItem from './JsonFormItem.vue'

interface Props {
  modelValue: unknown
  fieldKey?: string
  depth?: number
}

const props = withDefaults(defineProps<Props>(), {
  fieldKey: '',
  depth: 0
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const valueType = computed(() => {
  const v = props.modelValue
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v as 'string' | 'number' | 'boolean' | 'object'
})

// 超过 60 字符或包含换行的字符串用 textarea
const isMultiline = computed(() => {
  if (valueType.value !== 'string') return false
  const s = String(props.modelValue ?? '')
  return s.includes('\n') || s.length > 60
})

function updateKey(key: string, val: unknown) {
  const copy = { ...(props.modelValue as Record<string, unknown>) }
  copy[key] = val
  emit('update:modelValue', copy)
}

function updateIndex(idx: number, val: unknown) {
  const copy = [...(props.modelValue as unknown[])]
  copy[idx] = val
  emit('update:modelValue', copy)
}

function deleteIndex(idx: number) {
  const copy = [...(props.modelValue as unknown[])]
  copy.splice(idx, 1)
  emit('update:modelValue', copy)
}

function addArrayItem() {
  const arr = props.modelValue as unknown[]
  // 根据数组第一项推断新项类型
  const sample = arr[0]
  let defaultVal: unknown = ''
  if (typeof sample === 'number') defaultVal = 0
  else if (typeof sample === 'boolean') defaultVal = false
  else if (sample !== null && typeof sample === 'object') {
    defaultVal = Array.isArray(sample) ? [] : {}
  }
  emit('update:modelValue', [...arr, defaultVal])
}
</script>

<style lang="less" scoped>
.jfi-object {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.jfi-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: @space-3;
  align-items: flex-start;
  padding: @space-2 0;
  border-bottom: 1px solid @color-border-secondary;

  &:last-child {
    border-bottom: none;
  }
}

.jfi-label {
  font-size: @font-size-sm;
  font-weight: 500;
  color: @color-text-secondary;
  padding-top: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'SFMono-Regular', Consolas, monospace;
  user-select: none;
}

.jfi-control {
  min-width: 0;
  display: flex;
  align-items: flex-start;
}

// 嵌套对象加左侧缩进线
.jfi-object .jfi-object {
  border-left: 2px solid @color-border-secondary;
  padding-left: @space-3;
  margin-top: @space-1;
}

.jfi-empty {
  padding: @space-2;
}
.jfi-empty-text {
  color: @color-text-disabled;
  font-size: @font-size-sm;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.jfi-array {
  display: flex;
  flex-direction: column;
  gap: @space-1;
  width: 100%;
}

.jfi-array-item {
  display: flex;
  align-items: flex-start;
  gap: @space-2;
}

.jfi-array-idx {
  font-size: 11px;
  color: @color-text-disabled;
  font-family: 'SFMono-Regular', Consolas, monospace;
  padding-top: 5px;
  min-width: 28px;
  text-align: right;
  flex-shrink: 0;
}

.jfi-array-item-control {
  flex: 1;
  min-width: 0;
}

.jfi-array-del {
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.4;
  &:hover { opacity: 1; }
}

.jfi-array-add {
  margin-top: @space-1;
  font-size: @font-size-sm;
}

// 控件尺寸
.jfi-input,
.jfi-textarea,
.jfi-input-number {
  width: 100%;
}

.jfi-bool-label {
  font-size: @font-size-sm;
  color: @color-text-tertiary;
  margin-left: @space-2;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.jfi-null {
  font-size: @font-size-sm;
  color: @color-text-disabled;
  font-family: 'SFMono-Regular', Consolas, monospace;
  background: @color-fill;
  padding: 2px 6px;
  border-radius: @radius-sm;
}
</style>
