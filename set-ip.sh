#!/usr/bin/env bash
# Kept for compatibility: detects the LAN IP and updates WEBRTC_IP in .env.
# The mobile app no longer needs its API url synced: in development it follows Metro's address.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/dev-setup.sh" --ip-only
