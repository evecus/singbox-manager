# SingBox Manager

基于 [sing-box 1.12.x](https://sing-box.sagernet.org) 核心的 Linux 透明代理管理工具，提供 Web 管理界面。

[![Build](https://github.com/yourusername/singbox-manager/actions/workflows/build.yml/badge.svg)](https://github.com/yourusername/singbox-manager/actions)

## 功能特性

- **多种代理模式**：TUN、TProxy、Redirect，自动配置对应的 nftables/iptables 规则和策略路由
- **Web 管理界面**：深色主题，响应式设计
- **DNS 管理**：支持 sing-box 1.12.x 新格式 DNS 服务器配置（UDP/TLS/HTTPS/QUIC/FakeIP/Hosts）
- **路由规则管理**：规则集（远程 .srs 二进制）、路由规则可视化编辑
- **节点管理**：支持 vless/vmess/trojan/shadowsocks/hysteria2/tuic/wireguard 等
- **订阅导入**：导入 sing-box JSON 格式订阅
- **连接监控**：实时连接列表、流量统计、WebSocket 日志流
- **局域网代理**：可作为旁路由/软路由使用
- **一键安装**：GitHub Release 自动构建多平台二进制

## 架构

```
singbox-manager (Go binary)
├── 内嵌 Web UI (React + Vite)
├── REST API (/api/*)
├── WebSocket (日志、流量实时推送)
├── sing-box 进程管理
├── nftables/iptables 规则管理
└── 策略路由管理 (ip rule/route)
```

## 快速安装

```bash
# 一键安装（自动检测架构，需要 root）
curl -fsSL https://raw.githubusercontent.com/yourusername/singbox-manager/main/install.sh | bash

# 启动服务
systemctl start singbox-manager

# 打开 Web UI
http://服务器IP:9090
```

## 代理模式说明

### TUN 模式（推荐）
创建虚拟网卡 `tun0`，使用 sing-box `auto_route` + `auto_redirect`（基于 nftables），接管所有 TCP/UDP 流量。
- ✅ 支持 TCP + UDP
- ✅ 性能最佳
- ✅ 自动解决与 Docker 网桥的冲突
- ✅ 支持 FakeIP

```
sing-box auto_redirect → nftables → tun0 → sing-box 处理
```

### TProxy 模式
使用 nftables/iptables TPROXY，适合旁路由场景。
- ✅ 支持 TCP + UDP
- ✅ 不需要创建 TUN 设备
- ⚙️ 需要配置策略路由

```
nftables TPROXY → 策略路由 → sing-box tproxy-in → 出站
```

### Redirect 模式
使用 iptables NAT REDIRECT，兼容性最好。
- ✅ 兼容性好
- ❌ 仅支持 TCP
- ❌ 无法代理 UDP（DNS 等需要额外处理）

## 手动构建

**需要**：Go 1.23+、Node.js 20+

```bash
git clone https://github.com/yourusername/singbox-manager
cd singbox-manager

# 构建 Web UI
cd web && npm install && npm run build && cd ..

# 构建 Go 二进制（自动内嵌 Web UI）
go build -ldflags="-s -w" -o singbox-manager ./cmd/singbox-manager

# 运行（需要 root）
sudo ./singbox-manager --listen 0.0.0.0:9090 --config-dir /etc/singbox-manager
```

## sing-box 配置格式（1.12.x）

本工具生成的配置使用 sing-box 1.12.x 最新格式：

```json
{
  "log": { "level": "info", "timestamp": true },
  "ntp": { "enabled": true, "server": "time.apple.com" },
  "dns": {
    "servers": [
      { "tag": "dns-direct", "type": "udp", "address": "223.5.5.5", "detour": "direct" },
      { "tag": "dns-remote", "type": "tls", "address": "tls://8.8.8.8", "address_resolver": "dns-direct", "detour": "proxy" },
      { "tag": "dns-fakeip", "type": "fakeip" }
    ],
    "rules": [
      { "query_type": ["A", "AAAA"], "server": "dns-fakeip" },
      { "rule_set": ["geosite-cn"], "server": "dns-direct" },
      { "outbound": ["any"], "server": "dns-direct" }
    ],
    "fakeip": { "enabled": true, "inet4_range": "198.18.0.0/15" }
  },
  "inbounds": [
    {
      "type": "tun", "tag": "tun-in",
      "auto_route": true, "auto_redirect": true, "strict_route": true,
      "stack": "mixed"
    }
  ],
  "route": {
    "rule_set": [
      {
        "tag": "geosite-cn", "type": "remote", "format": "binary",
        "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs",
        "download_detour": "direct", "update_interval": "1d"
      }
    ],
    "rules": [
      { "protocol": ["dns"], "outbound": "dns-out" },
      { "rule_set": ["geoip-cn", "geosite-cn"], "outbound": "direct" }
    ],
    "final": "proxy",
    "auto_detect_interface": true,
    "default_domain_resolver": "dns-remote"
  },
  "experimental": {
    "clash_api": { "external_controller": "127.0.0.1:9091", "store_selected": true },
    "cache_file": { "enabled": true }
  }
}
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 代理状态 |
| POST | `/api/start` | 启动代理 |
| POST | `/api/stop` | 停止代理 |
| POST | `/api/restart` | 重启代理 |
| GET/PUT | `/api/app-config` | 应用设置（代理模式、端口） |
| GET/PUT | `/api/config` | 完整 sing-box 配置 |
| GET/PUT | `/api/config/dns` | DNS 配置 |
| GET/PUT | `/api/config/outbounds` | 出站节点 |
| GET/PUT | `/api/config/route` | 路由规则 |
| POST | `/api/subscribe` | 导入订阅 |
| GET | `/api/connections` | 活跃连接列表 |
| GET | `/api/traffic` | 流量统计 |
| GET | `/api/logs/ws` | WebSocket 日志流 |
| GET | `/api/traffic/ws` | WebSocket 流量推送 |

## 支持平台

| 平台 | 架构 |
|------|------|
| Linux | amd64, arm64, armv7, 386, mipsle |

> Windows/macOS 不支持（透明代理依赖 Linux nftables/iptables）

## 依赖

- **sing-box** ≥ 1.12.0（需单独安装）
- **nftables** 或 **iptables**（Linux 内核 ≥ 3.10）
- **Go** 1.23+（编译时）
- **Node.js** 20+（编译时）

## License

MIT
