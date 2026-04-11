import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/claude-code'
    },
    {
      path: '/claude-code',
      name: 'claude-code',
      component: () => import('@/views/ClaudeCode.vue'),
      meta: { title: 'Claude Code' }
    },
    {
      path: '/env',
      name: 'env',
      component: () => import('@/views/EnvEditor.vue'),
      meta: { title: '环境变量' }
    },
    {
      path: '/config',
      name: 'config-list',
      component: () => import('@/views/ConfigList.vue'),
      meta: { title: '其他配置' }
    },
    {
      path: '/config/edit',
      name: 'config-edit',
      component: () => import('@/views/ConfigEditor.vue'),
      meta: { title: '配置编辑' }
    },
    {
      path: '/terminal',
      name: 'terminal',
      component: () => import('@/views/TerminalView.vue'),
      meta: { title: '终端' }
    }
  ]
})

export default router
