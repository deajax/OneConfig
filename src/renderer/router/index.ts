import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/config'
    },
    {
      path: '/config',
      name: 'config-list',
      component: () => import('@/views/ConfigList.vue'),
      meta: { title: '配置编辑' }
    },
    {
      path: '/config/edit',
      name: 'config-edit',
      component: () => import('@/views/ConfigEditor.vue'),
      meta: { title: '编辑配置' }
    },
    {
      path: '/config/claude-code',
      name: 'claude-code',
      component: () => import('@/views/ClaudeCode.vue'),
      meta: { title: 'Claude Code' }
    },
    {
      path: '/config/openclaw',
      name: 'openclaw',
      component: () => import('@/views/OpenClaw.vue'),
      meta: { title: 'OpenClaw' }
    },
    {
      path: '/env',
      name: 'env',
      component: () => import('@/views/EnvEditor.vue'),
      meta: { title: '环境变量' }
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
