// Keeps the Claude (MCP) mirror on mcp-saveme.santiagortega.dev in sync with the local library.
// Off by default. When on, the app uploads its library (text only, no image files) and replays Claude's edits.
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';

import { notifyChange, subscribe } from '../db/repo';
import { INBOX_ID } from '../db/schema';
import type { Op, Permission, QueuedOp, Snapshot, SpaceConfig, SyncRequest, SyncResponse } from '../shared/sync';
import { deleteImages } from './images';
import { refreshMetadata } from './saving';

export const MCP_BASE_URL = process.env.EXPO_PUBLIC_MCP_URL ?? 'https://mcp-saveme.santiagortega.dev';
const STATE_KEY = 'mcp';
const PUSH_DEBOUNCE_MS = 3000;
const POLL_MS = 60_000;

export type McpState = {
  enabled: boolean;
  spaceId: string;
  deviceSecret: string;
  token: string;
  permission: Permission;
  ack: number;
  lastSyncAt: number | null;
  lastError: string | null;
};

export function connectorUrl(state: McpState): string {
  return `${MCP_BASE_URL}/mcp/${state.token}`;
}

function randomToken(bytes: number): string {
  const raw = Crypto.getRandomBytes(bytes);
  let bin = '';
  raw.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sha256(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX });
}

// --- persisted state (written without notifyChange so syncing does not trigger itself) ---

export async function loadMcpState(db: SQLiteDatabase): Promise<McpState | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', STATE_KEY);
  return row ? (JSON.parse(row.value) as McpState) : null;
}

async function saveMcpState(db: SQLiteDatabase, state: McpState | null): Promise<void> {
  if (state) {
    await db.runAsync(
      'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      STATE_KEY,
      JSON.stringify(state),
    );
  } else {
    await db.runAsync('DELETE FROM kv WHERE key = ?', STATE_KEY);
  }
  stateListeners.forEach((l) => l(state));
}

type StateListener = (s: McpState | null) => void;
const stateListeners = new Set<StateListener>();
export function subscribeMcpState(l: StateListener): () => void {
  stateListeners.add(l);
  return () => stateListeners.delete(l);
}

// --- server calls ---

async function api<T>(state: McpState, path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MCP_BASE_URL}/api/spaces/${state.spaceId}${path}`, {
    method,
    headers: { authorization: `Bearer ${state.deviceSecret}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Server error ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return (await res.json()) as T;
}

async function pushConfig(state: McpState): Promise<void> {
  const config: SpaceConfig = { mcpTokenHash: await sha256(state.token), permission: state.permission };
  await api(state, '', 'PUT', config);
}

// --- public actions used by the settings screen ---

export async function enableMcp(db: SQLiteDatabase, permission: Permission): Promise<McpState> {
  const spaceId = randomToken(18);
  const state: McpState = {
    enabled: true,
    spaceId,
    deviceSecret: randomToken(32),
    token: `sm.${spaceId}.${randomToken(32)}`,
    permission,
    ack: 0,
    lastSyncAt: null,
    lastError: null,
  };
  await pushConfig(state);
  await saveMcpState(db, state);
  await syncNow(db);
  startMcpSync(db);
  return state;
}

export async function disableMcp(db: SQLiteDatabase): Promise<void> {
  const state = await loadMcpState(db);
  stopMcpSync();
  if (state) {
    // Apply anything Claude changed before wiping the server copy.
    await syncNow(db).catch(() => {});
    await api(state, '', 'DELETE').catch((error) => console.warn('[mcp] delete failed', error));
  }
  await saveMcpState(db, null);
}

export async function setMcpPermission(db: SQLiteDatabase, permission: Permission): Promise<void> {
  const state = await loadMcpState(db);
  if (!state) return;
  const next = { ...state, permission };
  await pushConfig(next);
  await saveMcpState(db, next);
}

// The old token stops working immediately.
export async function regenerateMcpToken(db: SQLiteDatabase): Promise<McpState | null> {
  const state = await loadMcpState(db);
  if (!state) return null;
  const next = { ...state, token: `sm.${state.spaceId}.${randomToken(32)}` };
  await pushConfig(next);
  await saveMcpState(db, next);
  return next;
}

// --- snapshot & ops ---

async function buildSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const [collections, saves, tags, saveTags] = await Promise.all([
    db.getAllAsync<Snapshot['collections'][number]>(
      'SELECT id, name, color, icon, parent_id, pinned, is_inbox, position, created_at, updated_at FROM collections',
    ),
    db.getAllAsync<Snapshot['saves'][number]>(
      `SELECT id, kind, url, title, description, thumbnail, site_name, note, collection_id, pinned, seen, created_at, updated_at
       FROM saves`,
    ),
    db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM tags'),
    db.getAllAsync<{ save_id: string; tag_id: string }>('SELECT save_id, tag_id FROM save_tags'),
  ]);
  return { collections, saves, tags, saveTags };
}

function marks(n: number) {
  return Array.from({ length: n }, () => '?').join(', ');
}

async function tagId(db: SQLiteDatabase, name: string): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name = ? COLLATE NOCASE', name);
  if (existing) return existing.id;
  const id = Crypto.randomUUID();
  await db.runAsync('INSERT INTO tags (id, name) VALUES (?, ?)', id, name);
  return id;
}

async function collectionExists(db: SQLiteDatabase, id: string | null): Promise<boolean> {
  if (!id) return true;
  return !!(await db.getFirstAsync('SELECT 1 FROM collections WHERE id = ?', id));
}

// Replays one of Claude's edits. Every op is idempotent so a retried sync is harmless.
async function applyOp(db: SQLiteDatabase, op: Op, after: { images: string[]; refresh: { id: string; url: string; keepTitle: boolean }[] }) {
  const now = Date.now();
  switch (op.type) {
    case 'create_save': {
      const s = op.save;
      const collectionId = (await collectionExists(db, s.collection_id)) ? s.collection_id : INBOX_ID;
      const res = await db.runAsync(
        `INSERT OR IGNORE INTO saves (id, kind, url, title, note, collection_id, pinned, seen, created_at, updated_at)
         VALUES (?, 'link', ?, ?, ?, ?, ?, 0, ?, ?)`,
        s.id, s.url, s.title, s.note, collectionId, s.pinned ? 1 : 0, s.created_at, s.created_at,
      );
      for (const t of op.tags) {
        await db.runAsync('INSERT OR IGNORE INTO save_tags (save_id, tag_id) VALUES (?, ?)', s.id, await tagId(db, t));
      }
      if (res.changes) after.refresh.push({ id: s.id, url: s.url, keepTitle: !!s.custom_title });
      return;
    }
    case 'update_save':
      if (op.title !== undefined) await db.runAsync('UPDATE saves SET title = ?, updated_at = ? WHERE id = ?', op.title, now, op.id);
      if (op.note !== undefined) await db.runAsync('UPDATE saves SET note = ?, updated_at = ? WHERE id = ?', op.note, now, op.id);
      return;
    case 'move_saves':
      if (!(await collectionExists(db, op.collection_id))) return;
      await db.runAsync(`UPDATE saves SET collection_id = ?, updated_at = ? WHERE id IN (${marks(op.ids.length)})`, op.collection_id, now, ...op.ids);
      return;
    case 'set_pinned':
      await db.runAsync(`UPDATE saves SET pinned = ?, updated_at = ? WHERE id IN (${marks(op.ids.length)})`, op.pinned ? 1 : 0, now, ...op.ids);
      return;
    case 'set_seen':
      await db.runAsync(`UPDATE saves SET seen = ? WHERE id IN (${marks(op.ids.length)})`, op.seen ? 1 : 0, ...op.ids);
      return;
    case 'tag_saves':
      for (const name of op.add) {
        const id = await tagId(db, name);
        for (const saveId of op.ids) {
          await db.runAsync('INSERT OR IGNORE INTO save_tags (save_id, tag_id) SELECT id, ? FROM saves WHERE id = ?', id, saveId);
        }
      }
      for (const name of op.remove) {
        await db.runAsync(
          `DELETE FROM save_tags WHERE tag_id IN (SELECT id FROM tags WHERE name = ? COLLATE NOCASE) AND save_id IN (${marks(op.ids.length)})`,
          name,
          ...op.ids,
        );
      }
      return;
    case 'delete_saves': {
      const rows = await db.getAllAsync<{ image_path: string | null }>(
        `SELECT image_path FROM saves WHERE id IN (${marks(op.ids.length)})`,
        ...op.ids,
      );
      after.images.push(...rows.map((r) => r.image_path).filter((p): p is string => !!p));
      await db.runAsync(`DELETE FROM saves WHERE id IN (${marks(op.ids.length)})`, ...op.ids);
      return;
    }
    case 'create_collection': {
      const c = op.collection;
      const parent = (await collectionExists(db, c.parent_id)) ? c.parent_id : null;
      const max = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM collections WHERE parent_id IS ?', parent);
      await db.runAsync(
        `INSERT OR IGNORE INTO collections (id, name, color, icon, parent_id, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id, c.name, c.color, c.icon, parent, (max?.p ?? 0) + 1, c.created_at, c.created_at,
      );
      return;
    }
    case 'update_collection': {
      if (op.name !== undefined) await db.runAsync('UPDATE collections SET name = ?, updated_at = ? WHERE id = ?', op.name, now, op.id);
      if (op.color !== undefined) await db.runAsync('UPDATE collections SET color = ?, updated_at = ? WHERE id = ?', op.color, now, op.id);
      if (op.icon !== undefined) await db.runAsync('UPDATE collections SET icon = ?, updated_at = ? WHERE id = ?', op.icon, now, op.id);
      if (op.pinned !== undefined) await db.runAsync('UPDATE collections SET pinned = ?, updated_at = ? WHERE id = ?', op.pinned ? 1 : 0, now, op.id);
      if (op.parent_id !== undefined && op.id !== INBOX_ID && (await collectionExists(db, op.parent_id))) {
        // Guard against cycles in case the local tree changed since Claude looked at it.
        const loop = op.parent_id
          ? await db.getFirstAsync(
              `WITH RECURSIVE tree(id) AS (SELECT id FROM collections WHERE id = ?
                 UNION ALL SELECT c.id FROM collections c JOIN tree t ON c.parent_id = t.id)
               SELECT 1 FROM tree WHERE id = ?`,
              op.id,
              op.parent_id,
            )
          : null;
        if (!loop) await db.runAsync('UPDATE collections SET parent_id = ?, updated_at = ? WHERE id = ?', op.parent_id, now, op.id);
      }
      return;
    }
    case 'delete_collection': {
      if (op.id === INBOX_ID) return;
      const rows = await db.getAllAsync<{ image_path: string }>(
        `WITH RECURSIVE tree(id) AS (SELECT id FROM collections WHERE id = ?
           UNION ALL SELECT c.id FROM collections c JOIN tree t ON c.parent_id = t.id)
         SELECT image_path FROM saves WHERE collection_id IN (SELECT id FROM tree) AND image_path IS NOT NULL`,
        op.id,
      );
      after.images.push(...rows.map((r) => r.image_path));
      await db.runAsync('DELETE FROM collections WHERE id = ?', op.id);
      return;
    }
  }
}

async function applyOps(db: SQLiteDatabase, ops: QueuedOp[]): Promise<number> {
  const after = { images: [] as string[], refresh: [] as { id: string; url: string; keepTitle: boolean }[] };
  let last = 0;
  await db.withTransactionAsync(async () => {
    for (const { seq, op } of ops) {
      try {
        await applyOp(db, op, after);
      } catch (error) {
        console.warn('[mcp] could not apply op', op.type, error);
      }
      last = seq;
    }
  });
  deleteImages(after.images);
  notifyChange();
  for (const r of after.refresh) void refreshMetadata(db, r.id, r.url, { keepTitle: r.keepTitle });
  return last;
}

// --- sync loop ---

let running: Promise<void> | null = null;
let again = false;
// Set by any local change; when false, polls only fetch Claude's edits without re-uploading.
let dirty = true;

export function syncNow(db: SQLiteDatabase): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce(db);
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(db: SQLiteDatabase): Promise<void> {
  const state = await loadMcpState(db);
  if (!state?.enabled) return;
  try {
    const upload = dirty;
    dirty = false;
    const body: SyncRequest = { ack: state.ack, snapshot: upload ? await buildSnapshot(db) : null };
    const res = await api<SyncResponse>(state, '/sync', 'POST', body);
    let ack = state.ack;
    if (res.ops.length) {
      ack = await applyOps(db, res.ops);
      again = true; // upload the updated library and acknowledge the ops
    }
    const latest = (await loadMcpState(db)) ?? state;
    await saveMcpState(db, { ...latest, ack, permission: res.permission, lastSyncAt: Date.now(), lastError: null });
  } catch (error) {
    dirty = true;
    const latest = (await loadMcpState(db)) ?? state;
    if (latest.enabled) await saveMcpState(db, { ...latest, lastError: error instanceof Error ? error.message : String(error) });
  }
}

let stop: (() => void) | null = null;

export function startMcpSync(db: SQLiteDatabase): void {
  if (stop) return;
  dirty = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(db), PUSH_DEBOUNCE_MS);
  };
  const unsubscribe = subscribe(schedule);
  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncNow(db);
  });
  const poll = setInterval(() => {
    if (AppState.currentState === 'active') void syncNow(db);
  }, POLL_MS);
  void syncNow(db);
  stop = () => {
    unsubscribe();
    appState.remove();
    clearInterval(poll);
    if (timer) clearTimeout(timer);
  };
}

export function stopMcpSync(): void {
  stop?.();
  stop = null;
}

// Called once at app start.
export async function resumeMcpSync(db: SQLiteDatabase): Promise<void> {
  const state = await loadMcpState(db);
  if (state?.enabled) startMcpSync(db);
}
