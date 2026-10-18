# SaveMe MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets Claude read and organize a SaveMe library. It runs as a Cloudflare Worker at `https://mcp-saveme.santiagortega.dev`.

## How it works

- The app has no accounts. Turning on **Settings → Claude (MCP)** creates a random *space*: a space id, a device secret (kept in the app) and an MCP token (the private link you give Claude). The server stores only SHA-256 hashes of the secrets.
- Each space is a Durable Object with its own SQLite database holding a text mirror of the library (no image files).
- The app uploads its library whenever it changes and polls every minute while open. Claude's edits are applied to the mirror immediately and queued; the app replays the queue the next time it syncs, then acknowledges it.
- **View only** exposes only read tools. **View & edit** adds write tools. The permission is set by the app, never by the token.
- **Regenerate link** replaces the token hash, so the old link stops working at once. Turning the feature off deletes the whole space.

## Endpoints

| Path | Who | Purpose |
| --- | --- | --- |
| `POST /mcp/<token>` or `POST /mcp` with `Authorization: Bearer <token>` | Claude | MCP, Streamable HTTP (JSON responses, stateless) |
| `PUT /api/spaces/<id>` | app | Claim the space or update token hash and permission |
| `POST /api/spaces/<id>/sync` | app | Acknowledge ops, upload snapshot, receive pending ops |
| `DELETE /api/spaces/<id>` | app | Delete everything for this space |

App endpoints use `Authorization: Bearer <deviceSecret>`.

## Tools

Read: `get_library_overview`, `list_collections`, `list_saves`, `search_library`, `get_saves`, `list_tags`.

Edit: `save_link`, `update_save`, `move_saves`, `set_saves_pinned`, `set_saves_opened`, `tag_saves`, `delete_saves`, `create_collection`, `update_collection`, `delete_collection`.

## Develop & deploy

```sh
npm install
npm test           # store + MCP tests on node:sqlite
npm run typecheck
npx wrangler dev   # local server on :8787 (point the app at it with EXPO_PUBLIC_MCP_URL)
npx wrangler deploy
```

The wire format shared with the app lives in `../src/shared/sync.ts`.
