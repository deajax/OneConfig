import { h, type VNode } from 'vue'
import {
  SwapOutlined,
  DatabaseOutlined,
  CodeOutlined,
  CodeSandboxOutlined
} from '@ant-design/icons-vue'
import { RiClaudeFill } from "@remixicon/vue";

export interface MenuItem {
  key: string
  icon: () => VNode
  label: string
  title?: string  // page header title (defaults to label)
}

export const menuItems: MenuItem[] = [
  {
    key: '/claude-code',
    icon: () => h(RiClaudeFill, { size: '1rem'}),
    label: 'Claude Code',
    title: 'Claude Code'
  },
  {
    key: '/env',
    icon: () => h(DatabaseOutlined),
    label: '环境变量',
    title: '环境变量'
  },
  {
    key: '/config',
    icon: () => h(CodeOutlined),
    label: '其他配置',
    title: '其他配置'
  },
  {
    key: '/terminal',
    icon: () => h(CodeSandboxOutlined),
    label: '终端',
    title: '终端'
  }
]

export function findMenuByKey(key: string): MenuItem | undefined {
  return menuItems.find(item => item.key === key)
}
