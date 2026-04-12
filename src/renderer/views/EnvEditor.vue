<template>
	<PageContainer :show-back="false">
		<template #extra>
			<a-button :icon="h(PlusOutlined)" @click="addRow">
				添加变量
			</a-button>
			<!-- 可视化视图工具栏 -->
			<template v-if="activeView == 'visual'">
				<a-button type="primary" :icon="h(SaveOutlined)" :disabled="!isDirty" :loading="saving"
					@click="saveVisual">
					保存
				</a-button>
			</template>
			<!-- 源码视图工具栏（仅 macOS/Linux） -->
			<template v-else>
				<a-select v-model:value="selectedShellFile" :options="shellFileOptions" style="width: 160px"
					@change="loadShellFile" />
				<a-button :icon="h(ReloadOutlined)" :loading="loadingShell" @click="loadShellFile" />
				<a-button type="primary" :icon="h(SaveOutlined)" :disabled="!shellDirty" :loading="savingShell"
					@click="saveShellFile">
					保存
				</a-button>
				<a-tag v-if="shellDirty" color="warning" style="margin:0">未保存</a-tag>
			</template>
		</template>

		<!-- ── 可视化视图 ── -->
		<div v-show="activeView === 'visual'" class="flex flex-col h-full overflow-hidden">
			<!-- Windows 提示 -->
			<a-alert v-if="isWindows" type="warning" show-icon banner class="shrink-0 mb-4!"
				message="修改系统环境变量需要管理员权限。setx 有 1024 字符限制，PATH 等长变量请谨慎操作。" />
			<!-- macOS/Linux 提示 -->
			<a-alert v-else type="info" show-icon banner class="shrink-0 mb-4!"
				:message="`正在编辑 ~/${selectedShellFile}。变量按条管理，保存后写入 OneConfig 托管块，不影响文件其他内容。修改在新开终端后生效。`" />

			<!-- Windows: 加载失败时显示授权按钮 -->
			<div v-if="isWindows && !winAuthed && winAuthFailed" class="flex-1 flex items-center justify-center">
				<div class="text-center">
					<a-button type="primary" size="large" :loading="loadingWinEnv" @click="authorizeWin">
						<template #icon>
							<SafetyOutlined />
						</template>
						授权并读取系统环境变量
					</a-button>
					<p class="text-gray-400 text-xs mt-4 m-0">授权后将弹出 UAC 窗口，请允许管理员权限</p>
				</div>
			</div>

			<!-- Windows: 已授权 / macOS/Linux: 始终显示 -->
			<template v-if="(!isWindows) || winAuthed">
				<!-- 变量表格 -->
				<div class="flex-1 overflow-y-auto">
					<a-spin :spinning="loadingWinEnv">
						<a-table :data-source="envRows" :columns="columns" :pagination="false" row-key="id"
							class="editable-table">
							<template #bodyCell="{ column, text, record }">
								<template v-if="column.dataIndex && editableColumns.includes(column.dataIndex as any)">
									<div class="editable-cell"
										@dblclick="startEdit(record.id, column.dataIndex as string)">
										<div v-if="isEditing(record.id, column.dataIndex as string)"
											class="editable-cell-input-wrapper">
											<a-input
												v-model:value="cellEditing[getCellKey(record.id, column.dataIndex as string)]"
												:placeholder="getPlaceholder(column.dataIndex as string)"
												:class="['text-sm', (column.dataIndex as string) === 'key' || (column.dataIndex as string) === 'value' ? 'font-mono' : '']"
												@pressEnter="saveCell(record.id, column.dataIndex as string)"
												@click.stop />
											<RiCheckLine size="16" class="editable-cell-icon-check"
												@click="saveCell(record.id, column.dataIndex as string)" />
											<RiProhibited2Line size="16" class="editable-cell-icon-close"
												@click="cancelEdit(record.id, column.dataIndex as string)" />
										</div>
										<div v-else class="editable-cell-text-wrapper">
											<span :class="getTextClass(column.dataIndex as string, text)">
												{{ text || ' ' }}
											</span>
											<RiEditLine size="16" class="editable-cell-icon"
												@click="startEdit(record.id, column.dataIndex as string)" />
										</div>
									</div>
								</template>
								<template v-else-if="column.dataIndex === 'action'">
									<a-popconfirm placement="left" v-if="envRows.length" title="确定删除？"
										@confirm="onDelete(record.id)">
										<RiDeleteBinLine size="16" class="text-red-500 cursor-pointer" />
									</a-popconfirm>
								</template>
							</template>
						</a-table>
					</a-spin>
				</div>
			</template>
		</div>

		<!-- ── 源码视图（仅 macOS/Linux） ── -->
		<div v-if="!isWindows" v-show="activeView === 'source'" class="flex-1 overflow-hidden">
			<div ref="shellMonacoContainer" class="w-full h-full" />
		</div>

		<!-- Windows 权限确认 -->
		<PermissionDialog v-model:open="showPermDialog" :command="pendingCommands.join('\n')"
			warning="此操作将修改系统级环境变量，需要管理员权限（UAC 弹窗）。" @confirm="doSaveWin" />
	</PageContainer>
</template>

<script setup lang="ts">
import { h, ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons-vue'
import { RiDeleteBinLine, RiCheckLine, RiProhibited2Line, RiEditLine } from "@remixicon/vue";
import { monaco } from '@/monaco'
import PermissionDialog from '@/components/PermissionDialog.vue'
import PageContainer from '@/components/PageContainer.vue'

const isWindows = window.electronAPI.platform === 'win32'

// ── 视图切换（仅 macOS/Linux） ──
const activeView = ref<'visual' | 'source'>('visual')

// ── 环境变量行数据 ──
interface EnvRow {
	id: string
	key: string
	value: string
	comment: string
}

let rowCounter = 0
function newRow(key = '', value = '', comment = ''): EnvRow {
	return { id: `row-${++rowCounter}`, key, value, comment }
}

const envRows = ref<EnvRow[]>([])
const saving = ref(false)

// 记录初始快照，用于判断是否有实际变更
const initialSnapshot = ref<EnvRow[]>([])

const isDirty = computed(() => {
	if (initialSnapshot.value.length !== envRows.value.length) return true
	for (let i = 0; i < envRows.value.length; i++) {
		const a = initialSnapshot.value[i], b = envRows.value[i]
		if (a.key !== b.key || a.value !== b.value || a.comment !== b.comment) return true
	}
	return false
})

function setSnapshot() {
	initialSnapshot.value = envRows.value.map(r => ({ ...r }))
}

const editableColumns = ['key', 'value', 'comment'] as const

// 正在编辑的单元格 key -> 临时值
const cellEditing = reactive<Record<string, string>>({})
// 正在编辑的单元格集合 key = "rowId:dataIndex"
const editingCells = ref<Set<string>>(new Set())

function getCellKey(id: string, dataIndex: string): string {
	return `${id}:${dataIndex}`
}

function isEditing(id: string, dataIndex: string): boolean {
	return editingCells.value.has(getCellKey(id, dataIndex))
}

function startEdit(id: string, dataIndex: string) {
	const key = getCellKey(id, dataIndex)
	editingCells.value.add(key)
	const row = envRows.value.find(r => r.id === id)
	cellEditing[key] = row ? (row as any)[dataIndex] ?? '' : ''
}

function saveCell(id: string, dataIndex: string) {
	const key = getCellKey(id, dataIndex)
	const target = envRows.value.find(r => r.id === id)
	if (target) {
		(target as any)[dataIndex] = cellEditing[key] ?? ''
	}
	editingCells.value.delete(key)
	delete cellEditing[key]
}

function cancelEdit(id: string, dataIndex: string) {
	const key = getCellKey(id, dataIndex)
	editingCells.value.delete(key)
	delete cellEditing[key]
}

function getPlaceholder(dataIndex: string): string {
	const map: Record<string, string> = { key: '变量名', value: '变量值', comment: '添加说明…' }
	return map[dataIndex] || ''
}

function getTextClass(dataIndex: string, text: string): string {
	if (dataIndex === 'key') return `font-mono text-sm ${text ? 'text-gray-800' : 'text-gray-300 italic'}`
	if (dataIndex === 'value') return `font-mono text-sm ${text ? 'text-gray-600' : 'text-gray-300 italic'}`
	return `text-sm ${text ? 'text-gray-400' : 'text-gray-300 italic'}`
}

// ── 删除变量（Windows 立即执行删除，macOS/Linux 仅从表格移除） ──
const onDelete = async (id: string) => {
	const row = envRows.value.find(r => r.id === id)
	if (isWindows && row && row.key.trim()) {
		try {
			await window.electronAPI.deleteSystemEnv(row.key.trim())
			envRows.value = envRows.value.filter(r => r.id !== id)
			message.success(`已删除 ${row.key}`)
		} catch (e: any) {
			message.error(`删除失败：${e?.message || e}`)
		}
	} else {
		envRows.value = envRows.value.filter(r => r.id !== id)
	}
}

// ── 表格列定义 ──
const columns = [
	{ title: '变量名', dataIndex: 'key', width: 200, ellipsis: true },
	{ title: '变量值', dataIndex: 'value', ellipsis: true },
	{ title: '注释 / 说明', dataIndex: 'comment', width: 220, ellipsis: true },
	{ title: '操作', dataIndex: 'action', width: 100, align: 'center' as const, fixed: 'right' as const }
]

function addRow() {
	const row = newRow()
	envRows.value.push(row)
	startEdit(row.id, 'key')
}

// ── macOS/Linux: 从 shell 文件加载托管块变量 ──
const selectedShellFile = ref('.zshrc')
const shellFileOptions = [
	{ label: '~/.zshrc', value: '.zshrc' },
	{ label: '~/.bashrc', value: '.bashrc' },
	{ label: '~/.bash_profile', value: '.bash_profile' },
	{ label: '~/.profile', value: '.profile' },
	{ label: '~/.zprofile', value: '.zprofile' }
]
const loadingShell = ref(false)

// ── Windows: 从注册表读取系统环境变量 ──
const loadingWinEnv = ref(false)
const winAuthed = ref(false)
const winAuthFailed = ref(false)

// Windows: 授权并读取系统环境变量
async function authorizeWin() {
	loadingWinEnv.value = true
	try {
		const envMap = await window.electronAPI.listSystemEnv()
		envRows.value = Object.entries(envMap).map(([key, value]) => newRow(key, value))
		if (envRows.value.length === 0) envRows.value = [newRow()]
		winAuthed.value = true
		winAuthFailed.value = false
		setSnapshot()
	} catch (e: any) {
		winAuthFailed.value = true
		message.error(`授权失败：${e?.message || e}`)
	} finally {
		loadingWinEnv.value = false
	}
}

function parseShellExports(content: string): EnvRow[] {
	const rows: EnvRow[] = []
	const lines = content.split('\n')
	let pendingComment = ''

	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.startsWith('#')) {
			pendingComment = trimmed.replace(/^#+\s*/, '')
			continue
		}
		const match = trimmed.match(/^export\s+([\w]+)=(.*)$/)
		if (match) {
			const key = match[1]
			let val = match[2].trim()
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1)
			}
			rows.push(newRow(key, val, pendingComment))
			pendingComment = ''
		} else {
			pendingComment = ''
		}
	}
	return rows
}

function serializeToExports(rows: EnvRow[]): string {
	return rows
		.filter(r => r.key.trim())
		.map(r => {
			const comment = r.comment.trim() ? `# ${r.comment.trim()}\n` : ''
			const val = r.value.includes(' ') ? `"${r.value}"` : r.value
			return `${comment}export ${r.key}=${val}`
		})
		.join('\n')
}

async function loadShellFile() {
	loadingShell.value = true
	try {
		const content = await window.electronAPI.readShellEnv(selectedShellFile.value)
		const blockMatch = content.match(/# >>> OneConfig managed block >>>([\s\S]*?)# <<< OneConfig managed block <<</s)
		const blockContent = blockMatch ? blockMatch[1].trim() : ''
		envRows.value = blockContent ? parseShellExports(blockContent) : []
		if (envRows.value.length === 0) envRows.value = [newRow()]
		setSnapshot()
		if (shellEditor) {
			shellEditor.setValue(content)
			shellDirty.value = false
		}
	} catch (e: any) {
		message.error(`读取失败：${e?.message || e}`)
	} finally {
		loadingShell.value = false
	}
}

// ── 保存（可视化视图） ──
async function saveVisual() {
	saving.value = true
	try {
		if (isWindows) {
			pendingCommands.value = envRows.value
				.filter(r => r.key.trim())
				.map(r => `setx "${r.key}" "${r.value}" /M`)
			if (pendingCommands.value.length === 0) { saving.value = false; return }
			showPermDialog.value = true
		} else {
			const block = serializeToExports(envRows.value)
			const res = await window.electronAPI.writeShellEnv(selectedShellFile.value, block)
			if (res.success) {
				setSnapshot()
				message.success('已保存，修改在新开终端后生效')
				await loadShellFile()
			}
		}
	} catch (e: any) {
		message.error(`保存失败：${e?.message || e}`)
	} finally {
		saving.value = false
	}
}

// ── Windows 权限保存 ──
const showPermDialog = ref(false)
const pendingCommands = ref<string[]>([])

async function doSaveWin() {
	try {
		for (const row of envRows.value.filter(r => r.key.trim())) {
			await window.electronAPI.setSystemEnv(row.key.trim(), row.value)
		}
		setSnapshot()
		message.success('系统环境变量已设置，新进程中生效')
	} catch (e: any) {
		message.error(`设置失败：${e?.message || e}`)
	}
}

// ── 源码视图（macOS/Linux） ──
const shellMonacoContainer = ref<HTMLElement>()
let shellEditor: monaco.editor.IStandaloneCodeEditor | null = null
const shellDirty = ref(false)
const savingShell = ref(false)

async function saveShellFile() {
	savingShell.value = true
	try {
		const content = shellEditor?.getValue() || ''
		const res = await window.electronAPI.writeShellEnv(selectedShellFile.value, content)
		if (res.success) {
			shellDirty.value = false
			message.success('保存成功')
			envRows.value = parseShellExports(content)
			setSnapshot()
		}
	} catch (e: any) {
		message.error(`保存失败：${e?.message || e}`)
	} finally {
		savingShell.value = false
	}
}

watch(activeView, async (v) => {
	if (v === 'source' && shellEditor) {
		requestAnimationFrame(() => shellEditor?.layout())
	}
})

onMounted(async () => {
	if (!isWindows && shellMonacoContainer.value) {
		shellEditor = monaco.editor.create(shellMonacoContainer.value, {
			value: '',
			language: 'shell',
			theme: 'vs',
			fontSize: 13,
			fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
			minimap: { enabled: false },
			lineNumbers: 'on',
			scrollBeyondLastLine: false,
			automaticLayout: true,
			tabSize: 2,
			scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
		})
		shellEditor.onDidChangeModelContent(() => {
			shellDirty.value = true
		})
	}

	if (!isWindows) {
		await loadShellFile()
	} else {
		// Windows: 先尝试直接读取，失败时再显示授权按钮
		try {
			const envMap = await window.electronAPI.listSystemEnv()
			envRows.value = Object.entries(envMap).map(([key, value]) => newRow(key, value))
			if (envRows.value.length === 0) envRows.value = [newRow()]
			winAuthed.value = true
			setSnapshot()
		} catch {
			winAuthFailed.value = true
		}
	}
})

onUnmounted(() => {
	shellEditor?.dispose()
})
</script>

<style scoped>
.editable-table :deep(.ant-table-tbody .ant-table-cell) {
	padding: 0 !important;
	overflow: hidden;
}

.editable-cell {
	position: relative;
	width: 100%;
	display: flex;
	align-items: center;
	padding: 12px 16px;
	cursor: default;
	overflow: hidden;
}

.editable-cell-input-wrapper {
	display: flex;
	align-items: center;
	gap: 4px;
	width: 100%;
	padding-right: 28px;
}

.editable-cell-text-wrapper {
	display: flex;
	align-items: center;
	width: 100%;
	min-height: 30px;
	position: relative;
	padding-right: 24px;
	min-width: 0;
}

.editable-cell-text-wrapper>span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	flex-shrink: 1;
	min-width: 0;
}

.editable-cell-icon,
.editable-cell-icon-check,
.editable-cell-icon-close {
	flex-shrink: 0;
	width: 16px;
	height: 16px;
	cursor: pointer;
	color: #999;
}

.editable-cell-icon {
	position: absolute;
	right: 0;
	top: 50%;
	transform: translateY(-50%);
	display: none;
}

.editable-cell-icon-check {
	margin-left: 4px;
}

.editable-cell-icon-close {
	position: absolute;
	right: 22px;
	top: 50%;
	transform: translateY(-50%);
}

.editable-cell-icon:hover,
.editable-cell-icon-check:hover,
.editable-cell-icon-close:hover {
	color: #1677ff;
}

.editable-cell:hover .editable-cell-icon {
	display: inline-block;
}
</style>
