#!/bin/bash
# install.sh - SingBox Manager quick install script
# Usage: curl -fsSL https://raw.githubusercontent.com/yourusername/singbox-manager/main/install.sh | bash

set -e

REPO="yourusername/singbox-manager"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/singbox-manager"
DATA_DIR="/var/lib/singbox-manager"
SERVICE_FILE="/etc/systemd/system/singbox-manager.service"

# Detect architecture
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case $ARCH in
  x86_64)   GOARCH="amd64" ;;
  aarch64)  GOARCH="arm64" ;;
  armv7l)   GOARCH="armv7" ;;
  i686|i386) GOARCH="386" ;;
  mips*)    GOARCH="mipsle_softfloat" ;;
  *)        echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

BINARY_NAME="singbox-manager-${OS}-${GOARCH}"

# Get latest release
echo "Fetching latest release..."
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')

if [ -z "$LATEST" ]; then
  echo "Failed to get latest version"
  exit 1
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY_NAME}"

echo "Installing singbox-manager ${LATEST} for ${OS}/${GOARCH}..."

# Download
TMP=$(mktemp)
curl -fsSL "$DOWNLOAD_URL" -o "$TMP"
chmod +x "$TMP"
mv "$TMP" "${INSTALL_DIR}/singbox-manager"

echo "Binary installed to ${INSTALL_DIR}/singbox-manager"

# Create directories
mkdir -p "$CONFIG_DIR" "$DATA_DIR"

# Install sing-box if not present
if ! command -v sing-box &>/dev/null; then
  echo ""
  echo "sing-box not found. Installing sing-box..."
  SINGBOX_VERSION="1.12.0"
  case $ARCH in
    x86_64)  SB_ARCH="amd64" ;;
    aarch64) SB_ARCH="arm64" ;;
    armv7l)  SB_ARCH="armv7" ;;
    *)       SB_ARCH=$ARCH ;;
  esac
  SB_URL="https://github.com/SagerNet/sing-box/releases/download/v${SINGBOX_VERSION}/sing-box-${SINGBOX_VERSION}-linux-${SB_ARCH}.tar.gz"
  TMP_DIR=$(mktemp -d)
  curl -fsSL "$SB_URL" | tar -xz -C "$TMP_DIR"
  mv "${TMP_DIR}/sing-box-${SINGBOX_VERSION}-linux-${SB_ARCH}/sing-box" "${INSTALL_DIR}/sing-box"
  rm -rf "$TMP_DIR"
  echo "sing-box installed to ${INSTALL_DIR}/sing-box"
fi

# Create systemd service
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=SingBox Manager
Documentation=https://github.com/${REPO}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/singbox-manager --listen 0.0.0.0:9090 --config-dir ${CONFIG_DIR}
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5s
LimitNOFILE=524288
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable singbox-manager

echo ""
echo "✓ Installation complete!"
echo ""
echo "  Start:   systemctl start singbox-manager"
echo "  Status:  systemctl status singbox-manager"
echo "  Web UI:  http://$(hostname -I | awk '{print $1}'):9090"
echo ""
echo "Note: Run as root is required for TUN/tproxy/nftables."
