<template>
	<a-config-provider :theme="antdTheme" :locale="locale" :autoInsertSpaceInButton="false">
		<a-layout class="h-screen overflow-hidden">
			<a-layout-header
				class="px-6! h-12! leading-12! bg-transparent!"
				style="-webkit-app-region: drag"
			>
				<header class="relative flex items-center h-full">
					<!-- 收起/展开按钮 -->
					<div class="pl-18" style="-webkit-app-region: no-drag">
						<a-button
							type="text"
							:icon="h(LayoutOutlined)"
							@click="collapsed = !collapsed"
						/>
					</div>
					<div class="absolute h-full top-0 bottom-0 left-1/2 -translate-x-1/2">
						<h3 class="">OneConfig</h3>
					</div>
					<!-- 右侧操作区 -->
					<div
						class="flex items-center gap-2 ml-auto"
						style="-webkit-app-region: no-drag"
					>
						<a-button
							type="text"
							:icon="
								h(QuestionCircleOutlined, {
									style: 'font-size: 18px;',
								})
							"
							@click="openHelp"
						/>
						<a-button
							type="text"
							:icon="h(GithubOutlined, { style: 'font-size: 18px;' })"
							@click="openGithub"
						/>
					</div>
				</header>
			</a-layout-header>
			<!-- 主内容 -->
			<a-layout>
				<!-- 侧边栏 -->
				<a-layout-sider
					v-model:collapsed="collapsed"
					:trigger="null"
					collapsible
					:width="200"
                    :collapsedWidth="64"
					theme="light"
					class="layout-sider p-2! bg-transparent!"
				>
					<!-- 导航菜单 -->
					<a-menu
						v-model:selectedKeys="selectedKeys"
						mode="inline"
						:items="menuItems"
						class="layout-sider-menu border-none! bg-transparent!"
						@click="handleMenuClick"
					/>
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
</style>
