package proxy

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/yourusername/singbox-manager/internal/config"
	"github.com/yourusername/singbox-manager/internal/system"
)

type Status string

const (
	StatusStopped  Status = "stopped"
	StatusStarting Status = "starting"
	StatusRunning  Status = "running"
	StatusStopping Status = "stopping"
	StatusError    Status = "error"
)

type LogEntry struct {
	Time    time.Time `json:"time"`
	Level   string    `json:"level"`
	Message string    `json:"message"`
}

type Manager struct {
	singboxBin string
	cfg        *config.Manager
	mu         sync.RWMutex
	status     Status
	cmd        *exec.Cmd
	logs       []LogEntry
	logsCh     chan LogEntry
	errMsg     string
}

func NewManager(singboxBin string, cfg *config.Manager) (*Manager, error) {
	return &Manager{
		singboxBin: singboxBin,
		cfg:        cfg,
		status:     StatusStopped,
		logsCh:     make(chan LogEntry, 256),
	}, nil
}

func (m *Manager) Status() (Status, string) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status, m.errMsg
}

func (m *Manager) Logs() []LogEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]LogEntry, len(m.logs))
	copy(out, m.logs)
	return out
}

func (m *Manager) LogsChan() <-chan LogEntry {
	return m.logsCh
}

func (m *Manager) Start(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.status == StatusRunning || m.status == StatusStarting {
		return fmt.Errorf("already running")
	}

	m.setStatus(StatusStarting, "")

	appCfg := m.cfg.GetAppConfig()

	// Apply nftables/iptables rules
	if err := system.ApplyRules(appCfg); err != nil {
		m.setStatus(StatusError, err.Error())
		return fmt.Errorf("apply rules: %w", err)
	}

	cmd := exec.CommandContext(ctx, m.singboxBin, "run", "-c", m.cfg.SingboxConfigPath())
	cmd.Env = os.Environ()

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		system.CleanupRules(appCfg)
		m.setStatus(StatusError, err.Error())
		return fmt.Errorf("start singbox: %w", err)
	}

	m.cmd = cmd
	m.setStatus(StatusRunning, "")

	// Stream logs
	go m.streamLogs(stdout, "stdout")
	go m.streamLogs(stderr, "stderr")

	// Watch process
	go func() {
		err := cmd.Wait()
		m.mu.Lock()
		defer m.mu.Unlock()
		system.CleanupRules(m.cfg.GetAppConfig())
		if m.status == StatusStopping {
			m.setStatus(StatusStopped, "")
		} else {
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			m.setStatus(StatusError, msg)
		}
	}()

	return nil
}

func (m *Manager) Stop(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.status != StatusRunning {
		return fmt.Errorf("not running")
	}

	m.setStatus(StatusStopping, "")
	if m.cmd != nil && m.cmd.Process != nil {
		m.cmd.Process.Signal(os.Interrupt)
		done := make(chan struct{})
		go func() {
			m.cmd.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			m.cmd.Process.Kill()
		}
	}
	system.CleanupRules(m.cfg.GetAppConfig())
	m.setStatus(StatusStopped, "")
	return nil
}

func (m *Manager) Restart(ctx context.Context) error {
	m.Stop(ctx)
	time.Sleep(500 * time.Millisecond)
	return m.Start(ctx)
}

func (m *Manager) setStatus(s Status, errMsg string) {
	m.status = s
	m.errMsg = errMsg
}

func (m *Manager) streamLogs(r io.Reader, _ string) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		entry := parseLogLine(line)
		m.mu.Lock()
		if len(m.logs) > 2000 {
			m.logs = m.logs[500:]
		}
		m.logs = append(m.logs, entry)
		m.mu.Unlock()
		select {
		case m.logsCh <- entry:
		default:
		}
	}
}

func parseLogLine(line string) LogEntry {
	entry := LogEntry{
		Time:    time.Now(),
		Level:   "info",
		Message: line,
	}
	lower := strings.ToLower(line)
	if strings.Contains(lower, " erro") || strings.Contains(lower, "error") {
		entry.Level = "error"
	} else if strings.Contains(lower, " warn") {
		entry.Level = "warn"
	} else if strings.Contains(lower, " debu") || strings.Contains(lower, "debug") {
		entry.Level = "debug"
	}
	return entry
}

// Proxy connection info from clash API
type Connection struct {
	ID          string            `json:"id"`
	Metadata    ConnectionMeta    `json:"metadata"`
	Upload      int64             `json:"upload"`
	Download    int64             `json:"download"`
	Start       time.Time         `json:"start"`
	Chain       []string          `json:"chains"`
	Rule        string            `json:"rule"`
	RulePayload string            `json:"rulePayload"`
}

type ConnectionMeta struct {
	Network    string `json:"network"`
	Type       string `json:"type"`
	SrcIP      string `json:"sourceIP"`
	DstIP      string `json:"destinationIP"`
	SrcPort    string `json:"sourcePort"`
	DstPort    string `json:"destinationPort"`
	Host       string `json:"host"`
	DNSMode    string `json:"dnsMode"`
	InboundIP  string `json:"inboundIp"`
	InboundPort string `json:"inboundPort"`
}

type TrafficStats struct {
	Up   int64 `json:"up"`
	Down int64 `json:"down"`
}

func (m *Manager) GetConnections() ([]Connection, error) {
	resp, err := http.Get("http://127.0.0.1:9091/connections")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		Connections []Connection `json:"connections"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Connections, nil
}

func (m *Manager) GetTraffic() (*TrafficStats, error) {
	resp, err := http.Get("http://127.0.0.1:9091/traffic")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var stats TrafficStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

func (m *Manager) GetProxies() (map[string]interface{}, error) {
	resp, err := http.Get("http://127.0.0.1:9091/proxies")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (m *Manager) SelectProxy(group, proxy string) error {
	req, err := http.NewRequest("PUT",
		fmt.Sprintf("http://127.0.0.1:9091/proxies/%s", group),
		strings.NewReader(fmt.Sprintf(`{"name":"%s"}`, proxy)),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (m *Manager) CloseConnection(id string) error {
	req, err := http.NewRequest("DELETE",
		fmt.Sprintf("http://127.0.0.1:9091/connections/%s", id), nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
