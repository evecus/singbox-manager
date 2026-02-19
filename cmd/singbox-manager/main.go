package main

import (
	"context"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/yourusername/singbox-manager/internal/api"
	"github.com/yourusername/singbox-manager/internal/config"
	"github.com/yourusername/singbox-manager/internal/proxy"
)

// webFS is provided by embed_prod.go (normal build) or embed_stub.go (-tags noembed).

var (
	listenAddr = flag.String("listen", "0.0.0.0:9090", "Web UI listen address")
	configDir  = flag.String("config-dir", "/etc/singbox-manager", "Config directory")
	singboxBin = flag.String("singbox", "/usr/local/bin/sing-box", "sing-box binary path")
	version    = "dev"
)

func main() {
	flag.Parse()

	if len(os.Args) > 1 && os.Args[1] == "version" {
		fmt.Printf("singbox-manager %s\n", version)
		return
	}

	if os.Geteuid() != 0 {
		log.Fatal("singbox-manager must run as root (required for nftables/iptables and TUN)")
	}

	cfg, err := config.NewManager(*configDir)
	if err != nil {
		log.Fatalf("Failed to init config manager: %v", err)
	}

	proxyMgr, err := proxy.NewManager(*singboxBin, cfg)
	if err != nil {
		log.Fatalf("Failed to init proxy manager: %v", err)
	}

	// In the production build webFS is an embed.FS rooted at the repo root,
	// so we sub into web/dist. In the stub build webFS is already flat.
	var uiFS fs.FS
	if sub, err := fs.Sub(webFS, "web/dist"); err == nil {
		uiFS = sub
	} else {
		uiFS = webFS
	}

	router := api.NewRouter(cfg, proxyMgr, uiFS)

	srv := &http.Server{
		Addr:    *listenAddr,
		Handler: router,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		_ = proxyMgr.Stop(ctx)
		srv.Shutdown(ctx) //nolint:errcheck
		cancel()
	}()

	log.Printf("singbox-manager %s listening on http://%s", version, *listenAddr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
