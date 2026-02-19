import React, { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'

const MODES = [
  {
    value: 'tun',
    label: 'TUN 模式',
    desc: '创建虚拟网卡接管所有流量，支持 TCP/UDP，使用 nftables/auto_redirect，性能最佳（推荐）',
    color: 'border-green-500/50 bg-green-500/5',
  },
  {
    value: 'tproxy',
    label: 'TProxy 模式',
    desc: '使用 iptables/nftables TPROXY，支持 TCP/UDP，适合旁路由/软路由场景',
    color: 'border-blue-500/50 bg-blue-500/5',
  },
  {
    value: 'redir',
    label: 'Redirect 模式',
    desc: '使用 iptables NAT REDIRECT，仅支持 TCP，兼容性最好但功能受限',
    color: 'border-yellow-500/50 bg-yellow-500/5',
  },
]

export default function SettingsPage() {
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getAppConfig().then(setCfg).catch(e => toast.error(e.message))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.setAppConfig(cfg)
      // Also regenerate inbounds based on new settings
      const singboxCfg = await api.getSingboxConfig()
      // Rebuild inbounds for the new proxy mode
      const modeInbounds = buildInbounds(cfg)
      await api.setInbounds(modeInbounds)
      toast.success('设置已保存，请重启代理生效')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) return <div className="p-6 text-gray-500">加载中…</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">设置</h1>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={14} /> {saving ? '保存中…' : '保存设置'}
        </button>
      </div>

      {/* Proxy mode */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-300">代理模式</h2>
        <div className="space-y-3">
          {MODES.map(mode => (
            <label
              key={mode.value}
              className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                cfg.proxy_mode === mode.value ? mode.color : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={mode.value}
                checked={cfg.proxy_mode === mode.value}
                onChange={() => setCfg({ ...cfg, proxy_mode: mode.value })}
                className="mt-0.5 accent-primary-500"
              />
              <div>
                <div className="font-medium text-gray-200">{mode.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{mode.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Ports */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-300">端口配置</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Mixed 端口（HTTP + SOCKS5）</label>
            <input
              type="number"
              className="input"
              value={cfg.mixed_port||7890}
              onChange={e => setCfg({...cfg, mixed_port: parseInt(e.target.value)})}
            />
            <p className="text-xs text-gray-600 mt-1">本机代理入口，设置系统代理时使用</p>
          </div>
          {cfg.proxy_mode === 'tproxy' && (
            <div>
              <label className="label">TProxy 端口</label>
              <input
                type="number"
                className="input"
                value={cfg.tproxy_port||7893}
                onChange={e => setCfg({...cfg, tproxy_port: parseInt(e.target.value)})}
              />
            </div>
          )}
          {cfg.proxy_mode === 'redir' && (
            <div>
              <label className="label">Redirect 端口</label>
              <input
                type="number"
                className="input"
                value={cfg.redir_port||7892}
                onChange={e => setCfg({...cfg, redir_port: parseInt(e.target.value)})}
              />
            </div>
          )}
        </div>
      </div>

      {/* LAN proxy */}
      {cfg.proxy_mode !== 'tun' && (
        <div className="card space-y-3">
          <h2 className="text-sm font-medium text-gray-300">局域网代理</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="accent-primary-500 w-4 h-4"
              checked={!!cfg.lan_proxy}
              onChange={e => setCfg({...cfg, lan_proxy: e.target.checked})}
            />
            <div>
              <div className="text-sm text-gray-200">允许局域网其他设备使用代理</div>
              <div className="text-xs text-gray-500 mt-0.5">
                开启后，局域网其他设备可以将代理设置为本机 IP:{cfg.mixed_port}
              </div>
            </div>
          </label>
          {cfg.lan_proxy && (
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-xs text-blue-300">
              <p className="font-medium mb-1">局域网设备代理设置：</p>
              <p>HTTP/HTTPS 代理：<code className="bg-blue-900/30 px-1 rounded">本机IP:{cfg.mixed_port}</code></p>
              <p className="mt-1">SOCKS5 代理：<code className="bg-blue-900/30 px-1 rounded">本机IP:{cfg.mixed_port}</code></p>
            </div>
          )}
        </div>
      )}

      {/* Auto start */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-300 mb-3">启动选项</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-primary-500 w-4 h-4"
            checked={!!cfg.auto_start}
            onChange={e => setCfg({...cfg, auto_start: e.target.checked})}
          />
          <div>
            <div className="text-sm text-gray-200">系统启动时自动开启代理</div>
            <div className="text-xs text-gray-500 mt-0.5">需要配合 systemd 服务使用</div>
          </div>
        </label>
      </div>

      {/* System proxy tip */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-300 mb-3">本机系统代理设置</h2>
        <div className="space-y-2 text-xs text-gray-400">
          <p>若不使用 TUN 模式，可手动配置系统代理：</p>
          <div className="bg-gray-800 rounded-lg p-3 font-mono space-y-1">
            <p># Linux (bash/zsh)</p>
            <p className="text-green-400">export http_proxy=http://127.0.0.1:{cfg.mixed_port}</p>
            <p className="text-green-400">export https_proxy=http://127.0.0.1:{cfg.mixed_port}</p>
            <p className="text-green-400">export all_proxy=socks5://127.0.0.1:{cfg.mixed_port}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 font-mono space-y-1">
            <p># 临时取消</p>
            <p className="text-red-400">unset http_proxy https_proxy all_proxy</p>
          </div>
        </div>
      </div>

      {/* Systemd service */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Systemd 服务</h2>
        <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
          <p className="text-gray-500"># /etc/systemd/system/singbox-manager.service</p>
          <p>[Unit]</p>
          <p>Description=SingBox Manager</p>
          <p>After=network.target</p>
          <p></p>
          <p>[Service]</p>
          <p>Type=simple</p>
          <p>ExecStart=/usr/local/bin/singbox-manager</p>
          <p>Restart=on-failure</p>
          <p>RestartSec=5s</p>
          <p></p>
          <p>[Install]</p>
          <p>WantedBy=multi-user.target</p>
        </div>
        <div className="mt-3 bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
          <p>systemctl daemon-reload</p>
          <p>systemctl enable --now singbox-manager</p>
        </div>
      </div>
    </div>
  )
}

function buildInbounds(cfg) {
  const inbounds = []
  const mixed = {
    type: 'mixed', tag: 'mixed-in',
    listen: cfg.lan_proxy ? '0.0.0.0' : '127.0.0.1',
    listen_port: cfg.mixed_port,
    sniff: true,
  }

  switch (cfg.proxy_mode) {
    case 'tun':
      inbounds.push({
        type: 'tun', tag: 'tun-in',
        interface_name: 'tun0',
        auto_route: true, auto_redirect: true, strict_route: true,
        stack: 'mixed',
        route_address: ['0.0.0.0/1','128.0.0.0/1','::/1','8000::/1'],
        sniff: true, sniff_override_destination: true,
      }, { ...mixed, listen: '127.0.0.1' })
      break
    case 'tproxy':
      inbounds.push({
        type: 'tproxy', tag: 'tproxy-in',
        listen: cfg.lan_proxy ? '0.0.0.0' : '127.0.0.1',
        listen_port: cfg.tproxy_port,
        network: 'tcp udp',
        sniff: true,
      }, mixed)
      break
    case 'redir':
      inbounds.push({
        type: 'redirect', tag: 'redir-in',
        listen: cfg.lan_proxy ? '0.0.0.0' : '127.0.0.1',
        listen_port: cfg.redir_port,
        sniff: true,
      }, mixed)
      break
  }
  return inbounds
}
