import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import type { Snapshot } from '../../src/shared/sync';
import { handleMcpMessage, type McpContext } from '../src/mcp';
import { ackOps, applyOp, initSchema, pendingOps, replaceSnapshot, type Db, type SqlValue } from '../src/store';

function memoryDb(): Db {
  const raw = new DatabaseSync(':memory:');
  return {
    all: <T,>(q: string, ...p: SqlValue[]) => raw.prepare(q).all(...p) as T[],
    run: (q: string, ...p: SqlValue[]) => {
      raw.prepare(q).run(...p);
    },
  };
}

let counter = 0;
const newId = () => `id-${++counter}`;

const now = 1_700_000_000_000;
const SNAPSHOT: Snapshot = {
  collections: [
    { id: 'inbox', name: 'Inbox', color: '#C9C9C9', icon: 'inbox', parent_id: null, pinned: 0, is_inbox: 1, position: -1, created_at: now, updated_at: now },
    { id: 'c-food', name: 'Recipes', color: '#FFD23F', icon: 'coffee', parent_id: null, pinned: 0, is_inbox: 0, position: 1, created_at: now, updated_at: now },
    { id: 'c-pasta', name: 'Pasta', color: '#FFD23F', icon: 'folder', parent_id: 'c-food', pinned: 0, is_inbox: 0, position: 1, created_at: now, updated_at: now },
  ],
  saves: [
    { id: 's1', kind: 'link', url: 'https://pasta.example/', title: 'Carbonara', description: 'Roman classic', thumbnail: null, site_name: 'pasta.example', note: 'try it', collection_id: 'c-pasta', pinned: 0, seen: 0, created_at: now, updated_at: now },
    { id: 's2', kind: 'link', url: 'https://news.example/', title: 'Daily news', description: null, thumbnail: null, site_name: null, note: null, collection_id: 'inbox', pinned: 1, seen: 1, created_at: now + 1, updated_at: now + 1 },
    { id: 's3', kind: 'image', url: '', title: 'Screenshot', description: null, thumbnail: null, site_name: null, note: null, collection_id: 'inbox', pinned: 0, seen: 0, created_at: now + 2, updated_at: now + 2 },
  ],
  tags: [{ id: 't1', name: 'italian' }],
  saveTags: [{ save_id: 's1', tag_id: 't1' }],
};

function setup(permission: 'read' | 'edit') {
  const db = memoryDb();
  initSchema(db);
  replaceSnapshot(db, SNAPSHOT);
  const ctx: McpContext = { db, permission, newId, transaction: (fn) => fn() };
  let nextId = 1;
  const call = (name: string, args: Record<string, unknown> = {}) => {
    const res = handleMcpMessage({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } }, ctx) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    return { isError: res.result.isError, data: JSON.parse(res.result.content[0].text) };
  };
  return { db, ctx, call };
}

test('initialize negotiates the protocol version and notifications get no reply', () => {
  const { ctx } = setup('read');
  const init = handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, ctx) as {
    result: { protocolVersion: string; serverInfo: { name: string } };
  };
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'saveme');
  assert.equal(handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx), null);
});

test('read-only spaces only list read tools and refuse writes', () => {
  const { ctx, call } = setup('read');
  const list = handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, ctx) as { result: { tools: { name: string }[] } };
  const names = list.result.tools.map((t) => t.name);
  assert.ok(names.includes('search_library'));
  assert.ok(!names.includes('move_saves'));
  const res = call('move_saves', { save_ids: ['s1'], collection: 'inbox' });
  assert.equal(res.isError, true);
  assert.match(res.data.error, /Read-only/);
});

test('overview, listing and search', () => {
  const { call } = setup('read');
  const overview = call('get_library_overview').data;
  assert.equal(overview.stats.saves, 3);
  assert.equal(overview.collections[1].children[0].name, 'Pasta');

  const nested = call('list_saves', { collection: 'Recipes', include_subcollections: true }).data;
  assert.equal(nested.total, 1);
  assert.deepEqual(nested.saves[0].tags, ['italian']);
  assert.equal(call('list_saves', { collection: 'Recipes' }).data.total, 0);
  assert.equal(call('list_saves', { filter: 'unopened' }).data.total, 2);

  assert.equal(call('search_library', { query: 'ITALIAN' }).data.saves[0].id, 's1');
  assert.equal(call('search_library', { query: '100%' }).data.saves.length, 0);
});

test('edits apply to the mirror and queue ops for the phone', () => {
  const { db, call } = setup('edit');
  const saved = call('save_link', { url: 'example.org/read', collection: 'recipes', tags: ['#later'] });
  assert.equal(saved.isError, false);
  assert.equal(saved.data.saved.collection.name, 'Recipes');
  assert.deepEqual(saved.data.saved.tags, ['later']);
  assert.equal(call('save_link', { url: 'https://example.org/read' }).data.already_saved, true);

  assert.equal(call('move_saves', { save_ids: ['s2', 's3'], collection: 'Pasta' }).data.moved, 2);
  assert.equal(call('move_saves', { save_ids: ['nope'], collection: 'Pasta' }).isError, true);
  call('tag_saves', { save_ids: ['s2'], add: ['news'], remove: [] });
  call('update_save', { save_id: 's1', note: '' });

  const ops = pendingOps(db).map((o) => o.op.type);
  assert.deepEqual(ops, ['create_save', 'move_saves', 'tag_saves', 'update_save']);
  assert.equal(call('get_saves', { save_ids: ['s1'] }).data.saves[0].note, null);
});

test('collections cannot be moved into themselves; deleting removes descendants', () => {
  const { call } = setup('edit');
  assert.equal(call('update_collection', { collection: 'Recipes', parent: 'Pasta' }).isError, true);
  assert.equal(call('delete_collection', { collection: 'inbox' }).isError, true);
  const res = call('delete_collection', { collection: 'Recipes' }).data;
  assert.deepEqual(res, { deleted_collections: 2, deleted_saves: 1 });
  assert.equal(call('get_library_overview').data.stats.saves, 2);
});

test('a phone upload keeps edits the phone has not applied yet', () => {
  const { db, call } = setup('edit');
  call('set_saves_pinned', { save_ids: ['s1'], pinned: true });
  const [first] = pendingOps(db);
  // The phone uploads a fresh snapshot without having seen op #1.
  replaceSnapshot(db, SNAPSHOT);
  for (const { op } of pendingOps(db)) applyOp(db, op);
  assert.equal(call('get_saves', { save_ids: ['s1'] }).data.saves[0].pinned, true);
  // After acking, the queue is empty.
  ackOps(db, first.seq);
  assert.equal(pendingOps(db).length, 0);
});
