import React, { useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import {
  Activity, Server, Globe, Route as RouteIcon,
  Shield, Settings, Terminal, Wifi, LogOut, Play, Square, RotateCcw
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useStore } from './store'
import { api, wsLogs, wsTraffic } from './api'

import Dashboard from './pages/Dashboard'
import Proxies from './pages/Proxies'
import DNSPage from './pages/DNS'
import RoutePage from './pages/Route'
import Connections from './pages/Connections'
import LogsPage from './pages/Logs'
import SettingsPage from './pages/Settings'

const NAV = [
  { to: '/',            icon: Activity,   label: '仪表盘' },
  { to: '/proxies',     icon: Server,     label: '节点管理' },
  { to: '/dns',         icon: Globe,      label: 'DNS 设置' },
  { to: '/route',       icon: RouteIcon,  label: '路由规则' },
  { to: '/connections', icon: Wifi,       label: '连接监控' },
  { to: '/logs',        icon: Terminal,   label: '日志' },
  { to: '/settings',    icon: Settings,   label: '设置' },
]

const STATUS_COLOR = {
  stopped: 'bg-gray-500',
  starting: 'bg-yellow-500 animate-pulse',
  running: 'bg-green-500',
  stopping: 'bg-orange-500 animate-pulse',
  error: 'bg-red-500',
}

const STATUS_LABEL = {
  stopped: '已停止', starting: '启动中…',
  running: '运行中', stopping: '停止中…', error: '错误',
}

export default function App() {
  const { status, statusError, fetchStatus, addLog, setTraffic } = useStore()
  const wsLogRef = useRef(null)
  const wsTrafficRef = useRef(null)

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(fetchStatus, 3000)

    // WebSocket logs
    const connectLogs = () => {
      const ws = wsLogs()
      wsLogRef.current = ws
      ws.onmessage = (e) => addLog(JSON.parse(e.data))
      ws.onclose = () => setTimeout(connectLogs, 3000)
    }
    connectLogs()

    // WebSocket traffic
    const connectTraffic = () => {
      const ws = wsTraffic()
      wsTrafficRef.current = ws
      ws.onmessage = (e) => setTraffic(JSON.parse(e.data))
      ws.onclose = () => setTimeout(connectTraffic, 3000)
    }
    connectTraffic()

    return () => {
      clearInterval(timer)
      wsLogRef.current?.close()
      wsTrafficRef.current?.close()
    }
  }, [])

  const handleStart = async () => {
    try {
      await api.start()
      toast.success('代理已启动')
      setTimeout(fetchStatus, 1000)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleStop = async () => {
    try {
      await api.stop()
      toast.success('代理已停止')
      setTimeout(fetchStatus, 1000)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleRestart = async () => {
    try {
      await api.restart()
      toast.success('代理重启中…')
      setTimeout(fetchStatus, 2000)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const isRunning = status === 'running'
  const isBusy = status === 'starting' || status === 'stopping'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col bg-gray-900 border-r border-gray-800">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-800">
          <Shield className="text-primary-400" size={22} />
          <span className="font-semibold text-white text-base">SingBox</span>
          <span className="text-gray-500 text-xs">Manager</span>
        </div>

        {/* Status badge */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <span className={clsx('w-2 h-2 rounded-full', STATUS_COLOR[status])} />
            <span className="text-sm text-gray-300">{STATUS_LABEL[status]}</span>
          </div>
          {statusError && (
            <p className="text-xs text-red-400 truncate">{statusError}</p>
          )}
          <div className="flex gap-1.5 mt-2">
            {!isRunning && !isBusy && (
              <button onClick={handleStart} className="btn-primary flex-1 text-xs py-1 px-2 flex items-center justify-center gap-1">
                <Play size={12} /> 启动
              </button>
            )}
            {isRunning && (
              <>
                <button onClick={handleStop} className="btn-danger flex-1 text-xs py-1 px-2 flex items-center justify-center gap-1">
                  <Square size={12} /> 停止
                </button>
                <button onClick={handleRestart} className="btn-ghost text-xs py-1 px-2 flex items-center justify-center gap-1">
                  <RotateCcw size={12} />
                </button>
              </>
            )}
            {isBusy && (
              <div className="text-xs text-gray-400 py-1">请稍候…</div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx('flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'text-primary-400 bg-primary-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
          sing-box 1.12.x
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/proxies" element={<Proxies />} />
          <Route path="/dns" element={<DNSPage />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
