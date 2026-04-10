<template>
	<PageContainer>
		<template #extra>
			<div class="flex items-center gap-2">
				<a-button
					v-if="providerStore.activeProfile && !providerStore.applied"
					type="primary"
					size="small"
					:loading="applying"
					:icon="h(CheckOutlined)"
					@click="handleApply"
				>
					{{ applyButtonText }}
				</a-button>
				<a-button :icon="h(PlusOutlined)" @click="handleAdd">
					添加模型商
				</a-button>
			</div>
		</template>

		<!-- 内容区 -->
		<div class="h-full overflow-y-auto px-6 pb-6">
			<!-- 空态 -->
			<div
				v-if="providerStore.loading"
				class="flex items-center justify-center h-full pb-16"
			>
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
				<a-col
					v-for="profile in providerStore.profiles"
					:key="profile.id"
					span="8"
				>
					<a-card :class="profile.isActive ? 'border-blue-400' : ''">
						<template #title>
							{{ profile.icon }}
							<span class="ml-2">{{ profile.name }}</span>
						</template>
						<template #extra>
							<a-tag v-if="profile.isActive" color="blue" class="!m-0"
								>已激活</a-tag
							>
							<a-button
								:icon="h(SwapOutlined)"
								v-else
								@click="handleActivate(profile.id)"
							>
								激活
							</a-button>
						</template>

						<!-- 信息 -->
						<div class="flex-1 min-w-0">
							<!-- 模型选择器 -->
							<div class="flex items-center gap-2 mb-2">
								<span class="text-xs text-gray-400 shrink-0">模型</span>
								<template
									v-if="profile.models && profile.models.length > 0"
								>
									<a-select
										:value="profile.envVars['ANTHROPIC_MODEL'] || ''"
										size="small"
										class="w-[260px]"
										show-search
										:filter-option="true"
										:class="{ 'opacity-60': !profile.isActive }"
										@change="(v: string) => handleModelChange(profile.id, v)"
									>
										<a-select-option
											v-for="m in profile.models"
											:key="m"
											:value="m"
										>
											{{ m }}
										</a-select-option>
									</a-select>
								</template>
								<template v-else>
									<a-input
										:value="profile.envVars['ANTHROPIC_MODEL'] || ''"
										size="small"
										class="w-[260px] font-mono"
										placeholder="输入模型名称…"
										@change="(e: Event) => handleModelChange(profile.id, (e.target as HTMLInputElement).value)"
									/>
								</template>
								<span
									v-if="profile.isActive && !providerStore.applied"
									class="text-[10px] text-orange-400"
									>需应用</span
								>
							</div>

							<div class="flex flex-col gap-0.5">
								<div
									v-for="[key, value] in visibleEnvVars(
										profile.envVars
									)"
									:key="key"
									class="text-xs font-mono flex items-center gap-2"
								>
									<span
										class="text-gray-400 shrink-0 w-[200px] truncate"
										:title="key"
										>{{ key }}</span
									>
									<span
										class="text-gray-600 truncate"
										:title="value || '(空)'"
										:class="{ 'text-red-300': !value }"
									>
										{{ value || "(空)" }}
									</span>
								</div>
							</div>
						</div>

						<!-- 操作按钮 -->
						<template #actions>
							<span
								v-if="profile.isActive"
								@click="handleApply"
								:loading="applying"
								:disabled="providerStore.applied"
							>
								<CheckCircleOutlined
									@click="handleActivate(profile.id)"
								/>
								应用
							</span>
							<span @click="handleEdit(profile)">
								<EditOutlined />
								编辑
							</span>
							<a-popconfirm
								title="确定删除此 Provider？"
								ok-text="删除"
								:ok-button-props="{ danger: true }"
								@confirm="handleDelete(profile.id)"
							>
								<span>
									<DeleteOutlined />
									删除
								</span>
							</a-popconfirm>
						</template>
					</a-card>
				</a-col>
			</a-row>
		</div>
	</PageContainer>

	<!-- 编辑/新建 Modal -->
	<a-modal
		v-model:open="modalVisible"
		:title="editingProfile ? '编辑 Provider' : '添加 Provider'"
		:width="600"
		:ok-text="editingProfile ? '保存' : '创建'"
		:ok-button-props="{ disabled: !modalForm.name.trim() }"
		@ok="handleModalOk"
	>
		<div class="flex flex-col gap-4">
			<!-- 名称和图标 -->
			<div class="flex gap-3">
				<a-input
					v-model:value="modalForm.name"
					placeholder="Provider 名称"
					class="flex-1"
				/>
				<a-input
					v-model:value="modalForm.icon"
					placeholder="图标"
					class="w-[80px] text-center"
					maxlength="2"
				/>
			</div>

			<!-- 教程链接（编辑预置 Provider 时显示） -->
			<a
				v-if="editingProfile?.helpUrl"
				:href="editingProfile.helpUrl"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
			>
				<QuestionCircleOutlined class="text-[12px]" />
				{{ editingProfile.helpTip || "获取 API Key" }}
			</a>

			<!-- 预设模型列表 -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-gray-700">预设模型</span>
					<a-button
						type="dashed"
						size="small"
						:icon="h(PlusOutlined)"
						@click="addModel"
					>
						添加模型
					</a-button>
				</div>
				<div class="flex flex-col gap-1.5">
					<div
						v-for="(m, idx) in modalModels"
						:key="idx"
						class="flex items-center gap-2"
					>
						<a-input
							v-model:value="modalModels[idx]"
							placeholder="模型名称"
							size="small"
							class="flex-1 font-mono"
						/>
						<a-button
							type="text"
							size="small"
							:icon="h(DeleteOutlined)"
							class="text-gray-300 hover:text-red-500 shrink-0"
							@click="removeModel(idx)"
						/>
					</div>
				</div>
			</div>

			<!-- 环境变量 -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-gray-700">环境变量</span>
					<a-button
						type="dashed"
						size="small"
						:icon="h(PlusOutlined)"
						@click="addEnvVar"
					>
						添加变量
					</a-button>
				</div>
				<div class="flex flex-col gap-2">
					<div
						v-for="(pair, idx) in modalEnvPairs"
						:key="idx"
						class="flex items-center gap-2"
					>
						<a-input
							v-model:value="pair.key"
							placeholder="变量名"
							class="flex-1 font-mono"
							size="small"
						/>
						<a-input
							v-model:value="pair.value"
							:placeholder="pair.optional ? '可选' : '值'"
							class="flex-[2] font-mono"
							size="small"
						/>
						<span
							v-if="pair.optional"
							class="text-[10px] text-gray-300 shrink-0 w-[36px]"
							>可选</span
						>
						<a-button
							v-else
							type="text"
							size="small"
							:icon="h(DeleteOutlined)"
							class="text-gray-300 hover:text-red-500 shrink-0"
							@click="removeEnvVar(idx)"
						/>
					</div>
				</div>
			</div>
		</div>
	</a-modal>
</template>

<script setup lang="ts">
	import { h, ref, reactive, computed } from "vue";
	import { message } from "ant-design-vue";
	import {
		PlusOutlined,
		SwapOutlined,
		EditOutlined,
		DeleteOutlined,
		CheckOutlined,
		CheckCircleOutlined,
		QuestionCircleOutlined,
	} from "@ant-design/icons-vue";
	import { useProviderStore } from "@/stores/providerStore";
	import { findMenuByKey } from "@/config/menu";
	import PageContainer from "@/components/PageContainer.vue";

	const providerStore = useProviderStore();
	const applying = ref(false);
	const REQUIRED_ENV_KEYS = [
		"ANTHROPIC_BASE_URL",
		"ANTHROPIC_API_KEY",
		"ANTHROPIC_MODEL",
	];

	const menuTitle = computed(
		() => findMenuByKey("/config/claude-code")?.title || "Claude Code"
	);
	const menuIcon = computed(() => findMenuByKey("/config/claude-code")?.icon());
	const applyButtonText = computed(() => {
		return window.electronAPI.platform === 'win32'
			? '应用到系统环境变量'
			: '应用到 .zshrc'
	})

	onMounted(() => {
		providerStore.loadProfiles();
	});

	function visibleEnvVars(envVars: Record<string, string>): [string, string][] {
		return Object.entries(envVars).filter(
			([k, v]) => v.trim() !== "" || k === "ANTHROPIC_API_KEY"
		);
	}

	// ---- 激活 / 应用 ----
	async function handleActivate(id: string) {
		await providerStore.activateProfile(id);
		message.success("已激活");
	}

	async function handleModelChange(id: string, model: string) {
		await providerStore.setModel(id, model);
	}

	async function handleApply() {
		applying.value = true;
		try {
			const res = await providerStore.applyProfile();
			if (res.success) {
				message.success(res.message || "已应用，请重启终端以生效");
			} else {
				message.error(res.message || "应用失败");
			}
		} catch (e: any) {
			message.error(e.message || "应用失败");
		} finally {
			applying.value = false;
		}
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
		modalForm.icon = "🔵";
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
