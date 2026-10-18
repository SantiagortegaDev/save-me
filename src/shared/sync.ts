// Wire format shared by the app and the MCP server (mcp-server/). Types only, no runtime imports.

export type Permission = 'read' | 'edit';

export type SnapshotCollection = {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_id: string | null;
  pinned: number;
  is_inbox: number;
  position: number;
  created_at: number;
  updated_at: number;
};

export type SnapshotSave = {
  id: string;
  kind: 'link' | 'image';
  url: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  site_name: string | null;
  note: string | null;
  collection_id: string;
  pinned: number;
  seen: number;
  created_at: number;
  updated_at: number;
};

export type Snapshot = {
  collections: SnapshotCollection[];
  saves: SnapshotSave[];
  tags: { id: string; name: string }[];
  saveTags: { save_id: string; tag_id: string }[];
};

// Changes made by Claude on the server, replayed on the device in order.
export type Op =
  | {
      type: 'create_save';
      save: {
        id: string;
        url: string;
        title: string;
        // True when Claude chose the title; the app then keeps it instead of using the page title.
        custom_title: boolean;
        note: string | null;
        collection_id: string;
        pinned: boolean;
        created_at: number;
      };
      tags: string[];
    }
  | { type: 'update_save'; id: string; title?: string; note?: string | null }
  | { type: 'move_saves'; ids: string[]; collection_id: string }
  | { type: 'set_pinned'; ids: string[]; pinned: boolean }
  | { type: 'set_seen'; ids: string[]; seen: boolean }
  | { type: 'tag_saves'; ids: string[]; add: string[]; remove: string[] }
  | { type: 'delete_saves'; ids: string[] }
  | {
      type: 'create_collection';
      collection: { id: string; name: string; color: string; icon: string; parent_id: string | null; created_at: number };
    }
  | {
      type: 'update_collection';
      id: string;
      name?: string;
      color?: string;
      icon?: string;
      parent_id?: string | null;
      pinned?: boolean;
    }
  | { type: 'delete_collection'; id: string };

export type QueuedOp = { seq: number; op: Op };

// PUT /api/spaces/:spaceId   (Authorization: Bearer <deviceSecret>)
export type SpaceConfig = { mcpTokenHash: string; permission: Permission };

// POST /api/spaces/:spaceId/sync
export type SyncRequest = { ack: number; snapshot: Snapshot | null };
export type SyncResponse = { ops: QueuedOp[]; permission: Permission };

export const INBOX_ID = 'inbox';
