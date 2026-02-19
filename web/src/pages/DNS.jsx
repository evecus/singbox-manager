import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'

const SERVER_TYPES = ['udp','tcp','tls','https','quic','dhcp','fakeip','local','hosts']

export default function DNSPage() {
  const [dns, setDns] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getDNS().then(setDns).catch(e => toast.error(e.message))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.setDNS(dns)
      toast.success('DNS 配置已保存，重启生效')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!dns) return <div className="p-6 text-gray-500">加载中…</div>

  const updateServer = (i, key, val) => {
    const servers = [...dns.servers]
    servers[i] = { ...servers[i], [key]: val }
    setDns({ ...dns, servers })
  }

  const addServer = () => setDns({
    ...dns,
    servers: [...dns.servers, { tag: 'dns-new', type: 'udp', address: '8.8.8.8' }]
  })

  const removeServer = (i) => {
    const servers = dns.servers.filter((_, idx) => idx !== i)
    setDns({ ...dns, servers })
  }

  const updateRule = (i, key, val) => {
    const rules = [...dns.rules]
    rules[i] = { ...rules[i], [key]: val }
    setDns({ ...dns, rules })
  }

  const addRule = () => setDns({
    ...dns,
    rules: [...(dns.rules||[]), { domain_suffix: [], server: '' }]
  })

  const removeRule = (i) => setDns({ ...dns, rules: dns.rules.filter((_, idx) => idx !== i) })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">DNS 设置</h1>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={14} /> {saving ? '保存中…' : '保存'}
        </button>
      </div>

      {/* Global DNS settings */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-300">全局设置</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">默认 DNS（final）</label>
            <select className="input" value={dns.final||''} onChange={e => setDns({...dns, final: e.target.value})}>
              {(dns.servers||[]).map(s => <option key={s.tag} value={s.tag}>{s.tag}</option>)}
            </select>
          </div>
          <div>
            <label className="label">解析策略</label>
            <select className="input" value={dns.strategy||''} onChange={e => setDns({...dns, strategy: e.target.value})}>
              <option value="">默认</option>
              <option value="prefer_ipv4">prefer_ipv4</option>
              <option value="prefer_ipv6">prefer_ipv6</option>
              <option value="ipv4_only">ipv4_only</option>
              <option value="ipv6_only">ipv6_only</option>
            </select>
          </div>
        </div>

        {/* FakeIP */}
        {dns.fakeip && (
          <div className="border border-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm text-gray-400">FakeIP</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary-500"
                  checked={dns.fakeip.enabled}
                  onChange={e => setDns({...dns, fakeip: {...dns.fakeip, enabled: e.target.checked}})}
                />
                <span className="text-sm text-gray-400">启用</span>
              </label>
            </div>
            {dns.fakeip.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">IPv4 范围</label>
                  <input className="input text-sm" value={dns.fakeip.inet4_range||''} onChange={e => setDns({...dns, fakeip: {...dns.fakeip, inet4_range: e.target.value}})} />
                </div>
                <div>
                  <label className="label">IPv6 范围</label>
                  <input className="input text-sm" value={dns.fakeip.inet6_range||''} onChange={e => setDns({...dns, fakeip: {...dns.fakeip, inet6_range: e.target.value}})} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DNS Servers */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300">DNS 服务器</h2>
          <button onClick={addServer} className="btn-ghost text-xs flex items-center gap-1 py-1 px-2">
            <Plus size={12} /> 添加
          </button>
        </div>
        <div className="space-y-3">
          {(dns.servers||[]).map((server, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2">
                <label className="label">标签</label>
                <input className="input text-sm" value={server.tag||''} onChange={e => updateServer(i, 'tag', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">类型</label>
                <select className="input text-sm" value={server.type||''} onChange={e => updateServer(i, 'type', e.target.value)}>
                  {SERVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-4">
                <label className="label">地址</label>
                <input className="input text-sm" placeholder="1.1.1.1 / tls://1.1.1.1" value={server.address||''} onChange={e => updateServer(i, 'address', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">地址解析器</label>
                <input className="input text-sm" placeholder="dns-direct" value={server.address_resolver||''} onChange={e => updateServer(i, 'address_resolver', e.target.value)} />
              </div>
              <div className="col-span-1">
                <label className="label">出站</label>
                <input className="input text-sm" placeholder="direct" value={server.detour||''} onChange={e => updateServer(i, 'detour', e.target.value)} />
              </div>
              <div className="col-span-1 pb-0.5">
                <button onClick={() => removeServer(i)} className="text-red-500 hover:text-red-400 p-2">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DNS Rules */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300">DNS 规则</h2>
          <button onClick={addRule} className="btn-ghost text-xs flex items-center gap-1 py-1 px-2">
            <Plus size={12} /> 添加
          </button>
        </div>
        <div className="space-y-3">
          {(dns.rules||[]).map((rule, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">规则 #{i+1}</span>
                <button onClick={() => removeRule(i)} className="text-red-500 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">目标 DNS 服务器</label>
                  <input className="input text-sm" value={rule.server||''} onChange={e => updateRule(i, 'server', e.target.value)} />
                </div>
                <div>
                  <label className="label">出站过滤</label>
                  <input className="input text-sm" placeholder="any / direct" value={(rule.outbound||[]).join(',')} onChange={e => updateRule(i, 'outbound', e.target.value.split(',').filter(Boolean))} />
                </div>
                <div>
                  <label className="label">域名后缀（逗号分隔）</label>
                  <input className="input text-sm" placeholder=".google.com,.youtube.com" value={(rule.domain_suffix||[]).join(',')} onChange={e => updateRule(i, 'domain_suffix', e.target.value.split(',').filter(Boolean))} />
                </div>
                <div>
                  <label className="label">规则集</label>
                  <input className="input text-sm" placeholder="geosite-cn" value={(rule.rule_set||[]).join(',')} onChange={e => updateRule(i, 'rule_set', e.target.value.split(',').filter(Boolean))} />
                </div>
                <div>
                  <label className="label">Clash 模式</label>
                  <select className="input text-sm" value={rule.clash_mode||''} onChange={e => updateRule(i, 'clash_mode', e.target.value)}>
                    <option value="">不限制</option>
                    <option value="direct">direct</option>
                    <option value="global">global</option>
                    <option value="rule">rule</option>
                  </select>
                </div>
                <div>
                  <label className="label">查询类型</label>
                  <input className="input text-sm" placeholder="A,AAAA" value={(rule.query_type||[]).join(',')} onChange={e => updateRule(i, 'query_type', e.target.value.split(',').filter(Boolean))} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
