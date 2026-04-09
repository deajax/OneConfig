<template>
    <header class="app-header flex items-center h-[48px] border-b border-gray-100 bg-white shrink-0 gap-2 px-2 min-w-0">
        <!-- 左区：返回按钮 + 标题（no-drag） -->
        <div class="app-header__interactive flex items-center gap-2 shrink-0 max-w-3xs min-w-0">
            <a-button
                v-if="headerStore.backHandler"
                type="text"
                :icon="h(ArrowLeftOutlined)"
                shape="circle"
                @click="headerStore.backHandler!()"
            />
            <span class="font-semibold truncate" :class="!headerStore.backHandler ? 'pl-1' : ''">
                {{ headerStore.title }}
            </span>
        </div>

        <!-- 中区（no-drag，弹性居中） -->
        <div ref="centerRef" class="app-header__interactive flex-1 flex items-center justify-center min-w-0" />

        <!-- 右区（no-drag，内容右对齐） -->
        <div ref="rightRef" class="app-header__interactive shrink-0 flex items-center gap-2" />
    </header>
</template>

<script setup lang="ts">
import { h, ref, onMounted, onUnmounted } from "vue";
import { ArrowLeftOutlined } from "@ant-design/icons-vue";
import { useHeaderStore } from "@/stores/headerStore";
import transform from "ant-design-vue/es/_util/cssinjs/transformers/legacyLogicalProperties";

const headerStore = useHeaderStore();
const centerRef = ref<HTMLElement>();
const rightRef = ref<HTMLElement>();

onMounted(() => {
    headerStore.setCenterEl(centerRef.value ?? null);
    headerStore.setRightEl(rightRef.value ?? null);
});

onUnmounted(() => {
    headerStore.setCenterEl(null);
    headerStore.setRightEl(null);
});
</script>

<style lang="less" scoped>
// 整个头部可拖拽，仅这条规则 Tailwind 无法表达
.app-header {
    -webkit-app-region: drag;
    user-select: none;
}

// 左/中/右区内容不参与拖拽
.app-header__interactive {
    -webkit-app-region: no-drag;
}
</style>
