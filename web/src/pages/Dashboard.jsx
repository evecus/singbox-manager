import React, { useEffect, useState } from 'react'
import { ArrowUp, ArrowDown, Wifi, Server, Globe } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useStore } from '../store'
import { api } from '../api'

function fmtBytes(b) {
  if (b < 1024) return b + ' B/s'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB/s'
  return (b / 1024 / 1024).toFixed(2) + ' MB/s'
}

export default function Dashboard() {
  const { status, traffic, connections } = useStore()
  const [history, setHistory] = useState([])
  const [proxies, setProxies] = useState(null)

  useEffect(() => {
    setHistory((prev) => {
      const next = [...prev, { t: new Date().toLocaleTimeString(), ...traffic }].slice(-60)
      return next
    })
  }, [traffic])

  useEffect(() => {
    api.getProxies().then(setProxies).catch(() => {})
  }, [status])

  const totalNodes = proxies
    ? Object.values(proxies.proxies || {}).filter(p => !['direct','block','dns-out','DIRECT','REJECT'].includes(p.type)).length
    : 0

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">仪表盘</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ArrowUp className="text-green-400"/>} label="上传速度" value={fmtBytes(traffic.up)} />
        <StatCard icon={<ArrowDown className="text-blue-400"/>} label="下载速度" value={fmtBytes(traffic.down)} />
        <StatCard icon={<Wifi className="text-purple-400"/>} label="活跃连接" value={connections.length} />
        <StatCard icon={<Server className="text-orange-400"/>} label="节点数量" value={totalNodes} />
      </div>

      {/* Traffic chart */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-4">实时流量</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history}>
            <XAxis dataKey="t" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={b => (b/1024).toFixed(0)+'K'} tick={{ fill: '#6b7280', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v, name) => [fmtBytes(v), name === 'up' ? '上传' : '下载']}
            />
            <Line type="monotone" dataKey="up" stroke="#34d399" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="down" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Proxy selector */}
      {proxies && <ProxySelector proxies={proxies} />}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="p-2 bg-gray-800 rounded-lg">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}

function ProxySelector({ proxies }) {
  const groups = Object.entries(proxies.proxies || {})
    .filter(([, p]) => p.type === 'Selector' || p.type === 'URLTest')

  if (!groups.length) return null

  return (
    <div className="card">
      <h2 className="text-sm font-medium text-gray-400 mb-4">代理选择</h2>
      <div className="space-y-4">
        {groups.map(([name, group]) => (
          <ProxyGroup key={name} name={name} group={group} />
        ))}
      </div>
    </div>
  )
}

function ProxyGroup({ name, group }) {
  const [selected, setSelected] = useState(group.now)

  const handleSelect = async (node) => {
    try {
      await api.selectProxy(name, node)
      setSelected(node)
    } catch {}
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">{name} <span className="text-gray-600">({group.type})</span></div>
      <div className="flex flex-wrap gap-2">
        {(group.all || []).map(node => (
          <button
            key={node}
            onClick={() => handleSelect(node)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              node === selected
                ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            {node}
          </button>
        ))}
      </div>
    </div>
  )
}
