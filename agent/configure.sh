#!/usr/bin/env bash
set -euo pipefail
# Re-running the installer updates code and endpoint/token atomically at service restart.
agent_source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$agent_source_dir/install.sh" "$@"
