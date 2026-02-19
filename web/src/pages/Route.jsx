import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'

export default function RoutePage() {
  const [route, setRoute] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getRoute().then(setRoute).catch(e => toast.error(e.message))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.setRoute(route)
      toast.success('路由配置已保存，重启生效')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!route) return <div className="p-6 text-gray-500">加载中…</div>

  const updateRule = (i, key, val) => {
    const rules = [...route.rules]
    rules[i] = { ...rules[i], [key]: val }
    setRoute({ ...route, rules })
  }

  const addRule = () => setRoute({
    ...route,
    rules: [...(route.rules||[]), { outbound: 'direct' }]
  })

  const removeRule = (i) => setRoute({ ...route, rules: route.rules.filter((_, idx) => idx !== i) })

  const updateRuleSet = (i, key, val) => {
    const rs = [...route.rule_set]
    rs[i] = { ...rs[i], [key]: val }
    setRoute({ ...route, rule_set: rs })
  }

  const addRuleSet = () => setRoute({
    ...route,
    rule_set: [...(route.rule_set||[]), { tag: '', type: 'remote', format: 'binary', url: '', download_detour: 'direct', update_interval: '1d' }]
  })

  const removeRuleSet = (i) => setRoute({ ...route, rule_set: route.rule_set.filter((_, idx) => idx !== i) })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">路由规则</h1>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={14} /> {saving ? '保存中…' : '保存'}
        </button>
      </div>

      {/* Global route settings */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-300">全局路由设置</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">默认出站（final）</label>
            <input className="input text-sm" value={route.final||''} onChange={e => setRoute({...route, final: e.target.value})} />
          </div>
          <div>
            <label className="label">默认域名解析器</label>
            <input className="input text-sm" value={route.default_domain_resolver||''} onChange={e => setRoute({...route, default_domain_resolver: e.target.value})} />
          </div>
          <div>
            <label className="label">默认接口</label>
            <input className="input text-sm" placeholder="eth0" value={route.default_interface||''} onChange={e => setRoute({...route, default_interface: e.target.value})} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-primary-500" checked={!!route.auto_detect_interface} onChange={e => setRoute({...route, auto_detect_interface: e.target.checked})} />
          <span className="text-sm text-gray-400">自动检测出接口 (auto_detect_interface)</span>
        </label>
      </div>

      {/* Rule Sets */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300">规则集 (rule_set)</h2>
          <button onClick={addRuleSet} className="btn-ghost text-xs flex items-center gap-1 py-1 px-2">
            <Plus size={12} /> 添加
          </button>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          推荐使用 <a href="https://github.com/SagerNet/sing-geosite" target="_blank" className="text-primary-400 hover:underline">sing-geosite</a> 和{' '}
          <a href="https://github.com/SagerNet/sing-geoip" target="_blank" className="text-primary-400 hover:underline">sing-geoip</a> 的 .srs 二进制规则集
        </div>

        <div className="space-y-3">
          {(route.rule_set||[]).map((rs, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end bg-gray-800 rounded-lg p-3">
              <div className="col-span-2">
                <label className="label">标签</label>
                <input className="input text-sm" value={rs.tag||''} onChange={e => updateRuleSet(i, 'tag', e.target.value)} />
              </div>
              <div className="col-span-1">
                <label className="label">类型</label>
                <select className="input text-sm" value={rs.type||'remote'} onChange={e => updateRuleSet(i, 'type', e.target.value)}>
                  <option value="remote">remote</option>
                  <option value="local">local</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="label">格式</label>
                <select className="input text-sm" value={rs.format||'binary'} onChange={e => updateRuleSet(i, 'format', e.target.value)}>
                  <option value="binary">binary</option>
                  <option value="source">source</option>
                </select>
              </div>
              {rs.type === 'remote' ? (
                <>
                  <div className="col-span-4">
                    <label className="label">URL</label>
                    <input className="input text-sm" value={rs.url||''} onChange={e => updateRuleSet(i, 'url', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">下载出站</label>
                    <input className="input text-sm" value={rs.download_detour||'direct'} onChange={e => updateRuleSet(i, 'download_detour', e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <label className="label">更新间隔</label>
                    <input className="input text-sm" value={rs.update_interval||'1d'} onChange={e => updateRuleSet(i, 'update_interval', e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="col-span-7">
                  <label className="label">本地路径</label>
                  <input className="input text-sm" value={rs.path||''} onChange={e => updateRuleSet(i, 'path', e.target.value)} />
                </div>
              )}
              <div className="col-span-1 pb-0.5">
                <button onClick={() => removeRuleSet(i)} className="text-red-500 hover:text-red-400 p-2">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Route Rules */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300">路由规则</h2>
          <button onClick={addRule} className="btn-ghost text-xs flex items-center gap-1 py-1 px-2">
            <Plus size={12} /> 添加
          </button>
        </div>
        <div className="space-y-3">
          {(route.rules||[]).map((rule, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">规则 #{i+1}</span>
                <button onClick={() => removeRule(i)} className="text-red-500 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">出站 (outbound)</label>
                  <input className="input text-sm" value={rule.outbound||''} onChange={e => updateRule(i, 'outbound', e.target.value)} />
                </div>
                <div>
                  <label className="label">规则集</label>
                  <input className="input text-sm" placeholder="geoip-cn,geosite-cn" value={(rule.rule_set||[]).join(',')} onChange={e => updateRule(i, 'rule_set', e.target.value.split(',').filter(Boolean))} />
                </div>
                <div>
                  <label className="label">协议</label>
                  <input className="input text-sm" placeholder="dns,quic" value={(rule.protocol||[]).join(',')} onChange={e => updateRule(i, 'protocol', e.target.value.split(',').filter(Boolean))} />
                </div>
                <div>
                  <label className="label">IP CIDR</label>
                  <input className="input text-sm" placeholder="192.168.0.0/16" value={(rule.ip_cidr||[]).join(',')} onChange={e => updateRule(i, 'ip_cidr', e.target.value.split(',').filter(Boolean))} />
                </div>
                <div>
                  <label className="label">域名后缀</label>
                  <input className="input text-sm" placeholder=".cn,.local" value={(rule.domain_suffix||[]).join(',')} onChange={e => updateRule(i, 'domain_suffix', e.target.value.split(',').filter(Boolean))} />
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
                  <label className="label">入站标签</label>
                  <input className="input text-sm" placeholder="tun-in" value={(rule.inbound||[]).join(',')} onChange={e => updateRule(i, 'inbound', e.target.value.split(',').filter(Boolean))} />
                </div>
                <div>
                  <label className="label">Geoip</label>
                  <input className="input text-sm" placeholder="cn,private" value={(rule.geoip||[]).join(',')} onChange={e => updateRule(i, 'geoip', e.target.value.split(',').filter(Boolean))} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
