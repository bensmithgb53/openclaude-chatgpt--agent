#!/usr/bin/env node
/**
 * Local OpenAI-compatible adapter for OpenClaude -> chatgpt-unofficial-api.
 *
 * This is a compatibility layer, not an official OpenAI endpoint. It converts
 * OpenClaude's native tool schemas into prompt instructions and converts strict
 * JSON tool-call replies back into OpenAI tool_calls.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BRIDGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_MODULE = process.env.CHATGPT_CLIENT_MODULE || path.join(BRIDGE_DIR, 'chatgpt-unofficial-api/client/index.mjs');
const { ChatGPT } = await import(pathToFileURL(CLIENT_MODULE).href);

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.OPENAI_MODEL || 'chatgpt-unofficial';
const BRIDGE_KEY = process.env.BRIDGE_API_KEY || '';
const COOKIES_FILE = process.env.CHATGPT_COOKIES_FILE || undefined;
const MAX_BODY = 20 * 1024 * 1024;

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function authorized(req) {
  if (!BRIDGE_KEY) return true;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${BRIDGE_KEY}`;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(part => {
    if (typeof part === 'string') return part;
    if (part?.type === 'text') return part.text || '';
    return `[${part?.type || 'content'}]`;
  }).join('');
  return content == null ? '' : JSON.stringify(content);
}

function describeTools(tools = []) {
  return tools.map((tool, i) => {
    const fn = tool.function || tool;
    return `${i + 1}. ${fn.name}\nDescription: ${fn.description || '(none)'}\nParameters JSON Schema: ${JSON.stringify(fn.parameters || {})}`;
  }).join('\n\n');
}

function buildPrompt(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const tools = Array.isArray(body.tools) ? body.tools : [];
  const lines = [];
  lines.push('You are the model inside a terminal coding agent. Follow the conversation below.');
  lines.push('When tools are available, you MUST choose one of these two response formats:');
  lines.push('1) To call a tool, output ONLY valid JSON: {"tool_call":{"name":"tool_name","arguments":{...}}}');
  lines.push('2) To answer normally, output ordinary text.');
  lines.push('Never invent a tool name. Arguments must be valid JSON matching the schema. Do not wrap the tool JSON in Markdown fences.');
  if (tools.length) {
    lines.push('\nAVAILABLE TOOLS:\n' + describeTools(tools));
  }
  lines.push('\nCONVERSATION:');
  for (const m of messages) {
    const role = m.role || 'user';
    if (role === 'tool') {
      lines.push(`TOOL RESULT (${m.tool_call_id || 'unknown'}):\n${textOf(m.content)}`);
    } else if (role === 'assistant' && Array.isArray(m.tool_calls)) {
      for (const call of m.tool_calls) {
        const fn = call.function || {};
        lines.push(`ASSISTANT TOOL CALL: ${fn.name}(${fn.arguments || '{}'})`);
      }
      if (m.content) lines.push(`ASSISTANT: ${textOf(m.content)}`);
    } else {
      lines.push(`${role.toUpperCase()}:\n${textOf(m.content)}`);
    }
  }
  lines.push('\nNow produce the next assistant response.');
  return lines.join('\n');
}

function parseToolCall(raw) {
  const candidates = [raw.trim()];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const call = parsed.tool_call || parsed.toolCall;
      if (call?.name) {
        let args = call.arguments ?? {};
        if (typeof args === 'string') args = JSON.parse(args);
        return { name: call.name, arguments: args };
      }
    } catch {}
  }
  return null;
}

function completion(body, raw) {
  const tool = parseToolCall(raw);
  const id = `chatcmpl-${randomUUID()}`;
  const message = tool ? {
    role: 'assistant',
    content: null,
    tool_calls: [{ id: `call_${randomUUID().replaceAll('-', '').slice(0, 24)}`, type: 'function', function: { name: tool.name, arguments: JSON.stringify(tool.arguments) } }],
  } : { role: 'assistant', content: raw };
  return {
    id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: body.model || MODEL,
    choices: [{ index: 0, message, finish_reason: tool ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function ask(body) {
  const client = new ChatGPT({ cookiesFile: COOKIES_FILE });
  await client.init();
  return client.ask(buildPrompt(body), { model: body.model === MODEL ? undefined : body.model });
}

async function handleCompletion(req, res) {
  const body = await readBody(req);
  if (!Array.isArray(body.messages)) return json(res, 400, { error: { message: 'messages must be an array', type: 'invalid_request_error' } });
  const raw = await ask(body);
  const result = completion(body, raw || '');
  if (!body.stream) return json(res, 200, result);

  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  const choice = result.choices[0];
  const first = { id: result.id, object: 'chat.completion.chunk', created: result.created, model: result.model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] };
  res.write(`data: ${JSON.stringify(first)}\n\n`);
  const delta = choice.message.tool_calls ? { tool_calls: choice.message.tool_calls } : { content: choice.message.content };
  const second = { id: result.id, object: 'chat.completion.chunk', created: result.created, model: result.model, choices: [{ index: 0, delta, finish_reason: choice.finish_reason }] };
  res.write(`data: ${JSON.stringify(second)}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) return json(res, 401, { error: { message: 'Unauthorized', type: 'authentication_error' } });
    if (req.method === 'GET' && req.url === '/v1/models') {
      return json(res, 200, { object: 'list', data: [{ id: MODEL, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'chatgpt-unofficial' }] });
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') return await handleCompletion(req, res);
    return json(res, 404, { error: { message: 'Not found', type: 'invalid_request_error' } });
  } catch (error) {
    console.error(error.stack || error);
    if (!res.headersSent) json(res, 502, { error: { message: error.message, type: 'upstream_error' } });
    else res.end();
  }
});

server.listen(PORT, HOST, () => console.log(`chatgpt-openclaude-bridge listening on http://${HOST}:${PORT}/v1`));

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));

export { buildPrompt, parseToolCall, completion };
