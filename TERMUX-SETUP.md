# OpenClaude + ChatGPT Unofficial Bridge for Termux

This package connects **OpenClaude** to the `chatgpt-unofficial-api` client through a local OpenAI-compatible adapter. OpenClaude provides the coding-agent tools; the adapter translates its requests to the unofficial ChatGPT client.

## What was tested

The following passed in a clean Linux environment:

- Node.js 22.13.0.
- OpenClaude v0.31.0 build and smoke check.
- Anonymous ChatGPT request through the bridge.
- Native OpenClaude `Read` tool call through the bridge.
- The agent read a local file and returned `BRIDGE_FILE_TEST_OK`.

This does not guarantee that ChatGPT's website endpoint will remain compatible. It is an unofficial, reverse-engineered interface and can be rate-limited, blocked, or changed without notice.

## Install on Termux

Install Termux from F-Droid rather than the Play Store, then run:

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git ripgrep
mkdir -p ~/ai-tools
cd ~/ai-tools
git clone https://github.com/Gitlawb/openclaude.git openclaude
git clone https://github.com/etrnkz/chatgpt-unofficial-api.git chatgpt-unofficial-api
```

Copy `chatgpt-openclaude-bridge.mjs` from this package into `~/ai-tools/`.

Install and build OpenClaude:

```bash
cd ~/ai-tools/openclaude
npm install
npx --yes bun@1.3.13 run build
```

The `npx bun` command avoids requiring a native Bun installation in Termux.

## Start it

In one Termux session, start the local adapter:

```bash
cd ~/ai-tools
export CHATGPT_COOKIES_FILE="$HOME/ai-tools/chatgpt-unofficial-api/client/cookies.json"
node chatgpt-openclaude-bridge.mjs
```

Cookies are optional for ordinary text chat. If you use a cookies file, copy it into the client directory and protect it:

```bash
chmod 600 ~/ai-tools/chatgpt-unofficial-api/client/cookies.json
```

Do not commit, upload, or share that file. It is equivalent to an account credential.

Open a second Termux session, enter the project you want the agent to edit, and run:

```bash
cd ~/projects/my-project
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=local-bridge
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
export OPENAI_MODEL=chatgpt-unofficial
node ~/ai-tools/openclaude/dist/cli.mjs
```

Then ask for a task such as:

```text
Inspect the project, find the failing tests, fix the code, run the tests, and show me the final diff. Do not delete files or publish anything.
```

For a one-shot non-interactive run, use stdin:

```bash
printf '%s\n' 'Read the project tests, fix the failing code, run the tests, and report the result.' \
  | node ~/ai-tools/openclaude/dist/cli.mjs --print
```

## Keep the agent scoped

Always launch OpenClaude from the project directory, not from your entire home directory. Start with normal permissions. Only use a permissive mode when you understand the consequences.

Before allowing an agent to operate on a real project, make a Git checkpoint:

```bash
git add -A && git commit -m 'checkpoint before AI changes'
```

Review the diff afterward:

```bash
git diff
```

Do not let it run commands such as `rm -rf`, `git reset --hard`, `git push`, `npm publish`, or deployment commands unless you have reviewed the exact command and intend to run it.

## Troubleshooting

If OpenClaude says that the model or provider is missing, verify that the bridge is still running and test it with:

```bash
curl http://127.0.0.1:8787/v1/models
```

If ChatGPT reports unusual activity, Cloudflare errors, or proof-of-work failures, the unofficial client has been blocked or changed. There is no reliable local fix for that; use an official OpenAI-compatible provider or a local Ollama model instead.

If the model returns ordinary text instead of a tool call, OpenClaude may not be able to continue an agent workflow. The bridge uses strict JSON instructions to reduce this problem, but this is inherently less reliable than a provider with native function/tool calling.
