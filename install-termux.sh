#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="${HOME}/ai-tools"
BRIDGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for command_name in git node npm npx; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    echo "Run: pkg install nodejs-lts git" >&2
    exit 1
  fi
done

mkdir -p "$ROOT"
cd "$ROOT"

if [ ! -d openclaude/.git ]; then
  git clone https://github.com/Gitlawb/openclaude.git openclaude
fi
if [ ! -d "$BRIDGE_DIR/chatgpt-unofficial-api/.git" ]; then
  git clone https://github.com/etrnkz/chatgpt-unofficial-api.git "$BRIDGE_DIR/chatgpt-unofficial-api"
fi

if [ "$(uname -o 2>/dev/null || true)" = "Android" ] || [ -n "$(getprop ro.build.version.release 2>/dev/null || true)" ]; then
  cat >&2 <<'EOF'
Android detected. OpenClaude's Bun build cannot run directly on Android.
The upstream-supported route is to build OpenClaude inside Ubuntu via proot-distro.

Run these commands in Termux, then rerun only the build commands inside Ubuntu:

  pkg install proot-distro
  proot-distro install ubuntu
  proot-distro login ubuntu
  apt update && apt install -y curl unzip git
  curl -fsSL https://bun.sh/install | bash
  source ~/.bashrc
  cd /data/data/com.termux/files/home/ai-tools/openclaude
  bun install
  bun run build

Then exit Ubuntu and start the bridge from Termux:

  cd ~/ai-tools/openclaude-chatgpt--agent
  node chatgpt-openclaude-bridge.mjs
EOF
  exit 2
fi

cd "$ROOT/openclaude"
npm install
npx --yes bun@1.3.13 run build

cat <<EOF

Installed and built OpenClaude.

Start the bridge in this session:
  cd "$BRIDGE_DIR"
  node "$BRIDGE_DIR/chatgpt-openclaude-bridge.mjs"

In a second Termux session, run OpenClaude from your project:
  cd ~/projects/my-project
  export CLAUDE_CODE_USE_OPENAI=1
  export OPENAI_API_KEY=local-bridge
  export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
  export OPENAI_MODEL=chatgpt-unofficial
  node "$ROOT/openclaude/dist/cli.mjs"
EOF
