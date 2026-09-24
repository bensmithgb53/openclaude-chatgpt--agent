#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="${HOME}/ai-tools"
mkdir -p "$ROOT"
cd "$ROOT"

if [ ! -d openclaude/.git ]; then
  git clone https://github.com/Gitlawb/openclaude.git openclaude
fi
if [ ! -d chatgpt-unofficial-api/.git ]; then
  git clone https://github.com/etrnkz/chatgpt-unofficial-api.git chatgpt-unofficial-api
fi

cd "$ROOT/openclaude"
npm install
npx --yes bun@1.3.13 run build

cat <<EOF

Installed and built OpenClaude.

Start the bridge in this session:
  cd "$ROOT"
  node chatgpt-openclaude-bridge.mjs

In a second Termux session, run OpenClaude from your project:
  cd ~/projects/my-project
  export CLAUDE_CODE_USE_OPENAI=1
  export OPENAI_API_KEY=local-bridge
  export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
  export OPENAI_MODEL=chatgpt-unofficial
  node "$ROOT/openclaude/dist/cli.mjs"
EOF
