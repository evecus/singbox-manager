import React, { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'

const LEVEL_COLOR = {
  info: 'text-gray-400',
  debug: 'text-gray-500',
  warn: 'text-yellow-400',
  error: 'text-red-400',
}

export default function LogsPage() {
  const { logs } = useStore()
  const bottomRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    // Auto scroll to bottom if near bottom
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">日志</h1>
        <span className="text-xs text-gray-600">{logs.length} 条日志（最多 500 条）</span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-y-auto p-4 font-mono text-xs space-y-0.5 min-h-0"
        style={{ maxHeight: 'calc(100vh - 160px)' }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-600 text-center py-8">等待日志输出…</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-gray-600 shrink-0">
                {new Date(log.time).toLocaleTimeString()}
              </span>
              <span className={clsx('w-10 shrink-0', LEVEL_COLOR[log.level] || 'text-gray-400')}>
                {log.level?.toUpperCase()?.slice(0, 4)}
              </span>
              <span className={clsx(LEVEL_COLOR[log.level] || 'text-gray-400', 'break-all')}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
