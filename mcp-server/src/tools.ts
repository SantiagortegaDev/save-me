// MCP tools exposed to Claude. Read tools work in both modes; write tools only when the app grants "edit".
import type { Op, Permission } from '../../src/shared/sync';
import { INBOX_ID } from '../../src/shared/sync';
import {
  applyOp,
  collectionTree,
  descendantIds,
  enqueueOp,
  findCollectionByName,
  getCollection,
  getMeta,
  getSaves,
  InputError,
  listSaves,
  listTagCounts,
  pendingOps,
  searchLibrary,
  stats,
  type Db,
} from './store';

type JsonSchema = Record<string, unknown>;

type ToolContext = { db: Db; newId: () => string };

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  write: boolean;
  destructive?: boolean;
  run: (args: Record<string, unknown>, ctx: ToolContext) => unknown;
};

const COLORS = ['#FFD23F', '#3BCEAC', '#EE4266', '#4C6FFF', '#B79CED', '#FF9F76', '#7BD389', '#F7A1C4', '#5BC0EB', '#C9C9C9'];
const ICONS = ['folder', 'bookmark', 'star', 'heart', 'book-open', 'coffee', 'map-pin', 'music', 'film', 'camera', 'shopping-bag', 'code', 'briefcase', 'globe', 'gift', 'zap'];
const MAX_IDS = 200;

// --- argument helpers -----------------------------------------------------

function str(args: Record<string, unknown>, key: string, opts: { required?: boolean; max?: number } = {}): string | undefined {
  const v = args[key];
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new InputError(`"${key}" is required.`);
    return undefined;
  }
  if (typeof v !== 'string') throw new InputError(`"${key}" must be a string.`);
  const t = v.trim();
  if (opts.max && t.length > opts.max) throw new InputError(`"${key}" must be at most ${opts.max} characters.`);
  return t;
}

function bool(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new InputError(`"${key}" must be true or false.`);
  return v;
}

function int(args: Record<string, unknown>, key: string, def: number, min: number, max: number): number {
  const v = args[key];
  if (v === undefined || v === null) return def;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new InputError(`"${key}" must be a number.`);
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function strList(args: Record<string, unknown>, key: string, opts: { required?: boolean } = {}): string[] {
  const v = args[key];
  if (v === undefined || v === null) {
    if (opts.required) throw new InputError(`"${key}" is required.`);
    return [];
  }
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new InputError(`"${key}" must be a list of strings.`);
  const out = [...new Set((v as string[]).map((x) => x.trim()).filter(Boolean))];
  if (out.length > MAX_IDS) throw new InputError(`"${key}" accepts at most ${MAX_IDS} items.`);
  if (opts.required && out.length === 0) throw new InputError(`"${key}" must not be empty.`);
  return out;
}

function tagNames(args: Record<string, unknown>, key: string): string[] {
  return strList(args, key).map((t) => {
    const clean = t.replace(/^#/, '').trim();
    if (!clean || clean.length > 40) throw new InputError('Tags must be 1-40 characters.');
    return clean;
  });
}

function existingSaveIds(db: Db, ids: string[]): string[] {
  const found = new Set(getSaves(db, ids).map((s) => s.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new InputError(`Unknown save id(s): ${missing.join(', ')}`);
  return ids;
}

// Accepts a collection id or an exact (case-insensitive) collection name.
function resolveCollection(db: Db, ref: string): string {
  if (getCollection(db, ref)) return ref;
  const byName = findCollectionByName(db, ref);
  if (byName.length === 1) return byName[0].id;
  if (byName.length > 1) throw new InputError(`Several collections are named "${ref}". Use its id: ${byName.map((c) => c.id).join(', ')}`);
  throw new InputError(`Collection "${ref}" not found. Call list_collections to see ids.`);
}

function normalizeUrl(input: string): string {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new InputError('Invalid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new InputError('Only http and https links can be saved.');
  return url.toString();
}

function commit(ctx: ToolContext, op: Op) {
  applyOp(ctx.db, op, ctx.newId);
  enqueueOp(ctx.db, op);
}

const SYNC_NOTE = 'Changes show up in Claude immediately and reach the phone the next time the SaveMe app is opened.';

// --- tools ----------------------------------------------------------------

const idList = (description: string) => ({ type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_IDS, description });

export const TOOLS: Tool[] = [
  {
    name: 'get_library_overview',
    title: 'Library overview',
    description:
      'Start here. Returns library stats, the full collection tree with ids and save counts, the most used tags, the 10 most recent saves and when the phone last synced.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    write: false,
    run: (_args, { db }) => ({
      stats: stats(db),
      collections: collectionTree(db),
      top_tags: listTagCounts(db).slice(0, 20),
      recent_saves: listSaves(db, { limit: 10, offset: 0 }).saves,
      last_phone_sync: lastSync(db),
      pending_changes_for_phone: pendingOps(db).length,
    }),
  },
  {
    name: 'list_collections',
    title: 'List collections',
    description: 'Returns every collection (folder) as a tree with ids, colors, icons, pin state and save counts. "inbox" holds unsorted saves.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    write: false,
    run: (_args, { db }) => ({ collections: collectionTree(db) }),
  },
  {
    name: 'list_saves',
    title: 'List saves',
    description: 'Lists saved links and images, newest first (pinned on top). Filter by collection, tag or state, and page with limit/offset.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection id or exact name.' },
        include_subcollections: { type: 'boolean', description: 'Also include saves in nested collections. Default false.' },
        tag: { type: 'string', description: 'Only saves with this tag.' },
        filter: { type: 'string', enum: ['all', 'links', 'images', 'pinned', 'unopened'], description: 'Default all.' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Default 50.' },
        offset: { type: 'integer', minimum: 0, description: 'Default 0.' },
      },
      additionalProperties: false,
    },
    write: false,
    run: (args, { db }) => {
      const collection = str(args, 'collection');
      const filter = str(args, 'filter') as 'all' | 'links' | 'images' | 'pinned' | 'unopened' | undefined;
      if (filter && !['all', 'links', 'images', 'pinned', 'unopened'].includes(filter)) throw new InputError('Unknown filter.');
      const limit = int(args, 'limit', 50, 1, 200);
      const offset = int(args, 'offset', 0, 0, 1_000_000);
      const res = listSaves(db, {
        collectionId: collection ? resolveCollection(db, collection) : undefined,
        includeSubcollections: bool(args, 'include_subcollections') ?? false,
        tag: str(args, 'tag'),
        filter,
        limit,
        offset,
      });
      return { ...res, offset, limit, has_more: offset + res.saves.length < res.total };
    },
  },
  {
    name: 'search_library',
    title: 'Search',
    description: 'Full-text search over titles, URLs, descriptions, notes, sites and tags. Also matches collection names.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Default 50.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    write: false,
    run: (args, { db }) => searchLibrary(db, str(args, 'query', { required: true, max: 200 })!, int(args, 'limit', 50, 1, 200)),
  },
  {
    name: 'get_saves',
    title: 'Get saves',
    description: 'Returns full details (note, description, tags, collection) for specific saves by id.',
    inputSchema: { type: 'object', properties: { save_ids: idList('Save ids.') }, required: ['save_ids'], additionalProperties: false },
    write: false,
    run: (args, { db }) => ({ saves: getSaves(db, strList(args, 'save_ids', { required: true })) }),
  },
  {
    name: 'list_tags',
    title: 'List tags',
    description: 'Returns every tag with how many saves use it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    write: false,
    run: (_args, { db }) => ({ tags: listTagCounts(db) }),
  },

  // --- write tools ---
  {
    name: 'save_link',
    title: 'Save a link',
    description: `Saves a new web link. The app fetches its title and preview image when it syncs. ${SYNC_NOTE}`,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        collection: { type: 'string', description: 'Collection id or exact name. Defaults to Inbox.' },
        title: { type: 'string', description: 'Optional; the app fills in the page title.' },
        note: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        pinned: { type: 'boolean' },
      },
      required: ['url'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const url = normalizeUrl(str(args, 'url', { required: true, max: 4000 })!);
      const dup = ctx.db.all<{ id: string }>("SELECT id FROM saves WHERE kind = 'link' AND url = ?", url)[0];
      if (dup) return { already_saved: true, save: getSaves(ctx.db, [dup.id])[0] };
      const collection = str(args, 'collection');
      const title = str(args, 'title', { max: 300 });
      const id = ctx.newId();
      commit(ctx, {
        type: 'create_save',
        save: {
          id,
          url,
          title: title ?? new URL(url).hostname.replace(/^www\./, ''),
          custom_title: title !== undefined,
          note: str(args, 'note', { max: 5000 }) ?? null,
          collection_id: collection ? resolveCollection(ctx.db, collection) : INBOX_ID,
          pinned: bool(args, 'pinned') ?? false,
          created_at: Date.now(),
        },
        tags: tagNames(args, 'tags'),
      });
      return { saved: getSaves(ctx.db, [id])[0], note: SYNC_NOTE };
    },
  },
  {
    name: 'update_save',
    title: 'Edit a save',
    description: 'Changes the title and/or note of a save. Pass note: "" to clear it.',
    inputSchema: {
      type: 'object',
      properties: { save_id: { type: 'string' }, title: { type: 'string' }, note: { type: 'string' } },
      required: ['save_id'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const [id] = existingSaveIds(ctx.db, [str(args, 'save_id', { required: true })!]);
      const title = str(args, 'title', { max: 300 });
      const rawNote = args.note;
      if (rawNote !== undefined && typeof rawNote !== 'string') throw new InputError('"note" must be a string.');
      if (title === undefined && rawNote === undefined) throw new InputError('Pass a title and/or a note.');
      const note = rawNote === undefined ? undefined : (rawNote as string).trim().slice(0, 5000) || null;
      commit(ctx, { type: 'update_save', id, title, note });
      return { save: getSaves(ctx.db, [id])[0] };
    },
  },
  {
    name: 'move_saves',
    title: 'Move saves',
    description: 'Moves one or more saves into a collection.',
    inputSchema: {
      type: 'object',
      properties: { save_ids: idList('Saves to move.'), collection: { type: 'string', description: 'Destination collection id or exact name.' } },
      required: ['save_ids', 'collection'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const ids = existingSaveIds(ctx.db, strList(args, 'save_ids', { required: true }));
      const collection_id = resolveCollection(ctx.db, str(args, 'collection', { required: true })!);
      commit(ctx, { type: 'move_saves', ids, collection_id });
      return { moved: ids.length, collection: getCollection(ctx.db, collection_id)?.name };
    },
  },
  {
    name: 'set_saves_pinned',
    title: 'Pin or unpin saves',
    description: 'Pins saves to the top of their collection, or unpins them.',
    inputSchema: {
      type: 'object',
      properties: { save_ids: idList('Saves to change.'), pinned: { type: 'boolean' } },
      required: ['save_ids', 'pinned'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const ids = existingSaveIds(ctx.db, strList(args, 'save_ids', { required: true }));
      const pinned = bool(args, 'pinned');
      if (pinned === undefined) throw new InputError('"pinned" is required.');
      commit(ctx, { type: 'set_pinned', ids, pinned });
      return { updated: ids.length, pinned };
    },
  },
  {
    name: 'set_saves_opened',
    title: 'Mark saves opened or unopened',
    description: 'Marks saves as already opened (they leave the Focus Mode backlog) or as new again.',
    inputSchema: {
      type: 'object',
      properties: { save_ids: idList('Saves to change.'), opened: { type: 'boolean' } },
      required: ['save_ids', 'opened'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const ids = existingSaveIds(ctx.db, strList(args, 'save_ids', { required: true }));
      const opened = bool(args, 'opened');
      if (opened === undefined) throw new InputError('"opened" is required.');
      commit(ctx, { type: 'set_seen', ids, seen: opened });
      return { updated: ids.length, opened };
    },
  },
  {
    name: 'tag_saves',
    title: 'Add or remove tags',
    description: 'Adds and/or removes tags on one or more saves. New tags are created automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        save_ids: idList('Saves to tag.'),
        add: { type: 'array', items: { type: 'string' } },
        remove: { type: 'array', items: { type: 'string' } },
      },
      required: ['save_ids'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const ids = existingSaveIds(ctx.db, strList(args, 'save_ids', { required: true }));
      const add = tagNames(args, 'add');
      const remove = tagNames(args, 'remove');
      if (!add.length && !remove.length) throw new InputError('Pass tags to add and/or remove.');
      commit(ctx, { type: 'tag_saves', ids, add, remove });
      return { saves: getSaves(ctx.db, ids).map((s) => ({ id: s.id, tags: s.tags })) };
    },
  },
  {
    name: 'delete_saves',
    title: 'Delete saves',
    description: 'Permanently deletes saves from the library (including saved images on the phone). Confirm with the user first.',
    inputSchema: { type: 'object', properties: { save_ids: idList('Saves to delete.') }, required: ['save_ids'], additionalProperties: false },
    write: true,
    destructive: true,
    run: (args, ctx) => {
      const ids = existingSaveIds(ctx.db, strList(args, 'save_ids', { required: true }));
      commit(ctx, { type: 'delete_saves', ids });
      return { deleted: ids.length };
    },
  },
  {
    name: 'create_collection',
    title: 'Create a collection',
    description: `Creates a collection (folder), optionally inside another one. Colors: ${COLORS.join(', ')}. Icons: ${ICONS.join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 60 },
        parent: { type: 'string', description: 'Parent collection id or exact name, for a sub-collection.' },
        color: { type: 'string', enum: COLORS },
        icon: { type: 'string', enum: ICONS },
      },
      required: ['name'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const name = str(args, 'name', { required: true, max: 60 })!;
      const parent = str(args, 'parent');
      const color = str(args, 'color') ?? COLORS[Math.floor(Math.random() * (COLORS.length - 1))];
      const icon = str(args, 'icon') ?? 'folder';
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new InputError('Color must be a hex value like #FFD23F.');
      if (!ICONS.includes(icon)) throw new InputError(`Unknown icon. Use one of: ${ICONS.join(', ')}`);
      const id = ctx.newId();
      commit(ctx, {
        type: 'create_collection',
        collection: { id, name, color, icon, parent_id: parent ? resolveCollection(ctx.db, parent) : null, created_at: Date.now() },
      });
      return { collection: { id, name, color, icon } };
    },
  },
  {
    name: 'update_collection',
    title: 'Edit a collection',
    description: 'Renames, recolors, re-icons, pins or moves a collection. Set parent to "root" to move it to the top level.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection id or exact name.' },
        name: { type: 'string', maxLength: 60 },
        color: { type: 'string', enum: COLORS },
        icon: { type: 'string', enum: ICONS },
        parent: { type: 'string', description: 'New parent collection id/name, or "root".' },
        pinned: { type: 'boolean' },
      },
      required: ['collection'],
      additionalProperties: false,
    },
    write: true,
    run: (args, ctx) => {
      const id = resolveCollection(ctx.db, str(args, 'collection', { required: true })!);
      const op: Extract<Op, { type: 'update_collection' }> = { type: 'update_collection', id };
      const name = str(args, 'name', { max: 60 });
      const color = str(args, 'color');
      const icon = str(args, 'icon');
      const parent = str(args, 'parent');
      if (name) op.name = name;
      if (color) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new InputError('Color must be a hex value like #FFD23F.');
        op.color = color;
      }
      if (icon) {
        if (!ICONS.includes(icon)) throw new InputError(`Unknown icon. Use one of: ${ICONS.join(', ')}`);
        op.icon = icon;
      }
      if (parent !== undefined) {
        if (id === INBOX_ID) throw new InputError('The Inbox cannot be moved.');
        const parentId = parent.toLowerCase() === 'root' ? null : resolveCollection(ctx.db, parent);
        if (parentId && descendantIds(ctx.db, id).includes(parentId)) throw new InputError('A collection cannot be moved inside itself.');
        op.parent_id = parentId;
      }
      const pinned = bool(args, 'pinned');
      if (pinned !== undefined) op.pinned = pinned;
      if (Object.keys(op).length === 2) throw new InputError('Nothing to change.');
      commit(ctx, op);
      return { collection: getCollection(ctx.db, id) };
    },
  },
  {
    name: 'delete_collection',
    title: 'Delete a collection',
    description: 'Permanently deletes a collection, its sub-collections and every save inside them. Move saves out first if they should be kept. Confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: { collection: { type: 'string', description: 'Collection id or exact name.' } },
      required: ['collection'],
      additionalProperties: false,
    },
    write: true,
    destructive: true,
    run: (args, ctx) => {
      const id = resolveCollection(ctx.db, str(args, 'collection', { required: true })!);
      if (id === INBOX_ID) throw new InputError('The Inbox cannot be deleted.');
      const ids = descendantIds(ctx.db, id);
      const saves = listSaves(ctx.db, { collectionId: id, includeSubcollections: true, limit: 1, offset: 0 }).total;
      commit(ctx, { type: 'delete_collection', id });
      return { deleted_collections: ids.length, deleted_saves: saves };
    },
  },
];

function lastSync(db: Db): string | null {
  const v = getMeta(db, 'last_sync_at');
  return v ? new Date(Number(v)).toISOString() : null;
}

export function toolsFor(permission: Permission): Tool[] {
  return TOOLS.filter((t) => permission === 'edit' || !t.write);
}

export function describeTools(permission: Permission) {
  return toolsFor(permission).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: {
      title: t.title,
      readOnlyHint: !t.write,
      destructiveHint: !!t.destructive,
      idempotentHint: !t.write,
      openWorldHint: false,
    },
  }));
}
