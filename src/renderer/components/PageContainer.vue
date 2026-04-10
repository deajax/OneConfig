<template>
	<div class="flex flex-col h-full overflow-hidden">
		<a-page-header
			:title="resolvedTitle"
			:sub-title="subTitle"
			v-bind="showBack ? { 'back-icon': h(ArrowLeftOutlined), onBack: handleBack } : {}"
			class="px-4! py-3!"
		>
			<template #avatar>
				<a-avatar class="bg-blue-50! text-blue-600!" v-if="resolvedAvatar">
					<template #icon><component :is="resolvedAvatar" /></template>
				</a-avatar>
			</template>
			<template #extra>
				<slot name="extra" />
			</template>
			<template #tags>
				<slot name="tags" />
			</template>
			<template #footer v-if="$slots.footer">
				<slot name="footer" />
			</template>
		</a-page-header>
		<div class="flex-1 overflow-hidden min-h-0">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { h, computed, type VNode } from "vue";
	import { useRouter, useRoute } from "vue-router";
	import { ArrowLeftOutlined } from "@ant-design/icons-vue";
	import { findMenuByKey } from "@/config/menu";

	const router = useRouter();
	const route = useRoute();

	interface Props {
		title?: string;
		subTitle?: string;
		showBack?: boolean;
		onBack?: () => void;
		avatar?: VNode;
	}

	const props = withDefaults(defineProps<Props>(), {
		title: "",
		subTitle: "",
		showBack: false,
		onBack: undefined,
		avatar: undefined,
	});

	const resolvedTitle = computed(
		() => props.title || findMenuByKey(route.path)?.title || ""
	);
	const resolvedAvatar = computed(
		() => props.avatar || findMenuByKey(route.path)?.icon?.()
	);

	function handleBack() {
		if (props.onBack) {
			props.onBack();
		} else {
			router.go(-1);
		}
	}
</script>

<style lang="less" scoped>
:deep(.ant-avatar) {
	&.ant-avatar-icon {
		font-size: 1rem;
	}
}
</style>