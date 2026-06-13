import { useState } from 'react'
import { Layout, Tabs, Statistic, Row, Col, Card, Tag, Button, Input, Table, Drawer, Descriptions, Space, Progress } from 'antd'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts'
import { useTaskStore } from '../store/tasks'
import type { Task, TaskStatus } from '../types'

const { Header, Content } = Layout

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'default', running: 'processing', success: 'success', failed: 'error', retry: 'warning'
}

const TASK_TYPE_COLORS: Record<string, string> = {
  health_check: '#52c41a',
  data_sync: '#1890ff',
  email_batch: '#13c2c2',
  report_gen: '#722ed1',
  cache_warm: '#fa8c16',
  log_rotate: '#eb2f96',
  db_backup: '#f5222d',
  index_rebuild: '#faad14',
}

const TASK_TYPE_LABELS: Record<string, string> = {
  health_check: '健康检查',
  data_sync: '数据同步',
  email_batch: '邮件批量',
  report_gen: '报表生成',
  cache_warm: '缓存预热',
  log_rotate: '日志轮转',
  db_backup: '数据库备份',
  index_rebuild: '索引重建',
}

export default function Dashboard() {
  const store = useTaskStore()
  const [newTaskName, setNewTaskName] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const taskColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: TaskStatus) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: '节点', dataIndex: 'node', key: 'node' },
    { title: '重试', key: 'retries', render: (_: any, r: Task) => `${r.retries}/${r.maxRetries}` },
    { title: '耗时', key: 'duration', render: (_: any, r: Task) => r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '-' },
    { title: '操作', key: 'actions', render: (_: any, r: Task) => (
      <Space>
        {r.status === 'failed' && <Button size="small" type="primary" onClick={() => store.retryTask(r.id)}>重试</Button>}
        {r.status === 'running' && <Button size="small" danger onClick={() => store.cancelTask(r.id)}>取消</Button>}
        <Button size="small" onClick={() => { store.selectTask(r); setDrawerOpen(true) }}>详情</Button>
      </Space>
    )},
  ]

  const successCount = store.tasks.filter(t => t.status === 'success').length
  const failedCount = store.tasks.filter(t => t.status === 'failed').length
  const runningCount = store.tasks.filter(t => t.status === 'running').length

  const latestMetrics = store.flatMetrics[store.flatMetrics.length - 1]

  const taskTypeStats = Object.keys(TASK_TYPE_LABELS).map(type => {
    const typeTasks = store.tasks.filter(t => t.name === type)
    const total = typeTasks.length
    const success = typeTasks.filter(t => t.status === 'success').length
    const failed = typeTasks.filter(t => t.status === 'failed').length
    const rate = latestMetrics?.[type] ?? (total > 0 ? (success / total) * 100 : 0)
    return { type, total, success, failed, rate }
  }).sort((a, b) => a.rate - b.rate)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: 18 }}>🔧 分布式任务调度与监控平台</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Input placeholder="任务名称" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} style={{ width: 160 }} />
          <Button type="primary" onClick={() => { if (newTaskName) { store.addTask(newTaskName); setNewTaskName('') } }}>
            添加任务
          </Button>
        </div>
      </Header>
      <Content style={{ padding: 16 }}>
        {/* Stats */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card><Statistic title="总任务" value={store.tasks.length} /></Card></Col>
          <Col span={6}><Card><Statistic title="运行中" value={runningCount} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="成功" value={successCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="失败" value={failedCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        </Row>

        <Tabs items={[
          { key: 'metrics', label: '监控指标', children: (
            <Row gutter={16}>
              <Col span={12}>
                <Card title="运行中任务数">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip labelFormatter={t => new Date(t as number).toLocaleString()} />
                      <Area type="monotone" dataKey="runningTasks" stroke="#1890ff" fill="#1890ff" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="成功率 %">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis domain={[0, 100]} fontSize={10} />
                      <Tooltip labelFormatter={t => new Date(t as number).toLocaleString()} />
                      <Line type="monotone" dataKey="successRate" stroke="#52c41a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={24} style={{ marginTop: 16 }}>
                <Card title="平均延迟 (ms)">
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="avgLatency" stroke="#faad14" fill="#faad14" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={24} style={{ marginTop: 16 }}>
                <Card
                  title="各任务类型成功率排名（越低越容易失败）"
                  extra={<span style={{ fontSize: 12, color: '#999' }}>数据口径与趋势图一致</span>}
                >
                  <Row gutter={[12, 12]}>
                    {taskTypeStats.map(stat => {
                      const riskColor = stat.rate >= 90 ? '#52c41a' : stat.rate >= 75 ? '#faad14' : '#ff4d4f'
                      return (
                        <Col span={6} key={stat.type}>
                          <Card
                            size="small"
                            style={{
                              borderLeft: `4px solid ${TASK_TYPE_COLORS[stat.type]}`,
                              background: stat.rate < 75 ? 'rgba(255,77,79,0.08)' : undefined
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 600 }}>{TASK_TYPE_LABELS[stat.type]}</span>
                              <Tag color={riskColor} style={{ margin: 0 }}>
                                {stat.rate >= 90 ? '稳定' : stat.rate >= 75 ? '关注' : '高风险'}
                              </Tag>
                            </div>
                            <Progress
                              percent={Math.round(stat.rate)}
                              strokeColor={riskColor}
                              size="small"
                              format={v => `${v}%`}
                            />
                            <div style={{ marginTop: 6, fontSize: 12, color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                              <span>总数: {stat.total}</span>
                              <span style={{ color: '#52c41a' }}>成功: {stat.success}</span>
                              <span style={{ color: '#ff4d4f' }}>失败: {stat.failed}</span>
                            </div>
                          </Card>
                        </Col>
                      )
                    })}
                  </Row>
                </Card>
              </Col>
              <Col span={24} style={{ marginTop: 16 }}>
                <Card title="成功率按任务类型趋势对比 %">
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={store.flatMetrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis domain={[0, 100]} fontSize={10} />
                      <Tooltip
                        labelFormatter={t => new Date(t as number).toLocaleString()}
                        formatter={(value: number, name: string) => [
                          `${value.toFixed(1)}%`,
                          TASK_TYPE_LABELS[name] || name
                        ]}
                      />
                      <Legend formatter={(value: string) => TASK_TYPE_LABELS[value] || value} />
                      {Object.keys(TASK_TYPE_COLORS).map(type => (
                        <Line
                          key={type}
                          type="monotone"
                          dataKey={type}
                          name={type}
                          stroke={TASK_TYPE_COLORS[type]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )},
          { key: 'tasks', label: '任务列表', children: (
            <Table dataSource={store.tasks} columns={taskColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
          )},
          { key: 'nodes', label: '集群节点', children: (
            <Row gutter={16}>
              {store.nodes.map(node => (
                <Col span={8} key={node.id} style={{ marginBottom: 16 }}>
                  <Card title={<span>{node.type === 'scheduler' ? '🎯' : '⚙️'} {node.name}</span>}
                    extra={<Tag color={node.status === 'online' ? 'green' : node.status === 'overloaded' ? 'orange' : 'red'}>{node.status}</Tag>}>
                    <Progress percent={Math.round(node.cpu)} strokeColor={node.cpu > 80 ? '#ff4d4f' : '#1890ff'} format={v => `CPU ${v}%`} />
                    <Progress percent={Math.round(node.memory)} strokeColor={node.memory > 80 ? '#ff4d4f' : '#52c41a'} format={v => `MEM ${v}%`} />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                      任务数: {node.tasks} | 运行时间: {Math.floor(node.uptime / 3600)}h
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )},
        ]} />

        {/* Task Detail Drawer */}
        <Drawer title="任务详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={480}>
          {store.selectedTask && (
            <>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="ID">{store.selectedTask.id}</Descriptions.Item>
                <Descriptions.Item label="名称">{store.selectedTask.name}</Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={STATUS_COLORS[store.selectedTask.status]}>{store.selectedTask.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="执行节点">{store.selectedTask.node}</Descriptions.Item>
                <Descriptions.Item label="重试次数">{store.selectedTask.retries}/{store.selectedTask.maxRetries}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{new Date(store.selectedTask.createdAt).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="耗时">{store.selectedTask.duration ? `${(store.selectedTask.duration / 1000).toFixed(1)}s` : '-'}</Descriptions.Item>
              </Descriptions>
              <h4 style={{ marginTop: 16 }}>执行日志</h4>
              <pre style={{ background: '#1f1f1f', padding: 12, borderRadius: 8, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                {store.selectedTask.logs.join('\n')}
              </pre>
            </>
          )}
        </Drawer>
      </Content>
    </Layout>
  )
}
