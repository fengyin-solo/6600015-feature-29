import { create } from 'zustand'
import type { Task, ClusterNode, MetricsSnapshot, TaskStatus } from '../types'

// Mock data generators
function mockNodes(): ClusterNode[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `node-${i + 1}`,
    name: i === 0 ? 'scheduler-main' : `worker-${i}`,
    type: i === 0 ? 'scheduler' as const : 'worker' as const,
    status: Math.random() > 0.1 ? 'online' as const : 'overloaded' as const,
    cpu: 20 + Math.random() * 60,
    memory: 30 + Math.random() * 50,
    tasks: Math.floor(Math.random() * 8),
    uptime: 3600 + Math.floor(Math.random() * 86400),
  }))
}

function mockTasks(nodes: ClusterNode[]): Task[] {
  const names = ['data_sync', 'email_batch', 'report_gen', 'cache_warm', 'log_rotate', 'db_backup', 'index_rebuild', 'health_check']
  return Array.from({ length: 12 }, (_, i) => {
    const status: TaskStatus[] = ['pending', 'running', 'success', 'failed']
    const s = status[Math.floor(Math.random() * 4)]
    const node = nodes[Math.floor(Math.random() * nodes.length)]
    return {
      id: `task-${1000 + i}`,
      name: names[i % names.length],
      status: s,
      node: node.name,
      createdAt: Date.now() - Math.floor(Math.random() * 600000),
      startedAt: s !== 'pending' ? Date.now() - Math.floor(Math.random() * 300000) : undefined,
      completedAt: (s === 'success' || s === 'failed') ? Date.now() - Math.floor(Math.random() * 60000) : undefined,
      retries: s === 'failed' ? Math.floor(Math.random() * 3) : 0,
      maxRetries: 3,
      duration: s === 'success' ? 1000 + Math.floor(Math.random() * 30000) : undefined,
      logs: [`[INFO] Task ${names[i % names.length]} started`, `[INFO] Processing on ${node.name}`],
    }
  })
}

const TASK_TYPES = ['data_sync', 'email_batch', 'report_gen', 'cache_warm', 'log_rotate', 'db_backup', 'index_rebuild', 'health_check']

const TASK_TYPE_SUCCESS_RATES: Record<string, { min: number; max: number }> = {
  health_check: { min: 95, max: 100 },
  data_sync: { min: 85, max: 95 },
  email_batch: { min: 75, max: 90 },
  report_gen: { min: 70, max: 85 },
  cache_warm: { min: 65, max: 80 },
  log_rotate: { min: 60, max: 75 },
  db_backup: { min: 50, max: 70 },
  index_rebuild: { min: 55, max: 75 },
}

function generateSuccessRateByType(): Record<string, number> {
  const result: Record<string, number> = {}
  for (const type of TASK_TYPES) {
    const range = TASK_TYPE_SUCCESS_RATES[type]
    result[type] = range.min + Math.random() * (range.max - range.min)
  }
  return result
}

const initialNodes = mockNodes()

function flattenMetrics(base: Omit<MetricsSnapshot, 'successRateByType'> & { successRateByType: Record<string, number> }) {
  return { ...base, ...base.successRateByType }
}

interface TaskStore {
  tasks: Task[]
  nodes: ClusterNode[]
  metrics: MetricsSnapshot[]
  flatMetrics: any[]
  selectedTask: Task | null
  addTask: (name: string) => void
  retryTask: (id: string) => void
  cancelTask: (id: string) => void
  selectTask: (t: Task | null) => void
  refreshNodes: () => void
  addMetric: () => void
}

export const useTaskStore = create<TaskStore>((set, get) => {
  const initialMetrics: MetricsSnapshot[] = Array.from({ length: 20 }, (_, i) => ({
    time: Date.now() - (20 - i) * 5000,
    totalTasks: 100 + i * 2,
    runningTasks: 3 + Math.floor(Math.random() * 5),
    successRate: 85 + Math.random() * 14,
    avgLatency: 500 + Math.random() * 2000,
    nodeCount: 5,
    successRateByType: generateSuccessRateByType(),
  }))

  return {
  tasks: mockTasks(initialNodes),
  nodes: initialNodes,
  metrics: initialMetrics,
  flatMetrics: initialMetrics.map(flattenMetrics),
  selectedTask: null,
  addTask: (name) => {
    const task: Task = {
      id: `task-${Date.now()}`,
      name, status: 'pending',
      node: get().nodes[Math.floor(Math.random() * get().nodes.length)].name,
      createdAt: Date.now(), retries: 0, maxRetries: 3, logs: [`[INFO] Task ${name} queued`],
    }
    set({ tasks: [task, ...get().tasks] })
  },
  retryTask: (id) => set({
    tasks: get().tasks.map(t => t.id === id ? { ...t, status: 'pending', retries: t.retries + 1, logs: [...t.logs, '[INFO] Retrying...'] } : t)
  }),
  cancelTask: (id) => set({
    tasks: get().tasks.map(t => t.id === id ? { ...t, status: 'failed' as TaskStatus, logs: [...t.logs, '[WARN] Cancelled by user'] } : t)
  }),
  selectTask: (t) => set({ selectedTask: t }),
  refreshNodes: () => set({ nodes: mockNodes() }),
  addMetric: () => {
    const tasks = get().tasks
    const successRateByType: Record<string, number> = {}
    for (const type of TASK_TYPES) {
      const typeTasks = tasks.filter(t => t.name === type)
      if (typeTasks.length > 0) {
        const successCount = typeTasks.filter(t => t.status === 'success').length
        successRateByType[type] = (successCount / typeTasks.length) * 100
      } else {
        const range = TASK_TYPE_SUCCESS_RATES[type]
        successRateByType[type] = range.min + Math.random() * (range.max - range.min)
      }
    }
    const m: MetricsSnapshot = {
      time: Date.now(),
      totalTasks: tasks.length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      successRate: (tasks.filter(t => t.status === 'success').length / Math.max(tasks.length, 1)) * 100,
      avgLatency: 500 + Math.random() * 2000,
      nodeCount: get().nodes.filter(n => n.status !== 'offline').length,
      successRateByType,
    }
    const newMetrics = [...get().metrics.slice(-30), m]
    set({ metrics: newMetrics, flatMetrics: newMetrics.map(flattenMetrics) })
  },
}})
