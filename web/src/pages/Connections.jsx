import React, { useEffect, useState } from 'react'
import { Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'

function fmtBytes(b) {
  if (b < 1024) return b + 'B'
  if (b < 1024*1024) return (b/1024).toFixed(1) + 'KB'
  return (b/1024/1024).toFixed(2) + 'MB'
}

function fmtTime(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s/60) + 'm'
  return Math.floor(s/3600) + 'h'
}

export default function Connections() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.getConnections()
      setConnections(r.connections || [])
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [])

  const close = async (id) => {
    try {
      await api.closeConnection(id)
      setConnections(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      toast.error(e.message)
    }
  }

  const filtered = connections.filter(c => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      c.metadata?.host?.toLowerCase().includes(q) ||
      c.metadata?.destinationIP?.toLowerCase().includes(q) ||
      c.rule?.toLowerCase().includes(q) ||
      (c.chains||[]).some(ch => ch.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">连接监控</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{connections.length} 个连接</span>
          <button onClick={load} disabled={loading} className="btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      <input
        className="input text-sm"
        placeholder="搜索主机名、IP、规则…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left py-3 px-4">主机</th>
                <th className="text-left py-3 px-3">网络</th>
                <th className="text-left py-3 px-3">链路</th>
                <th className="text-left py-3 px-3">规则</th>
                <th className="text-right py-3 px-3">上传</th>
                <th className="text-right py-3 px-3">下载</th>
                <th className="text-right py-3 px-3">时长</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-600">
                    {connections.length === 0 ? '暂无活跃连接' : '没有匹配结果'}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-gray-200 max-w-xs truncate">
                      {c.metadata?.host || c.metadata?.destinationIP || '未知'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.metadata?.sourceIP}:{c.metadata?.sourcePort} → :{c.metadata?.destinationPort}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`badge ${c.metadata?.network === 'tcp' ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'}`}>
                      {c.metadata?.network?.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-400 max-w-xs">
                    {(c.chains||[]).join(' → ')}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-400">
                    {c.rule}{c.rulePayload ? ` (${c.rulePayload})` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-right text-green-400 text-xs">{fmtBytes(c.upload)}</td>
                  <td className="py-2.5 px-3 text-right text-blue-400 text-xs">{fmtBytes(c.download)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500 text-xs">{fmtTime(c.start)}</td>
                  <td className="py-2.5 px-4">
                    <button onClick={() => close(c.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
