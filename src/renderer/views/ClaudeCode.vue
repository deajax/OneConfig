<template>
	<PageContainer>
		<template #extra>
			<a-button v-if="!providerStore.applied" :icon="h(CheckCircleOutlined)" type="primary" class="mr-1"
				@click="applyChanges">
				应用更改
			</a-button>
			<a-button :icon="h(PlusOutlined)" @click="handleAdd"> 添加模型商 </a-button>
		</template>

		<!-- 内容区 -->
		<div class="provider-list">
			<!-- 空态 -->
			<div v-if="providerStore.loading" class="flex items-center justify-center h-full pb-16">
				<a-spin tip="正在加载 Provider..." />
			</div>

			<div v-else-if="providerStore.profiles.length == 0" class="pt-40">
				<a-empty description="暂无模型商配置">
					<a-button type="primary" :icon="h(PlusOutlined)" @click="handleAdd">
						添加模型商
					</a-button>
				</a-empty>
			</div>

			<!-- Provider 列表 -->
			<a-row v-else :gutter="[16, 16]">
				<a-col v-for="profile in providerStore.profiles" :key="profile.id" span="8">
					<a-card hoverable>
						<a-card-meta :description="profile.envVars['ANTHROPIC_BASE_URL'] || '空'" @click="handleEdit(profile)">
							<template #avatar>
								<img v-if="profile.icon && isImageIcon(profile.icon)" :src="getIconSrc(profile.icon)"
									class="w-6 h-6 object-contain" />
								<span v-else>{{ profile.icon }}</span>
							</template>
							<template #title>
								<div class="flex items-center">
									<div class="flex-1 min-w-0 truncate">
										{{ profile.name }}
									</div>
									<div class="inline-flex" @click.stop>
										<a-switch :checked="profile.isActive" @change="handleActivate(profile.id)" />
									</div>
								</div>
							</template>
						</a-card-meta>
						<template #actions>
							<div class="" @click.stop>
								<a-select v-if="profile.models && profile.models.length > 0"
									:value="profile.envVars['ANTHROPIC_MODEL'] || undefined" placeholder="选择模型…"
									class="w-full" show-search :filter-option="filterModelOption"
									option-filter-prop="label"
									@change="(val: any) => handleModelChange(profile.id, val)">
									<a-select-option v-for="m in profile.models" :key="m" :value="m" :label="m">
										<RiBrain4Line size="14px" color="gray" class="mr-1" />
										{{ m }}
									</a-select-option>
									<template #suffixIcon>
										<SwapOutlined />
									</template>
								</a-select>
								<a-input v-else :value="profile.envVars['ANTHROPIC_MODEL'] || ''" class="font-mono"
									placeholder="输入模型名称…"
									@change="(e: Event) => handleModelChange(profile.id, (e.target as HTMLInputElement).value)" />
							</div>
						</template>
					</a-card>
				</a-col>
			</a-row>
		</div>
	</PageContainer>

	<!-- 编辑/新建 Modal -->
	<a-modal v-model:open="modalVisible" :title="editingProfile ? '编辑 Provider' : '添加 Provider'" :width="600">
		<template #footer>
			<a-popconfirm title="确定删除此 Provider？" ok-text="删除" :ok-button-props="{ danger: true }"
				@confirm="handleDelete(editingProfile!.id)">
				<a-button :icon="h(DeleteOutlined)" class="float-left" danger>
					删除
				</a-button>
			</a-popconfirm>
			<a-button key="back" @click="modalVisible = false">取消</a-button>
			<a-button key="submit" type="primary" :loading="!modalForm.name.trim()" @click="handleModalOk">
				{{ editingProfile ? "保存" : "创建" }}
			</a-button>
		</template>

		<div class="flex flex-col gap-4 py-4">
			<!-- 名称和图标 -->
			<div class="flex items-start gap-2">
				<a-form-item class="flex-1">
					<a-input v-model:value="modalForm.name" placeholder="Provider 名称" />
					<template #help>
						<!-- 教程链接（编辑预置 Provider 时显示） -->
						<a v-if="editingProfile?.helpUrl" :href="editingProfile.helpUrl" target="_blank"
							rel="noopener noreferrer" class="text-xs">
							{{ editingProfile.helpTip || "获取 API Key" }}
						</a>
					</template>
				</a-form-item>
				<div class="flex items-center gap-1">
					<img v-if="modalForm.icon && isImageIcon(modalForm.icon)" :src="getIconSrc(modalForm.icon)"
						class="w-8 h-8 border border-dashed border-neutral-300 hover:border-blue-500 rounded object-contain cursor-pointer p-1 transition-colors"
						@click="triggerIconUpload" />
					<a-button v-else @click="triggerIconUpload">上传图片</a-button>
					<input ref="iconInputRef" type="file" class="hidden" accept=".jpg,.jpeg,.png,.svg,.gif,.webp,.ico"
						@change="handleIconUpload" />
				</div>
			</div>

			<!-- 预设模型列表 -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<span class="font-semibold">预设模型</span>
					<a-button type="dashed" :icon="h(PlusOutlined)" @click="addModel">
						添加模型
					</a-button>
				</div>
				<div class="flex flex-col gap-2">
					<div v-for="(m, idx) in modalModels" :key="idx" class="flex items-center gap-1">
						<a-input v-model:value="modalModels[idx]" placeholder="模型名称" class="flex-1" />
						<a-button type="dashed" :icon="h(DeleteOutlined)" @click="removeModel(idx)" />
					</div>
				</div>
			</div>

			<!-- 环境变量 -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<span class="font-semibold">环境变量</span>
					<a-button type="dashed" :icon="h(PlusOutlined)" @click="addEnvVar">
						添加变量
					</a-button>
				</div>
				<div class="flex flex-col gap-2">
					<div v-for="(pair, idx) in modalEnvPairs" :key="idx" class="flex items-center gap-1">
						<a-input v-model:value="pair.key" placeholder="变量名" class="flex-1" />
						<a-input v-model:value="pair.value" :placeholder="pair.optional ? '可选' : '值'"
							class="flex-[2]" />
						<a-button type="dashed" :icon="h(DeleteOutlined)" @click="removeEnvVar(idx)" />
					</div>
				</div>
			</div>
		</div>
	</a-modal>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { message } from "ant-design-vue";
import {
	CheckCircleOutlined,
	PlusOutlined,
	DeleteOutlined,
	QuestionCircleOutlined,
	SwapOutlined,
} from "@ant-design/icons-vue";
import { RiBrain4Line } from "@remixicon/vue";
import { useProviderStore } from "@/stores/providerStore";
import { findMenuByKey } from "@/config/menu";
import PageContainer from "@/components/PageContainer.vue";

const providerStore = useProviderStore();
const REQUIRED_ENV_KEYS = [
	"ANTHROPIC_BASE_URL",
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_MODEL",
];

// ---- 模型搜索过滤 ----
function filterModelOption(input: string, option: any) {
	return option.label?.toLowerCase().includes(input.toLowerCase()) ?? false;
}

// ---- 待应用模型更改 ----
async function handleModelChange(id: string, model: string) {
	const profile = providerStore.profiles.find((p) => p.id === id);
	if (!profile) return;
	// 所有 profile 都立即持久化到文件，已激活的标记为未应用到 shell
	await providerStore.setModel(id, model);
}

async function applyChanges() {
	await providerStore.applyProfile();
	message.success("已应用");
}

// ---- 图标处理 ----
const iconInputRef = ref<HTMLInputElement | null>(null);
const iconDataMap = ref<Map<string, string>>(new Map());

function isImageIcon(icon: string): boolean {
	return icon.startsWith("data:") || /\.(jpe?g|png|svg|gif|webp|ico)$/i.test(icon);
}

function getIconSrc(icon: string): string {
	if (!icon) return "";
	if (!isImageIcon(icon)) return "";
	// 如果是 data URL 直接返回
	if (icon.startsWith("data:")) return icon;
	// 如果已缓存返回
	const cached = iconDataMap.value.get(icon);
	if (cached) return cached;
	// 首次返回 Vite 处理的相对路径（内置图标在 dev 时生效）
	const fallback = new URL(`../assets/${icon}`, import.meta.url).href;
	// 异步通过 IPC 获取 base64 data URL（生产环境 / 上传的图标）
	window.electronAPI.getProviderIconData(icon).then((dataUrl) => {
		if (dataUrl) {
			const newMap = new Map(iconDataMap.value);
			newMap.set(icon, dataUrl);
			iconDataMap.value = newMap;
		}
	});
	return fallback;
}

function triggerIconUpload() {
	iconInputRef.value?.click();
}

async function handleIconUpload(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = () => {
		const dataUrl = reader.result as string;
		modalForm.icon = dataUrl;
	};
	reader.readAsDataURL(file);
	input.value = "";
}

const menuTitle = computed(
	() => findMenuByKey("/config/claude-code")?.title || "Claude Code"
);
const menuIcon = computed(() => findMenuByKey("/config/claude-code")?.icon());
let unsubscribeProviders: (() => void) | null = null

onMounted(() => {
	providerStore.loadProfiles();
	unsubscribeProviders = window.electronAPI.onProvidersChanged(() => {
		providerStore.reload();
	});
});

onUnmounted(() => {
	unsubscribeProviders?.();
});

// ---- 激活 / 应用 ----
async function handleActivate(id: string) {
	const profile = providerStore.profiles.find((p) => p.id === id);
	if (!profile) return;

	if (!profile.envVars["ANTHROPIC_BASE_URL"]) {
		message.warning("接口地址不完整，请填写BASE_URL字段");
		return;
	}
	if (!profile.envVars["ANTHROPIC_API_KEY"]) {
		message.warning("API密钥不完整，请填写API_KEY字段");
		return;
	}
	if (!profile.envVars["ANTHROPIC_MODEL"]) {
		message.warning("未填写默认模型，请填写MODEL字段");
		return;
	}

	await providerStore.activateProfile(id);
	message.success("已激活");
}

// ---- 删除 ----
async function handleDelete(id: string) {
	await providerStore.deleteProfile(id);
	message.success("已删除");
}

// ---- 编辑/新建 Modal ----
const modalVisible = ref(false);
const editingProfile = ref<ProviderProfile | null>(null);
const modalForm = reactive({ name: "", icon: "" });
const modalEnvPairs = ref<{ key: string; value: string; optional: boolean }[]>([]);
const modalModels = ref<string[]>([]);

function handleAdd() {
	editingProfile.value = null;
	modalForm.name = "";
	modalForm.icon = "";
	modalEnvPairs.value = REQUIRED_ENV_KEYS.map((k) => ({
		key: k,
		value: "",
		optional: false,
	}));
	modalModels.value = [];
	modalVisible.value = true;
}

function handleEdit(profile: ProviderProfile) {
	editingProfile.value = profile;
	modalForm.name = profile.name;
	modalForm.icon = profile.icon;
	modalEnvPairs.value = Object.entries(profile.envVars).map(([k, v]) => ({
		key: k,
		value: v,
		optional: !REQUIRED_ENV_KEYS.includes(k),
	}));
	modalModels.value = [...(profile.models || [])];
	modalVisible.value = true;
}

function addEnvVar() {
	modalEnvPairs.value.push({ key: "", value: "", optional: true });
}

function removeEnvVar(idx: number) {
	modalEnvPairs.value.splice(idx, 1);
}

function addModel() {
	modalModels.value.push("");
}

function removeModel(idx: number) {
	modalModels.value.splice(idx, 1);
}

async function handleModalOk() {
	const name = modalForm.name.trim();
	if (!name) return;

	const envVars: Record<string, string> = {};
	for (const pair of modalEnvPairs.value) {
		if (pair.key.trim()) {
			envVars[pair.key.trim()] = pair.value;
		}
	}

	const models = modalModels.value.filter((m) => m.trim() !== "");

	if (editingProfile.value) {
		await providerStore.updateProfile(editingProfile.value.id, {
			name,
			icon: modalForm.icon,
			envVars,
			models,
		});
		message.success("已更新");
	} else {
		await providerStore.createProfile(name, modalForm.icon, envVars, models);
		message.success("已创建");
	}

	modalVisible.value = false;
	editingProfile.value = null;
}
</script>

<style lang="less" scoped>
.provider-list {
	:deep(.ant-card-meta-avatar) {}

	:deep(.ant-card-meta-title) {
		margin-bottom: 4px;
	}

	:deep(.ant-card-meta-description) {
		width: 80%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
	}

	:deep(.ant-card-actions) {
		li {
			display: block;
			margin: 0;
			text-align: initial;
			color: initial;
		}

		.ant-select-selector {
			border-radius: 0;
			border: none;
			background-color: transparent;
			height: 48px;
			padding: 0 24px;
			box-shadow: none !important;
			cursor: pointer;

			.ant-select-selection-item,
			.ant-select-selection-placeholder {
				line-height: 48px;
			}
		}

		.ant-select-selection-search {
			inset-inline-start: 24px;
		}

		.ant-select-selection-search-input {
			height: 100%;
		}
	}
}
</style>
