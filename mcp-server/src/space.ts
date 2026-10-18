import { DurableObject } from 'cloudflare:workers';

import type { Permission, SpaceConfig, SyncRequest, SyncResponse } from '../../src/shared/sync';
import { isValidSecret, safeEqual, sha256Hex } from './auth';
import { handleMcpMessage } from './mcp';
import { ackOps, applyOp, getMeta, initSchema, pendingOps, replaceSnapshot, setMeta, type Db, type SqlValue } from './store';

const MAX_BODY = 25 * 1024 * 1024;

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}

// One Durable Object per SaveMe install ("space"). It holds a mirror of the library plus a queue of Claude's edits.
export class SaveMeSpace extends DurableObject<Record<string, never>> {
  private db: Db;
  private ready = false;

  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    this.db = {
      all: <T,>(q: string, ...p: SqlValue[]) => sql.exec(q, ...p).toArray() as T[],
      run: (q: string, ...p: SqlValue[]) => {
        sql.exec(q, ...p);
      },
    };
  }

  private init() {
    if (this.ready) return;
    initSchema(this.db);
    this.ready = true;
  }

  private tx<T>(fn: () => T): T {
    return this.ctx.storage.transactionSync(fn);
  }

  private async readJson<T>(request: Request): Promise<T | null> {
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) return null;
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  private async deviceAuthorized(request: Request): Promise<boolean> {
    const secret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const stored = getMeta(this.db, 'device_hash');
    if (!stored || !isValidSecret(secret)) return false;
    return safeEqual(await sha256Hex(secret), stored);
  }

  override async fetch(request: Request): Promise<Response> {
    this.init();
    const url = new URL(request.url);
    const route = url.pathname.split('/').filter(Boolean); // ['api','spaces',id,(sync)] or ['mcp']

    if (route[0] === 'mcp') return this.mcp(request);
    if (route[0] === 'api' && route.length === 3) {
      if (request.method === 'PUT') return this.configure(request);
      if (request.method === 'DELETE') return this.destroy(request);
      if (request.method === 'GET') return this.status(request);
    }
    if (route[0] === 'api' && route[3] === 'sync' && request.method === 'POST') return this.sync(request);
    return json({ error: 'Not found' }, 404);
  }

  // First PUT claims the space for this device; later PUTs must use the same device secret.
  private async configure(request: Request): Promise<Response> {
    const secret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!isValidSecret(secret)) return json({ error: 'Invalid device secret' }, 401);
    const body = await this.readJson<SpaceConfig>(request);
    if (!body || !/^[0-9a-f]{64}$/.test(body.mcpTokenHash ?? '') || !['read', 'edit'].includes(body.permission)) {
      return json({ error: 'Invalid config' }, 400);
    }
    const secretHash = await sha256Hex(secret);
    const stored = getMeta(this.db, 'device_hash');
    if (stored && !safeEqual(secretHash, stored)) return json({ error: 'Forbidden' }, 403);
    this.tx(() => {
      setMeta(this.db, 'device_hash', secretHash);
      setMeta(this.db, 'mcp_hash', body.mcpTokenHash);
      setMeta(this.db, 'permission', body.permission);
    });
    return json({ ok: true, permission: body.permission });
  }

  private async status(request: Request): Promise<Response> {
    if (!(await this.deviceAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
    return json({ permission: getMeta(this.db, 'permission'), pending: pendingOps(this.db).length });
  }

  // Turning the MCP off in the app wipes everything stored for this space.
  private async destroy(request: Request): Promise<Response> {
    if (!(await this.deviceAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
    await this.ctx.storage.deleteAll();
    this.ready = false;
    return json({ ok: true });
  }

  // The app acknowledges the ops it applied, uploads its current library and receives the ops still pending.
  private async sync(request: Request): Promise<Response> {
    if (!(await this.deviceAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
    const body = await this.readJson<SyncRequest>(request);
    if (!body || typeof body.ack !== 'number') return json({ error: 'Invalid sync body' }, 400);
    const result = this.tx<SyncResponse>(() => {
      ackOps(this.db, body.ack);
      const remaining = pendingOps(this.db);
      if (body.snapshot) {
        replaceSnapshot(this.db, body.snapshot);
        // Edits the phone has not seen yet must survive the upload.
        for (const { op } of remaining) applyOp(this.db, op);
      }
      setMeta(this.db, 'last_sync_at', String(Date.now()));
      return { ops: remaining, permission: (getMeta(this.db, 'permission') as Permission) ?? 'read' };
    });
    return json(result);
  }

  private async mcp(request: Request): Promise<Response> {
    const stored = getMeta(this.db, 'mcp_hash');
    const token = request.headers.get('x-saveme-token') ?? '';
    if (!stored || !token || !safeEqual(await sha256Hex(token), stored)) {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Invalid or revoked SaveMe token. Copy the current link from the app.' } }, 401);
    }
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    const body = await this.readJson<unknown>(request);
    if (body === null) return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    const permission = (getMeta(this.db, 'permission') as Permission) ?? 'read';
    const reply = handleMcpMessage(body, {
      db: this.db,
      permission,
      newId: () => crypto.randomUUID(),
      transaction: (fn) => this.tx(fn),
    });
    if (reply === null) return new Response(null, { status: 202 });
    return json(reply);
  }
}
