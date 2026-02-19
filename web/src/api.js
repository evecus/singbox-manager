const BASE = '/api'

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const r = await fetch(BASE + path, opts)
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }))
    throw new Error(err.error || r.statusText)
  }
  if (r.status === 204) return null
  return r.json()
}

export const api = {
  // Status & control
  getStatus: () => req('GET', '/status'),
  start: () => req('POST', '/start'),
  stop: () => req('POST', '/stop'),
  restart: () => req('POST', '/restart'),

  // App config
  getAppConfig: () => req('GET', '/app-config'),
  setAppConfig: (cfg) => req('PUT', '/app-config', cfg),

  // sing-box config
  getSingboxConfig: () => req('GET', '/config'),
  setSingboxConfig: (cfg) => req('PUT', '/config', cfg),

  getDNS: () => req('GET', '/config/dns'),
  setDNS: (dns) => req('PUT', '/config/dns', dns),

  getOutbounds: () => req('GET', '/config/outbounds'),
  setOutbounds: (obs) => req('PUT', '/config/outbounds', obs),

  getRoute: () => req('GET', '/config/route'),
  setRoute: (route) => req('PUT', '/config/route', route),

  getInbounds: () => req('GET', '/config/inbounds'),
  setInbounds: (inbounds) => req('PUT', '/config/inbounds', inbounds),

  // Subscription
  subscribe: (url, name) => req('POST', '/subscribe', { url, name }),

  // Monitoring
  getConnections: () => req('GET', '/connections'),
  closeConnection: (id) => req('DELETE', `/connections/${id}`),
  getTraffic: () => req('GET', '/traffic'),
  getProxies: () => req('GET', '/proxies'),
  selectProxy: (group, name) => req('PUT', `/proxies/${group}`, { name }),

  // Logs
  getLogs: () => req('GET', '/logs'),
}

export function wsLogs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${location.host}/api/logs/ws`)
}

export function wsTraffic() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${location.host}/api/traffic/ws`)
}
