package api

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"
	"github.com/yourusername/singbox-manager/internal/config"
	"github.com/yourusername/singbox-manager/internal/proxy"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func NewRouter(cfg *config.Manager, pm *proxy.Manager, webFS fs.FS) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Proxy control
		r.Get("/status", handleStatus(pm))
		r.Post("/start", handleStart(pm))
		r.Post("/stop", handleStop(pm))
		r.Post("/restart", handleRestart(pm))

		// App config (proxy mode, ports, etc)
		r.Get("/app-config", handleGetAppConfig(cfg))
		r.Put("/app-config", handleSetAppConfig(cfg, pm))

		// sing-box config sections
		r.Get("/config", handleGetSingboxConfig(cfg))
		r.Put("/config", handleSetSingboxConfig(cfg, pm))

		r.Get("/config/dns", handleGetDNS(cfg))
		r.Put("/config/dns", handleSetDNS(cfg, pm))

		r.Get("/config/outbounds", handleGetOutbounds(cfg))
		r.Put("/config/outbounds", handleSetOutbounds(cfg, pm))

		r.Get("/config/route", handleGetRoute(cfg))
		r.Put("/config/route", handleSetRoute(cfg, pm))

		r.Get("/config/inbounds", handleGetInbounds(cfg))
		r.Put("/config/inbounds", handleSetInbounds(cfg, pm))

		// Subscription import
		r.Post("/subscribe", handleSubscribe(cfg))

		// Connections and traffic from clash API proxy
		r.Get("/connections", handleConnections(pm))
		r.Delete("/connections/{id}", handleCloseConnection(pm))
		r.Get("/traffic", handleTraffic(pm))
		r.Get("/proxies", handleProxies(pm))
		r.Put("/proxies/{group}", handleSelectProxy(pm))

		// Logs WebSocket
		r.Get("/logs/ws", handleLogsWS(pm))
		r.Get("/logs", handleLogs(pm))

		// Traffic WebSocket
		r.Get("/traffic/ws", handleTrafficWS(pm))
	})

	// Proxy clash UI requests
	r.Handle("/ui/*", clashUIProxy())

	// Serve web UI
	r.Handle("/*", http.FileServer(http.FS(webFS)))

	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	// FIX: Explicitly ignore Encode error as response writing is the final step
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	// FIX: Explicitly ignore Encode error
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// ... 后续 handle 函数逻辑保持一致，调用 writeJSON 和 writeErr 即可 ...

// ─── Status & Control ────────────────────────────────────────────────────────

func handleStatus(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, errMsg := pm.Status()
		writeJSON(w, map[string]interface{}{
			"status": status,
			"error":  errMsg,
		})
	}
}

func handleStart(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := pm.Start(r.Context()); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, map[string]string{"status": "starting"})
	}
}

func handleStop(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := pm.Stop(r.Context()); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, map[string]string{"status": "stopped"})
	}
}

func handleRestart(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := pm.Restart(r.Context()); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, map[string]string{"status": "restarting"})
	}
}

// ─── Config ──────────────────────────────────────────────────────────────────

func handleGetAppConfig(cfg *config.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, cfg.GetAppConfig())
	}
}

func handleSetAppConfig(cfg *config.Manager, pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var c config.AppConfig
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		if err := cfg.SetAppConfig(c); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, c)
	}
}

func handleGetSingboxConfig(cfg *config.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, cfg.GetSingboxConfig())
	}
}

func handleSetSingboxConfig(cfg *config.Manager, pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var c config.SingboxConfig
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		if err := cfg.SetSingboxConfig(c); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, c)
	}
}

func handleGetDNS(cfg *config.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, cfg.GetSingboxConfig().DNS)
	}
}

func handleSetDNS(cfg *config.Manager, pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var dns config.DNSConfig
		if err := json.NewDecoder(r.Body).Decode(&dns); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		c := cfg.GetSingboxConfig()
		c.DNS = &dns
		if err := cfg.SetSingboxConfig(c); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, dns)
	}
}

func handleGetOutbounds(cfg *config.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, cfg.GetSingboxConfig().Outbounds)
	}
}

func handleSetOutbounds(cfg *config.Manager, pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var outbounds []config.Outbound
		if err := json.NewDecoder(r.Body).Decode(&outbounds); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		c := cfg.GetSingboxConfig()
		c.Outbounds = outbounds
		if err := cfg.SetSingboxConfig(c); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, outbounds)
	}
}

func handleGetRoute(cfg *config.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, cfg.GetSingboxConfig().Route)
	}
}

func handleSetRoute(cfg *config.Manager, pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var route config.RouteConfig
		if err := json.NewDecoder(r.Body).Decode(&route); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		c := cfg.GetSingboxConfig()
		c.Route = &route
		if err := cfg.SetSingboxConfig(c); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, route)
	}
}

func handleGetInbounds(cfg *config.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, cfg.GetSingboxConfig().Inbounds)
	}
}

func handleSetInbounds(cfg *config.Manager, pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var inbounds []config.Inbound
		if err := json.NewDecoder(r.Body).Decode(&inbounds); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		c := cfg.GetSingboxConfig()
		c.Inbounds = inbounds
		if err := cfg.SetSingboxConfig(c); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		writeJSON(w, inbounds)
	}
}

// ─── Subscription ────────────────────────────────────────────────────────────

type SubscribeRequest struct {
	URL  string `json:"url"`
	Name string `json:"name"`
}

func handleSubscribe(cfg *config.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SubscribeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, 400, err.Error())
			return
		}

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(req.URL)
		if err != nil {
			writeErr(w, 502, fmt.Sprintf("fetch subscription: %v", err))
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
		if err != nil {
			writeErr(w, 502, err.Error())
			return
		}

		// Try to parse as sing-box outbounds JSON array
		var outbounds []config.Outbound
		if err := json.Unmarshal(body, &outbounds); err != nil {
			// Try as JSON object with outbounds key
			var obj map[string]json.RawMessage
			if err2 := json.Unmarshal(body, &obj); err2 != nil {
				writeErr(w, 422, "unsupported subscription format (expected sing-box JSON)")
				return
			}
			if raw, ok := obj["outbounds"]; ok {
				if err3 := json.Unmarshal(raw, &outbounds); err3 != nil {
					writeErr(w, 422, "failed to parse outbounds")
					return
				}
			}
		}

		if len(outbounds) == 0 {
			writeErr(w, 422, "no outbounds found in subscription")
			return
		}

		// Merge into existing config: replace proxy outbounds, keep direct/block/dns-out
		c := cfg.GetSingboxConfig()
		existing := []config.Outbound{}
		proxyOutbounds := []string{}

		for _, ob := range c.Outbounds {
			if ob.Tag == "direct" || ob.Tag == "block" || ob.Tag == "dns-out" ||
				ob.Tag == "proxy" || ob.Tag == "auto" {
				existing = append(existing, ob)
			}
		}

		for _, ob := range outbounds {
			if ob.Tag == "direct" || ob.Tag == "block" || ob.Tag == "dns-out" {
				continue
			}
			existing = append(existing, ob)
			proxyOutbounds = append(proxyOutbounds, ob.Tag)
		}

		// Update proxy selector and auto urltest
		for i := range existing {
			if existing[i].Tag == "proxy" || existing[i].Tag == "auto" {
				existing[i].Outbounds = append(proxyOutbounds, "direct")
			}
		}

		c.Outbounds = existing
		if err := cfg.SetSingboxConfig(c); err != nil {
			writeErr(w, 500, err.Error())
			return
		}

		writeJSON(w, map[string]interface{}{
			"imported": len(outbounds),
			"nodes":    proxyOutbounds,
		})
	}
}

// ─── Monitoring ──────────────────────────────────────────────────────────────

func handleConnections(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conns, err := pm.GetConnections()
		if err != nil {
			writeErr(w, 502, err.Error())
			return
		}
		writeJSON(w, map[string]interface{}{"connections": conns})
	}
}

func handleCloseConnection(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if err := pm.CloseConnection(id); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleTraffic(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats, err := pm.GetTraffic()
		if err != nil {
			writeErr(w, 502, err.Error())
			return
		}
		writeJSON(w, stats)
	}
}

func handleProxies(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		proxies, err := pm.GetProxies()
		if err != nil {
			writeErr(w, 502, err.Error())
			return
		}
		writeJSON(w, proxies)
	}
}

func handleSelectProxy(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		group := chi.URLParam(r, "group")
		var body struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		if err := pm.SelectProxy(group, body.Name); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleLogs(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, pm.Logs())
	}
}

func handleLogsWS(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		ch := pm.LogsChan()
		for {
			select {
			case entry := <-ch:
				if err := conn.WriteJSON(entry); err != nil {
					return
				}
			case <-r.Context().Done():
				return
			}
		}
	}
}

func handleTrafficWS(pm *proxy.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				stats, err := pm.GetTraffic()
				if err != nil {
					continue
				}
				if err := conn.WriteJSON(stats); err != nil {
					return
				}
			case <-r.Context().Done():
				return
			}
		}
	}
}

// Proxy clash-dashboard to sing-box clash API
func clashUIProxy() http.Handler {
	target, _ := url.Parse("http://127.0.0.1:9091")
	proxy := httputil.NewSingleHostReverseProxy(target)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/ui")
		proxy.ServeHTTP(w, r)
	})
}
