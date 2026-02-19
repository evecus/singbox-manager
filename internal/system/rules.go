package system

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/yourusername/singbox-manager/internal/config"
)

const (
	nftTableName = "singbox"
	ipRouteTable = 100
	ipRuleMark   = 1
)

func ApplyRules(cfg config.AppConfig) error {
	// Detect nftables or fallback to iptables
	if hasNftables() {
		return applyNftables(cfg)
	}
	return applyIptables(cfg)
}

func CleanupRules(cfg config.AppConfig) {
	if hasNftables() {
		cleanupNftables()
	} else {
		cleanupIptables(cfg)
	}
}

func hasNftables() bool {
	return exec.Command("nft", "-v").Run() == nil
}

// ─── nftables ──────────────────────────────────────────────────────────────

func applyNftables(cfg config.AppConfig) error {
	switch cfg.ProxyMode {
	case "tun":
		return applyNftablesTun(cfg)
	case "tproxy":
		return applyNftablesTproxy(cfg)
	case "redir":
		return applyNftablesRedir(cfg)
	}
	return nil
}

func applyNftablesTun(cfg config.AppConfig) error {
	// TUN mode: sing-box handles routing internally via auto_route + auto_redirect
	// We only need basic mark rules to prevent loopback
	rules := fmt.Sprintf(`
table inet %s {
  chain prerouting {
    type filter hook prerouting priority mangle; policy accept;
    iifname "tun0" accept
    meta mark %d accept
  }
  chain output {
    type route hook output priority mangle; policy accept;
    meta mark %d accept
    # mark traffic from singbox process to avoid loop
    meta skgid 0 meta skuid 0 return
  }
}
`, nftTableName, ipRuleMark, ipRuleMark)

	return runNft(rules)
}

func applyNftablesTproxy(cfg config.AppConfig) error {
	tproxyPort := cfg.TproxyPort

	// Private/reserved IP ranges to bypass
	bypass := privateRanges()

	rules := fmt.Sprintf(`
table inet %s {
  set bypass_ipv4 {
    type ipv4_addr
    flags interval
    elements = { %s }
  }

  chain prerouting {
    type filter hook prerouting priority mangle; policy accept;

    # Skip already marked
    meta mark %d accept

    # Skip local/private
    ip daddr @bypass_ipv4 accept

    # TCP tproxy
    meta l4proto tcp tproxy ip to 127.0.0.1:%d meta mark set %d accept
    # UDP tproxy
    meta l4proto udp tproxy ip to 127.0.0.1:%d meta mark set %d accept
  }

  chain output {
    type route hook output priority mangle; policy accept;

    meta mark %d accept

    ip daddr @bypass_ipv4 accept

    meta l4proto { tcp, udp } meta mark set %d accept
  }
}
`, nftTableName, bypass, ipRuleMark,
		tproxyPort, ipRuleMark,
		tproxyPort, ipRuleMark,
		ipRuleMark, ipRuleMark)

	if err := runNft(rules); err != nil {
		return err
	}

	// ip rule for tproxy
	runCmd("ip", "rule", "add", "fwmark", fmt.Sprintf("%d", ipRuleMark),
		"table", fmt.Sprintf("%d", ipRouteTable))
	runCmd("ip", "route", "add", "local", "default", "dev", "lo",
		"table", fmt.Sprintf("%d", ipRouteTable))

	if cfg.LanProxy {
		// Also apply to forwarded traffic
		return applyNftablesLanForward(cfg)
	}
	return nil
}

func applyNftablesRedir(cfg config.AppConfig) error {
	redirPort := cfg.RedirPort
	bypass := privateRanges()

	rules := fmt.Sprintf(`
table ip %s {
  set bypass_ipv4 {
    type ipv4_addr
    flags interval
    elements = { %s }
  }

  chain prerouting {
    type nat hook prerouting priority dstnat; policy accept;
    ip daddr @bypass_ipv4 accept
    meta l4proto tcp redirect to :%d
  }

  chain output {
    type nat hook output priority -100; policy accept;
    ip daddr @bypass_ipv4 accept
    meta skuid 0 accept
    meta l4proto tcp redirect to :%d
  }
}
`, nftTableName, bypass, redirPort, redirPort)

	return runNft(rules)
}

func applyNftablesLanForward(cfg config.AppConfig) error {
	rules := fmt.Sprintf(`
table inet %s_lan {
  chain forward {
    type filter hook forward priority mangle; policy accept;
    meta l4proto { tcp, udp } meta mark set %d accept
  }
}
`, nftTableName, ipRuleMark)
	return runNft(rules)
}

func cleanupNftables() {
	exec.Command("nft", "delete", "table", "inet", nftTableName).Run()
	exec.Command("nft", "delete", "table", "ip", nftTableName).Run()
	exec.Command("nft", "delete", "table", "inet", nftTableName+"_lan").Run()
	exec.Command("ip", "rule", "del", "fwmark", fmt.Sprintf("%d", ipRuleMark),
		"table", fmt.Sprintf("%d", ipRouteTable)).Run()
	exec.Command("ip", "route", "del", "local", "default", "dev", "lo",
		"table", fmt.Sprintf("%d", ipRouteTable)).Run()
}

func runNft(rules string) error {
	cmd := exec.Command("nft", "-f", "-")
	cmd.Stdin = strings.NewReader(rules)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("nft error: %w\n%s", err, out)
	}
	return nil
}

// ─── iptables fallback ──────────────────────────────────────────────────────

func applyIptables(cfg config.AppConfig) error {
	switch cfg.ProxyMode {
	case "tproxy":
		return applyIptablesTproxy(cfg)
	case "redir":
		return applyIptablesRedir(cfg)
	case "tun":
		// TUN: nothing needed, handled by sing-box
		return nil
	}
	return nil
}

func applyIptablesTproxy(cfg config.AppConfig) error {
	port := cfg.TproxyPort

	// Create SINGBOX chain
	runCmd("iptables", "-t", "mangle", "-N", "SINGBOX")
	runCmd("ip6tables", "-t", "mangle", "-N", "SINGBOX")

	for _, cidr := range privateCIDRs() {
		runCmd("iptables", "-t", "mangle", "-A", "SINGBOX", "-d", cidr, "-j", "RETURN")
	}

	runCmd("iptables", "-t", "mangle", "-A", "SINGBOX",
		"-p", "tcp", "-j", "TPROXY",
		"--on-port", fmt.Sprintf("%d", port),
		"--tproxy-mark", fmt.Sprintf("%d", ipRuleMark))
	runCmd("iptables", "-t", "mangle", "-A", "SINGBOX",
		"-p", "udp", "-j", "TPROXY",
		"--on-port", fmt.Sprintf("%d", port),
		"--tproxy-mark", fmt.Sprintf("%d", ipRuleMark))

	runCmd("iptables", "-t", "mangle", "-A", "PREROUTING", "-j", "SINGBOX")

	// OUTPUT chain for local traffic
	runCmd("iptables", "-t", "mangle", "-N", "SINGBOX_LOCAL")
	for _, cidr := range privateCIDRs() {
		runCmd("iptables", "-t", "mangle", "-A", "SINGBOX_LOCAL", "-d", cidr, "-j", "RETURN")
	}
	runCmd("iptables", "-t", "mangle", "-A", "SINGBOX_LOCAL",
		"-j", "MARK", "--set-mark", fmt.Sprintf("%d", ipRuleMark))
	runCmd("iptables", "-t", "mangle", "-A", "OUTPUT", "-j", "SINGBOX_LOCAL")

	// ip rule
	runCmd("ip", "rule", "add", "fwmark", fmt.Sprintf("%d", ipRuleMark),
		"table", fmt.Sprintf("%d", ipRouteTable))
	runCmd("ip", "route", "add", "local", "default", "dev", "lo",
		"table", fmt.Sprintf("%d", ipRouteTable))

	return nil
}

func applyIptablesRedir(cfg config.AppConfig) error {
	port := cfg.RedirPort

	runCmd("iptables", "-t", "nat", "-N", "SINGBOX")
	for _, cidr := range privateCIDRs() {
		runCmd("iptables", "-t", "nat", "-A", "SINGBOX", "-d", cidr, "-j", "RETURN")
	}
	runCmd("iptables", "-t", "nat", "-A", "SINGBOX",
		"-p", "tcp", "-j", "REDIRECT", "--to-ports", fmt.Sprintf("%d", port))
	runCmd("iptables", "-t", "nat", "-A", "PREROUTING", "-j", "SINGBOX")
	runCmd("iptables", "-t", "nat", "-A", "OUTPUT",
		"-m", "owner", "!", "--uid-owner", "root",
		"-j", "SINGBOX")

	return nil
}

func cleanupIptables(cfg config.AppConfig) {
	runCmd("iptables", "-t", "mangle", "-D", "PREROUTING", "-j", "SINGBOX")
	runCmd("iptables", "-t", "mangle", "-F", "SINGBOX")
	runCmd("iptables", "-t", "mangle", "-X", "SINGBOX")
	runCmd("iptables", "-t", "mangle", "-D", "OUTPUT", "-j", "SINGBOX_LOCAL")
	runCmd("iptables", "-t", "mangle", "-F", "SINGBOX_LOCAL")
	runCmd("iptables", "-t", "mangle", "-X", "SINGBOX_LOCAL")
	runCmd("iptables", "-t", "nat", "-D", "PREROUTING", "-j", "SINGBOX")
	runCmd("iptables", "-t", "nat", "-D", "OUTPUT", "-j", "SINGBOX")
	runCmd("iptables", "-t", "nat", "-F", "SINGBOX")
	runCmd("iptables", "-t", "nat", "-X", "SINGBOX")
	runCmd("ip", "rule", "del", "fwmark", fmt.Sprintf("%d", ipRuleMark),
		"table", fmt.Sprintf("%d", ipRouteTable))
	runCmd("ip", "route", "del", "local", "default", "dev", "lo",
		"table", fmt.Sprintf("%d", ipRouteTable))
}

// ─── helpers ────────────────────────────────────────────────────────────────

func runCmd(name string, args ...string) {
	exec.Command(name, args...).Run()
}

func privateCIDRs() []string {
	return []string{
		"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10",
		"127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
		"192.0.0.0/24", "192.168.0.0/16", "198.18.0.0/15",
		"198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4",
		"240.0.0.0/4", "255.255.255.255/32",
	}
}

func privateRanges() string {
	return strings.Join(privateCIDRs(), ", ")
}
