package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// AppConfig is singbox-manager's own settings
type AppConfig struct {
	ProxyMode   string `json:"proxy_mode"`   // tun, tproxy, redir
	ListenPort  int    `json:"listen_port"`  // transparent proxy listen port
	RedirPort   int    `json:"redir_port"`
	TproxyPort  int    `json:"tproxy_port"`
	MixedPort   int    `json:"mixed_port"`   // HTTP+SOCKS5 mixed port for local proxy
	LanProxy    bool   `json:"lan_proxy"`    // expose proxy to LAN
	AutoStart   bool   `json:"auto_start"`
}

// SingboxConfig is the full sing-box 1.12.x configuration
type SingboxConfig struct {
	Log         *LogConfig      `json:"log,omitempty"`
	DNS         *DNSConfig      `json:"dns,omitempty"`
	NTP         *NTPConfig      `json:"ntp,omitempty"`
	Inbounds    []Inbound       `json:"inbounds,omitempty"`
	Outbounds   []Outbound      `json:"outbounds,omitempty"`
	Route       *RouteConfig    `json:"route,omitempty"`
	Experimental *ExperimentalConfig `json:"experimental,omitempty"`
}

type LogConfig struct {
	Level     string `json:"level"`
	Timestamp bool   `json:"timestamp"`
}

type NTPConfig struct {
	Enabled  bool   `json:"enabled"`
	Server   string `json:"server"`
	Interval string `json:"interval,omitempty"`
}

// DNS 1.12.x new format
type DNSConfig struct {
	Servers       []DNSServer  `json:"servers"`
	Rules         []DNSRule    `json:"rules,omitempty"`
	Final         string       `json:"final,omitempty"`
	Strategy      string       `json:"strategy,omitempty"`
	FakeIP        *FakeIPConfig `json:"fakeip,omitempty"`
}

type DNSServer struct {
	Tag             string `json:"tag"`
	Type            string `json:"type"` // udp, tcp, tls, https, quic, dhcp, fakeip, local, hosts
	Address         string `json:"address,omitempty"`
	AddressResolver string `json:"address_resolver,omitempty"`
	Detour          string `json:"detour,omitempty"`
}

type DNSRule struct {
	Type           string   `json:"type,omitempty"`
	Mode           string   `json:"mode,omitempty"`
	Rules          []DNSRule `json:"rules,omitempty"`
	Domain         []string `json:"domain,omitempty"`
	DomainSuffix   []string `json:"domain_suffix,omitempty"`
	DomainKeyword  []string `json:"domain_keyword,omitempty"`
	DomainRegex    []string `json:"domain_regex,omitempty"`
	Geosite        []string `json:"geosite,omitempty"`
	RuleSet        []string `json:"rule_set,omitempty"`
	Outbound       []string `json:"outbound,omitempty"`
	ClashMode      string   `json:"clash_mode,omitempty"`
	QueryType      []string `json:"query_type,omitempty"`
	Server         string   `json:"server"`
	DisableCache   bool     `json:"disable_cache,omitempty"`
	RewriteTTL     *int     `json:"rewrite_ttl,omitempty"`
}

type FakeIPConfig struct {
	Enabled    bool     `json:"enabled"`
	Inet4Range string   `json:"inet4_range,omitempty"`
	Inet6Range string   `json:"inet6_range,omitempty"`
}

type Inbound struct {
	Type           string `json:"type"`
	Tag            string `json:"tag"`
	Listen         string `json:"listen,omitempty"`
	ListenPort     int    `json:"listen_port,omitempty"`
	SniffEnabled   bool   `json:"sniff,omitempty"`
	SniffOverride  bool   `json:"sniff_override_destination,omitempty"`
	// TUN specific
	InterfaceName  string   `json:"interface_name,omitempty"`
	AutoRoute      bool     `json:"auto_route,omitempty"`
	AutoRedirect   bool     `json:"auto_redirect,omitempty"`
	StrictRoute    bool     `json:"strict_route,omitempty"`
	RouteAddress   []string `json:"route_address,omitempty"`
	Stack          string   `json:"stack,omitempty"`
	// tproxy
	Network        string `json:"network,omitempty"`
	// mixed/http/socks
	Users          []InboundUser `json:"users,omitempty"`
	SetSystemProxy bool   `json:"set_system_proxy,omitempty"`
}

type InboundUser struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Outbound struct {
	Type           string          `json:"type"`
	Tag            string          `json:"tag"`
	// direct
	DomainResolver string          `json:"domain_resolver,omitempty"`
	// proxy common
	Server         string          `json:"server,omitempty"`
	ServerPort     int             `json:"server_port,omitempty"`
	UUID           string          `json:"uuid,omitempty"`
	Password       string          `json:"password,omitempty"`
	// selector/urltest
	Outbounds      []string        `json:"outbounds,omitempty"`
	Default        string          `json:"default,omitempty"`
	URL            string          `json:"url,omitempty"`
	Interval       string          `json:"interval,omitempty"`
	Tolerance      int             `json:"tolerance,omitempty"`
	// raw extra fields
	Extra          json.RawMessage `json:"-"`
}

type RouteConfig struct {
	Rules              []RouteRule  `json:"rules,omitempty"`
	RuleSet            []RuleSet    `json:"rule_set,omitempty"`
	Final              string       `json:"final,omitempty"`
	AutoDetectInterface bool        `json:"auto_detect_interface,omitempty"`
	DefaultInterface   string       `json:"default_interface,omitempty"`
	DefaultDomainResolver string    `json:"default_domain_resolver,omitempty"`
}

type RouteRule struct {
	Type          string   `json:"type,omitempty"`
	Mode          string   `json:"mode,omitempty"`
	Rules         []RouteRule `json:"rules,omitempty"`
	Inbound       []string `json:"inbound,omitempty"`
	IPVersion     int      `json:"ip_version,omitempty"`
	Network       []string `json:"network,omitempty"`
	Protocol      []string `json:"protocol,omitempty"`
	Domain        []string `json:"domain,omitempty"`
	DomainSuffix  []string `json:"domain_suffix,omitempty"`
	DomainKeyword []string `json:"domain_keyword,omitempty"`
	DomainRegex   []string `json:"domain_regex,omitempty"`
	Geoip         []string `json:"geoip,omitempty"`
	Geosite       []string `json:"geosite,omitempty"`
	IPCIDR        []string `json:"ip_cidr,omitempty"`
	Port          []int    `json:"port,omitempty"`
	PortRange     []string `json:"port_range,omitempty"`
	RuleSet       []string `json:"rule_set,omitempty"`
	ClashMode     string   `json:"clash_mode,omitempty"`
	Outbound      string   `json:"outbound"`
	Action        string   `json:"action,omitempty"`
}

type RuleSet struct {
	Tag            string `json:"tag"`
	Type           string `json:"type"` // remote or local
	Format         string `json:"format"` // binary or source
	Path           string `json:"path,omitempty"`
	URL            string `json:"url,omitempty"`
	DownloadDetour string `json:"download_detour,omitempty"`
	UpdateInterval string `json:"update_interval,omitempty"`
}

type ExperimentalConfig struct {
	ClashAPI *ClashAPIConfig `json:"clash_api,omitempty"`
	CacheFile *CacheFileConfig `json:"cache_file,omitempty"`
}

type ClashAPIConfig struct {
	ExternalController     string `json:"external_controller"`
	ExternalUI             string `json:"external_ui,omitempty"`
	ExternalUIDownloadURL  string `json:"external_ui_download_url,omitempty"`
	Secret                 string `json:"secret,omitempty"`
	StoreSelected          bool   `json:"store_selected,omitempty"`
	StoreMode              bool   `json:"store_mode,omitempty"`
	DefaultMode            string `json:"default_mode,omitempty"`
}

type CacheFileConfig struct {
	Enabled    bool   `json:"enabled"`
	Path       string `json:"path,omitempty"`
	StoreRDRC  bool   `json:"store_rdrc,omitempty"`
}

// Manager handles config file persistence
type Manager struct {
	dir       string
	mu        sync.RWMutex
	appCfg    AppConfig
	singboxCfg SingboxConfig
}

func NewManager(dir string) (*Manager, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create config dir: %w", err)
	}

	m := &Manager{dir: dir}

	// Load or create defaults
	if err := m.loadAppConfig(); err != nil {
		m.appCfg = defaultAppConfig()
		_ = m.saveAppConfig()
	}
	if err := m.loadSingboxConfig(); err != nil {
		m.singboxCfg = defaultSingboxConfig(m.appCfg)
		_ = m.saveSingboxConfig()
	}

	return m, nil
}

func (m *Manager) AppConfigPath() string    { return filepath.Join(m.dir, "app.json") }
func (m *Manager) SingboxConfigPath() string { return filepath.Join(m.dir, "config.json") }

func (m *Manager) GetAppConfig() AppConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.appCfg
}

func (m *Manager) SetAppConfig(cfg AppConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.appCfg = cfg
	return m.saveAppConfig()
}

func (m *Manager) GetSingboxConfig() SingboxConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.singboxCfg
}

func (m *Manager) SetSingboxConfig(cfg SingboxConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.singboxCfg = cfg
	return m.saveSingboxConfig()
}

func (m *Manager) loadAppConfig() error {
	data, err := os.ReadFile(m.AppConfigPath())
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &m.appCfg)
}

func (m *Manager) saveAppConfig() error {
	data, err := json.MarshalIndent(m.appCfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(m.AppConfigPath(), data, 0644)
}

func (m *Manager) loadSingboxConfig() error {
	data, err := os.ReadFile(m.SingboxConfigPath())
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &m.singboxCfg)
}

func (m *Manager) saveSingboxConfig() error {
	data, err := json.MarshalIndent(m.singboxCfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(m.SingboxConfigPath(), data, 0644)
}

func defaultAppConfig() AppConfig {
	return AppConfig{
		ProxyMode:  "tun",
		ListenPort: 7890,
		MixedPort:  7890,
		RedirPort:  7892,
		TproxyPort: 7893,
		LanProxy:   false,
		AutoStart:  false,
	}
}

func defaultSingboxConfig(app AppConfig) SingboxConfig {
	fakeipEnabled := app.ProxyMode == "tun"
	ttl0 := 1

	cfg := SingboxConfig{
		Log: &LogConfig{
			Level:     "info",
			Timestamp: true,
		},
		NTP: &NTPConfig{
			Enabled:  true,
			Server:   "time.apple.com",
			Interval: "30m",
		},
		DNS: &DNSConfig{
			Servers: []DNSServer{
				{Tag: "dns-direct", Type: "udp", Address: "223.5.5.5", Detour: "direct"},
				{Tag: "dns-remote", Type: "tls", Address: "tls://8.8.8.8", AddressResolver: "dns-direct", Detour: "proxy"},
				{Tag: "dns-block", Type: "local"},
			},
			Rules: []DNSRule{
				{
					RuleSet:  []string{"geosite-cn"},
					Server:   "dns-direct",
				},
				{
					ClashMode: "direct",
					Server:    "dns-direct",
				},
				{
					ClashMode: "global",
					Server:    "dns-remote",
				},
				{
					Outbound: []string{"any"},
					Server:   "dns-direct",
				},
			},
			Final:    "dns-remote",
			Strategy: "prefer_ipv4",
			FakeIP: &FakeIPConfig{
				Enabled:    fakeipEnabled,
				Inet4Range: "198.18.0.0/15",
				Inet6Range: "fc00::/18",
			},
		},
		Outbounds: []Outbound{
			{
				Tag:       "proxy",
				Type:      "selector",
				Outbounds: []string{"auto", "direct"},
				Default:   "auto",
			},
			{
				Tag:       "auto",
				Type:      "urltest",
				Outbounds: []string{},
				URL:       "https://www.gstatic.com/generate_204",
				Interval:  "3m",
				Tolerance: 50,
			},
			{Tag: "direct", Type: "direct", DomainResolver: "dns-direct"},
			{Tag: "block", Type: "block"},
			{Tag: "dns-out", Type: "dns"},
		},
		Route: &RouteConfig{
			AutoDetectInterface:   true,
			DefaultDomainResolver: "dns-remote",
			RuleSet: []RuleSet{
				{
					Tag:            "geosite-cn",
					Type:           "remote",
					Format:         "binary",
					URL:            "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs",
					DownloadDetour: "direct",
					UpdateInterval: "1d",
				},
				{
					Tag:            "geoip-cn",
					Type:           "remote",
					Format:         "binary",
					URL:            "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs",
					DownloadDetour: "direct",
					UpdateInterval: "1d",
				},
			},
			Rules: []RouteRule{
				{Protocol: []string{"dns"}, Outbound: "dns-out"},
				{ClashMode: "direct", Outbound: "direct"},
				{ClashMode: "global", Outbound: "proxy"},
				{RuleSet: []string{"geoip-cn", "geosite-cn"}, Outbound: "direct"},
				{Geoip: []string{"private"}, Outbound: "direct"},
			},
			Final: "proxy",
		},
		Experimental: &ExperimentalConfig{
			ClashAPI: &ClashAPIConfig{
				ExternalController: "127.0.0.1:9091",
				StoreSelected:      true,
				StoreMode:          true,
				DefaultMode:        "rule",
			},
			CacheFile: &CacheFileConfig{
				Enabled: true,
				Path:    "/var/lib/singbox-manager/cache.db",
				StoreRDRC: true,
			},
		},
	}

	_ = ttl0

	// Build inbounds based on proxy mode
	switch app.ProxyMode {
	case "tun":
		cfg.Inbounds = []Inbound{
			{
				Type:          "tun",
				Tag:           "tun-in",
				InterfaceName: "tun0",
				AutoRoute:     true,
				AutoRedirect:  true,
				StrictRoute:   true,
				Stack:         "mixed",
				RouteAddress:  []string{"0.0.0.0/1", "128.0.0.0/1", "::/1", "8000::/1"},
				SniffEnabled:  true,
				SniffOverride: true,
			},
			{
				Type:       "mixed",
				Tag:        "mixed-in",
				Listen:     "127.0.0.1",
				ListenPort: app.MixedPort,
				SniffEnabled: true,
			},
		}
		if fakeipEnabled {
			// Add fakeip DNS server
			cfg.DNS.Servers = append(cfg.DNS.Servers, DNSServer{
				Tag:  "dns-fakeip",
				Type: "fakeip",
			})
			cfg.DNS.Rules = append([]DNSRule{
				{
					QueryType: []string{"A", "AAAA"},
					Server:    "dns-fakeip",
				},
			}, cfg.DNS.Rules...)
		}
	case "tproxy":
		listenAddr := "127.0.0.1"
		if app.LanProxy {
			listenAddr = "0.0.0.0"
		}
		cfg.Inbounds = []Inbound{
			{
				Type:       "tproxy",
				Tag:        "tproxy-in",
				Listen:     listenAddr,
				ListenPort: app.TproxyPort,
				Network:    "tcp udp",
				SniffEnabled: true,
			},
			{
				Type:       "mixed",
				Tag:        "mixed-in",
				Listen:     "127.0.0.1",
				ListenPort: app.MixedPort,
				SniffEnabled: true,
			},
		}
	case "redir":
		listenAddr := "127.0.0.1"
		if app.LanProxy {
			listenAddr = "0.0.0.0"
		}
		cfg.Inbounds = []Inbound{
			{
				Type:       "redirect",
				Tag:        "redir-in",
				Listen:     listenAddr,
				ListenPort: app.RedirPort,
				SniffEnabled: true,
			},
			{
				Type:       "mixed",
				Tag:        "mixed-in",
				Listen:     "127.0.0.1",
				ListenPort: app.MixedPort,
				SniffEnabled: true,
			},
		}
	}

	if app.LanProxy && app.ProxyMode != "tun" {
		cfg.Inbounds = append(cfg.Inbounds, Inbound{
			Type:       "mixed",
			Tag:        "mixed-lan",
			Listen:     "0.0.0.0",
			ListenPort: app.MixedPort,
			SniffEnabled: true,
		})
	}

	return cfg
}
