import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Download, Edit2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import Editor from '@monaco-editor/react'

const OUTBOUND_TYPES = [
  'vless','vmess','trojan','shadowsocks','hysteria2',
  'tuic','wireguard','socks','http','anytls',
]

export default function Proxies() {
  const [outbounds, setOutbounds] = useState([])
  const [showSubscribe, setShowSubscribe] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editIdx, setEditIdx] = useState(null)
  const [editRaw, setEditRaw] = useState('')

  const load = () => api.getOutbounds().then(setOutbounds).catch(e => toast.error(e.message))

  useEffect(() => { load() }, [])

  const proxyOutbounds = outbounds.filter(o =>
    !['direct','block','dns-out','selector','urltest','dns'].includes(o.type)
  )
  const systemOutbounds = outbounds.filter(o =>
    ['direct','block','dns-out','selector','urltest','dns'].includes(o.type)
  )

  const save = async (obs) => {
    try {
      await api.setOutbounds(obs)
      setOutbounds(obs)
      toast.success('保存成功')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const deleteOutbound = (tag) => {
    const next = outbounds.filter(o => o.tag !== tag)
    // Remove from selectors
    const updated = next.map(o => ({
      ...o,
      outbounds: o.outbounds ? o.outbounds.filter(t => t !== tag) : undefined,
    }))
    save(updated)
  }

  const openEdit = (ob) => {
    setEditIdx(ob.tag)
    setEditRaw(JSON.stringify(ob, null, 2))
  }

  const saveEdit = async () => {
    try {
      const parsed = JSON.parse(editRaw)
      const next = outbounds.map(o => o.tag === editIdx ? parsed : o)
      await save(next)
      setEditIdx(null)
    } catch (e) {
      toast.error('JSON 格式错误: ' + e.message)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">节点管理</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowSubscribe(true)} className="btn-ghost flex items-center gap-2 text-sm">
            <Download size={14} /> 导入订阅
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> 添加节点
          </button>
        </div>
      </div>

      {/* System outbounds */}
      <div className="card">
        <h2 className="text-sm text-gray-400 mb-3">系统出站</h2>
        <div className="space-y-2">
          {systemOutbounds.map(ob => (
            <div key={ob.tag} className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="badge bg-gray-700 text-gray-300">{ob.type}</span>
                <span className="text-sm text-gray-200">{ob.tag}</span>
                {ob.outbounds && (
                  <span className="text-xs text-gray-500">{ob.outbounds.length} 个节点</span>
                )}
              </div>
              <button onClick={() => openEdit(ob)} className="text-gray-500 hover:text-gray-300 p-1">
                <Edit2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Proxy outbounds */}
      <div className="card">
        <h2 className="text-sm text-gray-400 mb-3">代理节点 ({proxyOutbounds.length})</h2>
        {proxyOutbounds.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            暂无节点，请添加或导入订阅
          </div>
        ) : (
          <div className="space-y-2">
            {proxyOutbounds.map(ob => (
              <div key={ob.tag} className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded-lg group">
                <div className="flex items-center gap-3">
                  <span className="badge bg-primary-900/50 text-primary-300">{ob.type}</span>
                  <div>
                    <div className="text-sm text-gray-200">{ob.tag}</div>
                    {ob.server && (
                      <div className="text-xs text-gray-500">{ob.server}:{ob.server_port}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(ob)} className="text-gray-500 hover:text-gray-300 p-1">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteOutbound(ob.tag)} className="text-red-500 hover:text-red-400 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editIdx !== null && (
        <Modal title={`编辑: ${editIdx}`} onClose={() => setEditIdx(null)}>
          <div className="h-96">
            <Editor
              defaultLanguage="json"
              value={editRaw}
              onChange={v => setEditRaw(v || '')}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditIdx(null)} className="btn-ghost text-sm">取消</button>
            <button onClick={saveEdit} className="btn-primary text-sm">保存</button>
          </div>
        </Modal>
      )}

      {/* Subscribe modal */}
      {showSubscribe && (
        <SubscribeModal onClose={() => setShowSubscribe(false)} onDone={load} />
      )}

      {/* Add node modal */}
      {showAdd && (
        <AddNodeModal onClose={() => setShowAdd(false)} onDone={load} outbounds={outbounds} setOutbounds={setOutbounds} save={save} />
      )}
    </div>
  )
}

function SubscribeModal({ onClose, onDone }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    if (!url) return
    setLoading(true)
    try {
      const r = await api.subscribe(url, name)
      toast.success(`导入成功: ${r.imported} 个节点`)
      onDone()
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="导入订阅" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">订阅 URL</label>
          <input className="input" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">支持 sing-box JSON 格式订阅</p>
        </div>
        <div>
          <label className="label">备注名称（可选）</label>
          <input className="input" placeholder="我的订阅" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">取消</button>
          <button onClick={handleImport} disabled={loading || !url} className="btn-primary text-sm">
            {loading ? '导入中…' : '导入'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AddNodeModal({ onClose, outbounds, save }) {
  const [type, setType] = useState('vless')
  const template = {
    vless: { type: 'vless', tag: '新节点', server: '', server_port: 443, uuid: '', tls: { enabled: true } },
    vmess: { type: 'vmess', tag: '新节点', server: '', server_port: 443, uuid: '', security: 'auto' },
    trojan: { type: 'trojan', tag: '新节点', server: '', server_port: 443, password: '', tls: { enabled: true } },
    shadowsocks: { type: 'shadowsocks', tag: '新节点', server: '', server_port: 8388, method: 'aes-128-gcm', password: '' },
    hysteria2: { type: 'hysteria2', tag: '新节点', server: '', server_port: 443, password: '', tls: { enabled: true } },
  }
  const [raw, setRaw] = useState(JSON.stringify(template[type] || { type, tag: '新节点' }, null, 2))

  useEffect(() => {
    setRaw(JSON.stringify(template[type] || { type, tag: '新节点' }, null, 2))
  }, [type])

  const handleAdd = async () => {
    try {
      const parsed = JSON.parse(raw)
      const next = [...outbounds, parsed]
      // add to auto urltest and proxy selector
      const updated = next.map(o => {
        if (o.type === 'selector' || o.type === 'urltest') {
          const obs = [...(o.outbounds || [])]
          if (!obs.includes(parsed.tag)) obs.unshift(parsed.tag)
          return { ...o, outbounds: obs }
        }
        return o
      })
      await save(updated)
      onClose()
    } catch (e) {
      toast.error('JSON 错误: ' + e.message)
    }
  }

  return (
    <Modal title="添加节点" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">协议类型</label>
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            {OUTBOUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="h-72">
          <Editor
            defaultLanguage="json"
            value={raw}
            onChange={v => setRaw(v || '')}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">取消</button>
          <button onClick={handleAdd} className="btn-primary text-sm">添加</button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="font-medium text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18}/></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
