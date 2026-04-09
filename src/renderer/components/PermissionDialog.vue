<template>
  <a-modal
    v-model:open="visible"
    title="需要管理员权限"
    :footer="null"
    width="480"
    @cancel="handleCancel"
  >
    <div class="flex flex-col gap-4 pt-2">
      <div class="flex justify-center">
        <SafetyOutlined class="text-[40px] text-amber-500" />
      </div>
      <p class="m-0 text-gray-600 text-center">以下操作需要管理员权限才能执行：</p>
      <a-alert type="warning" :message="props.command" banner class="font-mono text-xs" />
      <a-alert v-if="props.warning" type="info" :message="props.warning" show-icon class="text-xs" />
      <div class="flex justify-end gap-2">
        <a-button @click="handleCancel">取消</a-button>
        <a-button type="primary" :loading="running" @click="handleConfirm">确认并执行</a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { SafetyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

interface Props {
  command: string
  warning?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  confirm: []
  cancel: []
  error: [err: string]
}>()

const visible = defineModel<boolean>('open', { default: false })
const running = ref(false)

async function handleConfirm() {
  running.value = true
  try {
    emit('confirm')
  } catch (e: any) {
    message.error(`执行失败：${e?.message || e}`)
    emit('error', e?.message || String(e))
  } finally {
    running.value = false
    visible.value = false
  }
}

function handleCancel() {
  emit('cancel')
  visible.value = false
}
</script>
