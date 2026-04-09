<template>
  <div class="jsf-root">
    <FormProvider :form="form">
      <SchemaField :schema="resolvedSchema" />
    </FormProvider>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { createForm } from '@formily/core'
import { FormProvider, createSchemaField } from '@formily/vue'
import {
  FormItem,
  Input,
  InputNumber,
  Switch,
  Select,
  ArrayItems,
  ArrayCards,
  FormLayout,
  Space,
  Password
} from '@formily/antdv'

const { SchemaField } = createSchemaField({
  components: {
    FormItem,
    FormLayout,
    Space,
    Input,
    'Input.TextArea': Input,
    NumberPicker: InputNumber,
    InputNumber,
    Switch,
    Select,
    ArrayItems,
    ArrayCards,
    Password
  }
})

interface Props {
  schema: object
  modelValue?: object
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({})
})

const emit = defineEmits<{
  'update:modelValue': [value: object]
  change: [value: object]
}>()

const form = createForm({
  initialValues: props.modelValue,
  effects() {
    // 空 effects，按需扩展校验逻辑
  }
})

// Schema 补全：确保每个字段带 x-decorator
const resolvedSchema = computed(() => normalizeSchema(props.schema))

function normalizeSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const result = { ...schema }
  if (schema.properties) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, val]: [string, any]) => [
        key,
        {
          'x-decorator': 'FormItem',
          'x-decorator-props': { label: val.title || key },
          ...normalizeSchema(val)
        }
      ])
    )
  }
  return result
}

// 监听外部 modelValue 变化（如加载模板）
watch(
  () => props.modelValue,
  (val) => {
    if (val && Object.keys(val).length > 0) {
      form.setValues(val, 'overwrite')
    }
  },
  { deep: true }
)

// 向外同步表单值
form.subscribe(() => {
  const values = form.getFormState().values
  emit('update:modelValue', values)
  emit('change', values)
})

defineExpose({ form })
</script>

<style lang="less" scoped>
.jsf-root {
  :deep(.ant-form-item) {
    margin-bottom: @space-4;
  }
}
</style>
