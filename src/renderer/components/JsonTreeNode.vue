<template>
    <div class="w-full">
        <!-- ── 行（类表格行：固定 44px 行高，key 列固定宽，value 列自然拉伸） ── -->
        <div class="group flex items-center h-11 pr-3 border-b border-gray-100 transition-colors hover:bg-gray-50" :style="{ paddingLeft: `${depth * 24}px` }">
            <!-- 折叠箭头（5×44px 固定宽） -->
            <a-button v-if="isExpandable" type="text" :icon="h(CaretRightOutlined, { class: 'text-[10px]' })" :class="isOpen ? 'rotate-90' : ''" @click.stop="isOpen = !isOpen" size="small" />
            <span v-else class="hrink-0w-6"></span>

            <!-- key 列（固定 180px，竖向分隔线右侧） -->
            <div v-if="showKey" class="shrink-0 w-[180px] flex items-center gap-1.5 pr-4 border-r border-gray-100 mr-4">
                <!-- key 编辑中 -->
                <a-input
                    v-if="editingKey"
                    ref="keyInputRef"
                    v-model:value="pendingKey"
                    class="font-mono text-xs"
                    @blur="commitKey"
                    @keydown.enter="commitKey"
                    @keydown.escape="cancelKey"
                    @click.stop
                />
                <!-- key 展示 -->
                <span
                    v-else
                    class="w-full text-sm font-medium text-gray-600 font-mono truncate cursor-pointer rounded px-1 py-0.5 border border-transparent hover:border-gray-300 hover:bg-white hover:text-gray-800"
                    :class="isArrayItem ? 'text-gray-400 select-none' : ''"
                    :title="propKey"
                    @dblclick.stop="startEditKey"
                    >{{ propKey }}</span
                >
            </div>

            <!-- value 列（弹性填满，值控件默认尺寸） -->
            <div class="flex-1 min-w-0 flex items-center gap-2">
                <!-- object 徽标 -->
                <template v-if="valueType === 'object'">
                    <span
                        class="inline-flex items-center gap-1.5 text-sm font-mono px-2.5 py-1 rounded-md cursor-pointer select-none text-amber-700 bg-amber-50 border border-amber-200 hover:border-amber-400 transition-colors"
                        @click.stop="isOpen = !isOpen"
                    >
                        { } <span class="text-xs opacity-50 font-sans">{{ objKeyCount }} 个字段</span>
                    </span>
                </template>

                <!-- array 徽标 -->
                <template v-else-if="valueType === 'array'">
                    <span
                        class="inline-flex items-center gap-1.5 text-sm font-mono px-2.5 py-1 rounded-md cursor-pointer select-none text-purple-700 bg-purple-50 border border-purple-200 hover:border-purple-400 transition-colors"
                        @click.stop="isOpen = !isOpen"
                    >
                        [ ] <span class="text-xs opacity-50 font-sans">{{ (modelValue as unknown[]).length }} 项</span>
                    </span>
                </template>

                <!-- boolean -->
                <template v-else-if="valueType === 'boolean'">
                    <a-switch :checked="modelValue as boolean" @change="(v) => emitValue(!!v)" @click.stop />
                    <span class="text-sm font-mono px-2 py-0.5 rounded" :class="modelValue ? 'text-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-100'">
                        {{ modelValue ? "true" : "false" }}
                    </span>
                </template>

                <!-- number -->
                <template v-else-if="valueType === 'number'">
                    <a-input-number
                        :value="modelValue as number"
                        :controls="false"
                        class="w-full font-mono"
                        @change="(v) => emitValue(v == null ? 0 : Number(v))"
                        @click.stop
                    />
                </template>

                <!-- null -->
                <template v-else-if="valueType === 'null'">
                    <span class="text-sm font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">null</span>
                </template>

                <!-- string -->
                <template v-else>
                    <a-textarea
                        v-if="isMultiline"
                        :value="String(modelValue ?? '')"
                        :auto-size="{ minRows: 1, maxRows: 5 }"
                        class="w-full font-mono"
                        @change="(e: any) => emitValue(e.target.value)"
                        @click.stop
                    />
                    <a-input v-else :value="String(modelValue ?? '')" class="w-full font-mono" @change="(e: any) => emitValue(e.target.value)" @click.stop />
                </template>
            </div>

            <!-- 操作区（hover 显示，固定宽避免布局抖动） -->
            <div class="shrink-0 flex items-center gap-1 ml-2 w-[52px] justify-end transition-opacity" :class="isHovered ? 'opacity-100' : 'opacity-0'">
                <a-dropdown trigger="click" @click.stop>
                    <a-tooltip title="切换类型">
                        <a-button type="text" size="small" class="text-gray-400 hover:text-gray-700">
                            <template #icon><SwapOutlined /></template>
                        </a-button>
                    </a-tooltip>
                    <template #overlay>
                        <a-menu @click="(info: any) => switchType(String(info.key))">
                            <a-menu-item key="string">字符串 (string)</a-menu-item>
                            <a-menu-item key="number">数字 (number)</a-menu-item>
                            <a-menu-item key="boolean">开关 (boolean)</a-menu-item>
                            <a-menu-item key="null">空值 (null)</a-menu-item>
                            <a-menu-divider />
                            <a-menu-item key="object">对象 { }</a-menu-item>
                            <a-menu-item key="array">数组 [ ]</a-menu-item>
                        </a-menu>
                    </template>
                </a-dropdown>

                <a-tooltip v-if="!isRoot" title="删除">
                    <a-button type="text" size="small" danger @click.stop="emit('delete')">
                        <template #icon><DeleteOutlined /></template>
                    </a-button>
                </a-tooltip>
            </div>
        </div>

        <!-- ── 子节点 ── -->
        <template v-if="isExpandable && isOpen">
            <!-- object 子节点 -->
            <template v-if="valueType === 'object'">
                <JsonTreeNode
                    v-for="k in objectKeys"
                    :key="k"
                    :prop-key="k"
                    :model-value="(modelValue as Record<string, unknown>)[k]"
                    :depth="depth + 1"
                    :show-key="true"
                    @update:model-value="(v) => updateObjKey(k, v)"
                    @rename-key="(oldK, newK) => renameObjKey(oldK, newK)"
                    @delete="deleteObjKey(k)"
                />
                <!-- 新增 key 行 -->
                <div class="flex items-center h-10 border-b border-gray-100 pr-3" :style="{ paddingLeft: `${(depth + 1) * 24 + 20}px` }">
                    <a-input
                        v-if="addingKey"
                        ref="addKeyInputRef"
                        v-model:value="newKeyName"
                        placeholder="输入字段名…"
                        class="w-[200px] font-mono text-sm"
                        @blur="commitAddKey"
                        @keydown.enter="commitAddKey"
                        @keydown.escape="addingKey = false"
                    />
                    <a-button v-else type="text" block @click.stop="startAddKey">
                        <template #icon><PlusOutlined /></template>
                        添加字段
                    </a-button>
                </div>
            </template>

            <!-- array 子节点 -->
            <template v-if="valueType === 'array'">
                <JsonTreeNode
                    v-for="(item, idx) in modelValue as unknown[]"
                    :key="idx"
                    :prop-key="String(idx)"
                    :model-value="item"
                    :depth="depth + 1"
                    :show-key="true"
                    :is-array-item="true"
                    @update:model-value="(v) => updateArrIdx(idx, v)"
                    @delete="deleteArrIdx(idx)"
                />
                <div class="flex items-center h-10 border-b border-gray-100 pr-3" :style="{ paddingLeft: `${(depth + 1) * 24 + 20}px` }">
                    <a-button type="dashed" class="text-gray-400 hover:text-blue-500! hover:border-blue-400!" @click.stop="addArrItem">
                        <template #icon><PlusOutlined /></template>
                        添加一项
                    </a-button>
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
import { h, ref, computed, nextTick, watch } from "vue";
import { CaretRightOutlined, DeleteOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons-vue";
import JsonTreeNode from "./JsonTreeNode.vue";

interface Props {
    propKey: string;
    modelValue: unknown;
    depth?: number;
    showKey?: boolean;
    isRoot?: boolean;
    isArrayItem?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    depth: 0,
    showKey: false,
    isRoot: false,
    isArrayItem: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: unknown];
    "rename-key": [oldKey: string, newKey: string];
    delete: [];
}>();

const isOpen = ref(true);
const isHovered = ref(false);

const valueType = computed(() => {
    const v = props.modelValue;
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v as "string" | "number" | "boolean" | "object";
});

const isExpandable = computed(() => valueType.value === "object" || valueType.value === "array");

const isMultiline = computed(() => {
    if (valueType.value !== "string") return false;
    const s = String(props.modelValue ?? "");
    return s.includes("\n") || s.length > 80;
});

const objectKeys = computed(() => (valueType.value === "object" ? Object.keys(props.modelValue as object) : []));

const objKeyCount = computed(() => (valueType.value === "object" ? Object.keys(props.modelValue as object).length : 0));

watch(
    () => objectKeys.value.length,
    (n) => {
        if (n > 8 && props.depth > 0) isOpen.value = false;
    },
    { immediate: true },
);

function emitValue(v: unknown) {
    emit("update:modelValue", v);
}

function updateObjKey(key: string, val: unknown) {
    const copy = { ...(props.modelValue as Record<string, unknown>) };
    copy[key] = val;
    emitValue(copy);
}

function deleteObjKey(key: string) {
    const copy = { ...(props.modelValue as Record<string, unknown>) };
    delete copy[key];
    emitValue(copy);
}

function updateArrIdx(idx: number, val: unknown) {
    const copy = [...(props.modelValue as unknown[])];
    copy[idx] = val;
    emitValue(copy);
}

function deleteArrIdx(idx: number) {
    const copy = [...(props.modelValue as unknown[])];
    copy.splice(idx, 1);
    emitValue(copy);
}

function addArrItem() {
    const arr = props.modelValue as unknown[];
    const sample = arr[0];
    let def: unknown = "";
    if (typeof sample === "number") def = 0;
    else if (typeof sample === "boolean") def = false;
    else if (sample !== null && typeof sample === "object") def = Array.isArray(sample) ? [] : {};
    emitValue([...arr, def]);
}

const addingKey = ref(false);
const newKeyName = ref("");
const addKeyInputRef = ref<any>();

function startAddKey() {
    addingKey.value = true;
    newKeyName.value = "";
    nextTick(() => addKeyInputRef.value?.focus());
}

function commitAddKey() {
    const key = newKeyName.value.trim();
    addingKey.value = false;
    if (!key) return;
    const obj = props.modelValue as Record<string, unknown>;
    if (key in obj) return;
    updateObjKey(key, "");
    newKeyName.value = "";
}

const editingKey = ref(false);
const pendingKey = ref("");
const keyInputRef = ref<any>();

function startEditKey() {
    if (props.isArrayItem) return;
    editingKey.value = true;
    pendingKey.value = props.propKey;
    nextTick(() => keyInputRef.value?.focus());
}

function commitKey() {
    editingKey.value = false;
    const newK = pendingKey.value.trim();
    if (!newK || newK === props.propKey) return;
    emit("rename-key", props.propKey, newK);
}

function cancelKey() {
    editingKey.value = false;
}

function renameObjKey(oldK: string, newK: string) {
    const obj = props.modelValue as Record<string, unknown>;
    if (newK in obj) return;
    const newObj: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
        newObj[k === oldK ? newK : k] = obj[k];
    }
    emitValue(newObj);
}

function switchType(type: string) {
    const cur = props.modelValue;
    let next: unknown;
    switch (type) {
        case "string":
            next = String(cur ?? "");
            break;
        case "number":
            next = Number(cur) || 0;
            break;
        case "boolean":
            next = Boolean(cur);
            break;
        case "null":
            next = null;
            break;
        case "object":
            next = {};
            break;
        case "array":
            next = [];
            break;
        default:
            return;
    }
    emitValue(next);
    if (type === "object" || type === "array") isOpen.value = true;
}
</script>

<style scoped>
/* hover 触发操作区显示，用 group-hover 无法穿透嵌套，直接用 JS isHovered */
</style>
