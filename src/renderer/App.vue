<template>
	<a-config-provider :theme="antdTheme" :locale="locale" :autoInsertSpaceInButton="false">
		<a-layout class="h-screen overflow-hidden">
			<a-layout-header class="px-2! h-12! leading-12! bg-transparent!" style="-webkit-app-region: drag">
				<header class="relative flex items-center h-full">
					<!-- Windows 专属左上角图标（mac 有交通灯按钮不需要） -->
					<div v-if="isWin" class="flex items-center gap-2 px-3" style="-webkit-app-region: no-drag">
						<ControlTwoTone class="text-lg" style="color: var(--ant-color-primary)" />
						<span class="text-sm font-bold">OneConfig</span>
					</div>
					<!-- 收起/展开按钮 -->
					<div class="pl-2" style="-webkit-app-region: no-drag">
						<a-button type="text" :icon="collapsed ? h(LayoutOutlined) : h(LayoutTwoTone)"
							@click="collapsed = !collapsed" />
					</div>
					<div v-if="!isWin" class="absolute h-full top-0 bottom-0 left-1/2 -translate-x-1/2">
						<h3 class="">OneConfig</h3>
					</div>
					<!-- 右侧操作区 -->
					<a-space class="flex items-center gap-1 ml-auto mr-0" style="-webkit-app-region: no-drag">
						<a-button type="text" :icon="h(QuestionCircleOutlined, { style: 'font-size: 18px;' })"
							@click="openHelp" />
						<a-button type="text" :icon="h(GithubOutlined, { style: 'font-size: 18px;' })"
							@click="openGithub" />
						<!-- Windows 窗口控制按钮 -->
						<div class="ml-2" v-if="isWin">
							<a-button type="text" class="win-control-btn" @click="minimizeWindow">
								<template #icon>
									<MinusOutlined />
								</template>
							</a-button>
							<!-- <a-button type="text" class="win-control-btn" @click="maximizeWindow">
								<template #icon>
									<ExpandOutlined v-if="!isMaximized" />
									<FullscreenExitOutlined v-else />
								</template>
							</a-button> -->
							<a-button type="text" class="win-control-btn win-close-btn" @click="closeWindow">
								<template #icon>
									<CloseOutlined />
								</template>
							</a-button>
						</div>
					</a-space>
				</header>
			</a-layout-header>
			<!-- 主内容 -->
			<a-layout>
				<!-- 侧边栏 -->
				<a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible :width="200"
					:collapsedWidth="64" theme="light" class="layout-sider p-2! bg-transparent!">
					<!-- 导航菜单 -->
					<a-menu v-model:selectedKeys="selectedKeys" mode="inline" :items="menuItems"
						class="layout-sider-menu border-none! bg-transparent!" @click="handleMenuClick" />
				</a-layout-sider>
				<a-layout-content class="overflow-hidden bg-white! rounded-tl-xl">
					<router-view v-slot="{ Component }">
						<transition name="fade" mode="out-in">
							<component :is="Component" />
						</transition>
					</router-view>
				</a-layout-content>
			</a-layout>
		</a-layout>
	</a-config-provider>
</template>

<script setup lang="ts">
import { h, ref, watch, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
	LayoutOutlined,
	GithubOutlined,
	QuestionCircleOutlined,
	ControlTwoTone,
	LayoutTwoTone,
	MinusOutlined,
	CloseOutlined,
	ExpandOutlined,
	FullscreenExitOutlined,
} from "@ant-design/icons-vue";
import { theme } from "ant-design-vue";
import { menuItems } from "@/config/menu";
import zhCN from 'ant-design-vue/es/locale/zh_CN';

const locale = computed(() => zhCN);

function openGithub() {
	window.open("https://github.com", "_blank");
}

function openHelp() {
	window.open("https://github.com", "_blank");
}

// ---- Windows 窗口控制 ----
const isWin = window.electronAPI?.platform === 'win32';
const isMaximized = ref(false);

function minimizeWindow() {
	// @ts-ignore
	window.electronAPI?.minimizeWindow?.();
}
function maximizeWindow() {
	// @ts-ignore
	window.electronAPI?.maximizeWindow?.();
}
function closeWindow() {
	// @ts-ignore
	window.electronAPI?.closeWindow?.();
}

const router = useRouter();
const route = useRoute();

const antdTheme = {
	algorithm: theme.defaultAlgorithm,
	token: {
		colorPrimary: "#1677ff",
		borderRadius: 6,
		fontFamily:
			"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
	},
};

const collapsed = ref(true);
const selectedKeys = ref<string[]>([]);

watch(
	() => route.path,
	(path) => {
		selectedKeys.value = [path];
	},
	{ immediate: true }
);

function handleMenuClick({ key }: { key: string }) {
	router.push(key);
}

const antdMenuItems = computed(() =>
	menuItems.map((item) => ({
		key: item.key,
		icon: item.icon,
		label: item.label,
	}))
);
</script>

<style lang="less" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.layout-sider-menu {
	:deep(.ant-menu-item-selected) {
		background: @color-primary;
		color: white;
	}
}

// Windows 窗口控制按钮样式
:deep(.win-control-btn) {
	.ant-btn {
		width: 46px;
		height: 32px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0;
	}

	.ant-btn:hover {
		background-color: rgba(0, 0, 0, 0.06);
	}
}

:deep(.win-close-btn) {
	.ant-btn:hover {
		background-color: #c42b1c;
		color: #fff;
	}
}
</style>
