# OpenClaude ChatGPT Unofficial Bridge

This repository provides a small compatibility bridge between [OpenClaude](https://github.com/Gitlawb/openclaude) and the [ChatGPT unofficial Node.js client](https://github.com/etrnkz/chatgpt-unofficial-api).

OpenClaude supplies the coding-agent behavior: file reading, editing, shell commands, tests, sessions, and tool orchestration. The bridge exposes a local OpenAI-compatible endpoint, translates OpenClaude tool definitions into strict JSON instructions, sends the request through the unofficial ChatGPT client, and converts JSON tool responses back into OpenAI `tool_calls`.

> This is not an official OpenAI or ChatGPT API. ChatGPT website changes, anti-bot checks, rate limits, or upstream client changes can stop it working without notice.

## Requirements

Use Termux from F-Droid. Node.js and npm must be installed **before** running the installer. GitHub CLI is needed because this repository is private.

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git ripgrep gh
```

Verify the prerequisites:

```bash
node --version
npm --version
git --version
gh --version
```

## Install on a phone

Authenticate GitHub in Termux:

```bash
gh auth login
```

Choose GitHub.com, HTTPS, and web-browser authentication. Then clone this repository:

```bash
mkdir -p ~/ai-tools
gh repo clone bensmithgb53/openclaude-chatgpt--agent \
  ~/ai-tools/openclaude-chatgpt--agent
cd ~/ai-tools/openclaude-chatgpt--agent
bash install-termux.sh
```

The installer clones and builds the upstream projects automatically:

- [OpenClaude](https://github.com/Gitlawb/openclaude)
- [ChatGPT unofficial client](https://github.com/etrnkz/chatgpt-unofficial-api)

## Run the bridge

In the first Termux session:

```bash
cd ~/ai-tools/openclaude-chatgpt--agent
node chatgpt-openclaude-bridge.mjs
```

Test that the local endpoint is alive from another Termux session:

```bash
curl http://127.0.0.1:8787/v1/models
```

The response should list the `chatgpt-unofficial` model.

## Run the coding agent

In a second Termux session, start OpenClaude from the project directory you want it to edit:

```bash
cd ~/projects/my-project
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=local-bridge
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
export OPENAI_MODEL=chatgpt-unofficial
node ~/ai-tools/openclaude/dist/cli.mjs
```

Example request:

```text
Inspect this project, find the failing tests, fix the code, run the tests, and show me the final diff. Do not delete files or publish anything.
```

Before allowing edits to a real project, create a checkpoint:

```bash
git add -A && git commit -m "checkpoint before AI changes"
```

## Cookies

Cookies are optional for ordinary text chat. If you use a cookies file, store it only locally at:

```text
~/ai-tools/openclaude-chatgpt--agent/chatgpt-unofficial-api/client/cookies.json
```

Protect it with:

```bash
chmod 600 ~/ai-tools/openclaude-chatgpt--agent/chatgpt-unofficial-api/client/cookies.json
```

Never commit, upload, or share the file. It is equivalent to an account credential.

## Updating

Update this bridge repository:

```bash
cd ~/ai-tools/openclaude-chatgpt--agent
git pull
```

Update OpenClaude and rebuild it:

```bash
cd ~/ai-tools/openclaude
git pull
npx --yes bun@1.3.13 run build
```

Update the unofficial client:

```bash
cd ~/ai-tools/openclaude-chatgpt--agent/chatgpt-unofficial-api
git pull
```

Updates can require bridge changes if upstream request, response, or tool-call formats change.

## Troubleshooting

If you see `npm: command not found` or `node is not installed`, install Node before rerunning the installer:

```bash
pkg install nodejs-lts
cd ~/ai-tools/openclaude-chatgpt--agent
bash install-termux.sh
```

If you see `gh is not installed`, run:

```bash
pkg install gh
gh auth login
```

If ChatGPT reports unusual activity, Cloudflare errors, proof-of-work failures, or rate limiting, the unofficial client or the website endpoint has changed or blocked the request. In that case, use an official OpenAI-compatible provider or Ollama instead.

## License and attribution

The bridge in this repository is MIT-licensed. OpenClaude and the ChatGPT unofficial client remain separate upstream projects with their own licenses and maintainers.
