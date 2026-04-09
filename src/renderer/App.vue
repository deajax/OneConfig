<template>
    <a-config-provider :theme="antdTheme">
        <div class="app-shell flex h-screen overflow-hidden bg-gray-50" style="-webkit-app-region: no-drag">
            <!-- 侧边导航 -->
            <aside class="app-sider w-[200px] shrink-0 flex flex-col bg-white border-r border-gray-100 select-none">
                <!-- macOS 交通灯占位（可拖拽） -->
                <div class="app-titlebar h-[48px] shrink-0 border-b border-gray-100" style="-webkit-app-region: drag" />

                <a-menu
                    v-model:selectedKeys="selectedKeys"
                    v-model:openKeys="openKeys"
                    mode="inline"
                    :inline-collapsed="collapsed"
                    class="border-none"
                    @click="handleMenuClick"
                >
                    <a-menu-item key="/config">
                        <template #icon><CodeOutlined /></template>
                        <span>配置编辑</span>
                    </a-menu-item>
                    <a-menu-item key="/env">
                        <template #icon><DatabaseOutlined /></template>
                        <span>环境变量</span>
                    </a-menu-item>
                    <a-menu-item key="/terminal">
                        <template #icon><CodeSandboxOutlined /></template>
                        <span>终端</span>
                    </a-menu-item>
                    <a-sub-menu key="tools">
                        <template #title>
                            <span><ToolOutlined /><span>工具配置</span></span>
                        </template>
                        <a-menu-item key="/config/claude-code">Claude Code</a-menu-item>
                        <a-menu-item key="/config/openclaw">OpenClaw</a-menu-item>
                    </a-sub-menu>
                </a-menu>
            </aside>

            <!-- 主内容区 -->
            <main class="flex-1 overflow-hidden flex flex-col min-w-0">
                <AppHeader />
                <div class="flex-1 overflow-hidden flex flex-col">
                    <router-view v-slot="{ Component }">
                        <transition name="fade" mode="out-in">
                            <component :is="Component" />
                        </transition>
                    </router-view>
                </div>
            </main>
        </div>
    </a-config-provider>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { CodeOutlined, DatabaseOutlined, CodeSandboxOutlined, ToolOutlined } from "@ant-design/icons-vue";
import { theme } from "ant-design-vue";
import AppHeader from "@/components/AppHeader.vue";

const router = useRouter()
const route = useRoute()

const antdTheme = {
    algorithm: theme.defaultAlgorithm,
    token: {
        colorPrimary: "#1677ff",
        borderRadius: 6,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
};

const collapsed = ref(false)
const selectedKeys = ref<string[]>([])
const openKeys = ref<string[]>([])

watch(() => route.path, (path) => {
    selectedKeys.value = [path]
    if (path.startsWith('/config/edit')) {
        openKeys.value = ['tools']
    }
}, { immediate: true })

function handleMenuClick({ key }: { key: string }) {
    router.push(key)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
