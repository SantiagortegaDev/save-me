// Minimal stateless MCP (Streamable HTTP transport, JSON responses) — https://modelcontextprotocol.io/specification
import type { Permission } from '../../src/shared/sync';
import { InputError, type Db } from './store';
import { describeTools, toolsFor } from './tools';

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const SERVER_INFO = { name: 'saveme', title: 'SaveMe', version: '1.0.0' };

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };
type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

export type McpContext = { db: Db; permission: Permission; newId: () => string; transaction: <T>(fn: () => T) => T };

function instructions(permission: Permission) {
  const base =
    'SaveMe is the user’s personal library of saved links and images, organized in collections (folders, can be nested) with tags, notes and pins. ' +
    'Call get_library_overview first to learn collection ids. Saves marked opened:false have not been looked at yet.';
  return permission === 'edit'
    ? `${base} You may organize the library. Edits apply instantly here and reach the phone when the app is next opened. Ask before deleting anything.`
    : `${base} Access is read-only: the user has not allowed changes. Suggest reorganizations instead of making them.`;
}

function error(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function handleOne(req: JsonRpcRequest, ctx: McpContext): JsonRpcResponse | null {
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string') return error(req?.id, -32600, 'Invalid request');
  const isNotification = req.id === undefined;
  if (isNotification) return null;
  const id = req.id ?? null;

  switch (req.method) {
    case 'initialize': {
      const requested = typeof req.params?.protocolVersion === 'string' ? req.params.protocolVersion : '';
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: instructions(ctx.permission),
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: describeTools(ctx.permission) } };
    case 'tools/call': {
      const name = req.params?.name;
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = toolsFor('edit').find((t) => t.name === name);
      if (!tool) return error(id, -32602, `Unknown tool: ${String(name)}`);
      if (tool.write && ctx.permission !== 'edit') {
        return toolResult(id, { error: 'Read-only access. Ask the user to choose "View and edit" in SaveMe → Settings → Claude (MCP).' }, true);
      }
      if (typeof args !== 'object' || args === null || Array.isArray(args)) return error(id, -32602, 'arguments must be an object');
      try {
        const result = ctx.transaction(() => tool.run(args, { db: ctx.db, newId: ctx.newId }));
        return toolResult(id, result, false);
      } catch (e) {
        if (e instanceof InputError) return toolResult(id, { error: e.message }, true);
        console.error('tool failed', name, e);
        return toolResult(id, { error: 'Internal error while running the tool.' }, true);
      }
    }
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };
    default:
      return error(id, -32601, `Method not found: ${req.method}`);
  }
}

function toolResult(id: JsonRpcRequest['id'], value: unknown, isError: boolean): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError },
  };
}

// Returns the JSON body to send, or null when the message only had notifications (HTTP 202).
export function handleMcpMessage(body: unknown, ctx: McpContext): unknown | null {
  if (Array.isArray(body)) {
    const out = body.map((m) => handleOne(m as JsonRpcRequest, ctx)).filter((r): r is JsonRpcResponse => r !== null);
    return out.length ? out : null;
  }
  return handleOne(body as JsonRpcRequest, ctx);
}
