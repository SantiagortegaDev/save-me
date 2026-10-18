import { parseMcpToken, SPACE_ID } from './auth';
import { SERVER_INFO } from './mcp';

export { SaveMeSpace } from './space';

type Env = { SPACES: DurableObjectNamespace };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'mcp-session-id',
};

const LANDING = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SaveMe MCP</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;background:#FFF8EC;color:#111}
code{background:#fff;border:2px solid #111;border-radius:6px;padding:2px 6px}</style>
<h1>SaveMe MCP server</h1>
<p>Lets Claude read and organize your SaveMe library. Open <b>SaveMe → Settings → Claude (MCP)</b>, turn it on and copy your personal link.</p>
<p>Add it in Claude as a custom connector, or in Claude Code with <code>claude mcp add --transport http saveme &lt;your link&gt;</code>.</p>
<p>Source: <a href="https://github.com/santiagortegadev/save-me">github.com/santiagortegadev/save-me</a></p>`;

function withCors(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts.length === 0 && request.method === 'GET') {
      return new Response(LANDING, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (parts[0] === 'health') return Response.json({ ok: true, ...SERVER_INFO });

    // MCP endpoint: token in the path (/mcp/<token>) or as a bearer token on /mcp.
    if (parts[0] === 'mcp') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const token = parts[1] ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      const parsed = parseMcpToken(decodeURIComponent(token));
      if (!parsed) {
        return withCors(Response.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or malformed SaveMe token.' } }, { status: 401 }));
      }
      const headers = new Headers(request.headers);
      headers.set('x-saveme-token', decodeURIComponent(token));
      const stub = env.SPACES.get(env.SPACES.idFromName(parsed.spaceId));
      const res = await stub.fetch(new Request(new URL('/mcp', url), { method: request.method, headers, body: request.body }));
      return withCors(res);
    }

    // App endpoints: /api/spaces/<spaceId>[/sync]
    if (parts[0] === 'api' && parts[1] === 'spaces' && parts[2] && SPACE_ID.test(parts[2]) && parts.length <= 4) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS' } });
      const stub = env.SPACES.get(env.SPACES.idFromName(parts[2]));
      return withCors(await stub.fetch(request));
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
