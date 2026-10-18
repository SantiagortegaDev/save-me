// Pure HTML metadata extraction (Open Graph, Twitter cards, <title>, icons). Unit-tested in tests/.
import { hostname, resolveUrl } from './url';

export type LinkMetadata = {
  title: string;
  description: string | null;
  thumbnail: string | null;
  favicon: string | null;
  siteName: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCode(parseInt(dec, 10)))
    .replace(/&([a-z#0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function safeFromCode(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const out = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return out.length ? out : null;
}

// Titles sites serve to logged-out visitors or bots; treated as "no title".
const PLATFORM_ONLY = /^(instagram|threads|facebook|reddit|tiktok|x|twitter|pinterest|amazon(\.com)?|linkedin|medium|github|youtube)$/i;
const BLOCKED_PAGE = /^(log ?in|sign ?in|sign ?up|error\b|access denied|just a moment|attention required|robot check|are you a robot|page not found|security check|404\b|503\b)/i;
const LOGIN_SUFFIX = /[•|·-]\s*(log ?in|sign ?in|sign ?up)\s*$/i;

export function isWeakTitle(title: string | null | undefined, pageUrl: string): boolean {
  const t = title?.trim();
  if (!t) return true;
  if (t.toLowerCase() === hostname(pageUrl).toLowerCase()) return true;
  return PLATFORM_ONLY.test(t) || BLOCKED_PAGE.test(t) || LOGIN_SUFFIX.test(t);
}

type JsonLd = { headline?: unknown; name?: unknown; description?: unknown; image?: unknown; thumbnailUrl?: unknown };

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstString(v[0]);
  if (v && typeof v === 'object' && 'url' in v) return firstString((v as { url: unknown }).url);
  return null;
}

// schema.org data many news sites and shops embed instead of (or besides) Open Graph.
function parseJsonLd(head: string): { title: string | null; description: string | null; image: string | null } {
  const out = { title: null as string | null, description: null as string | null, image: null as string | null };
  for (const m of head.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      const nodes: JsonLd[] = (Array.isArray(data) ? data : [data]).flatMap((d) =>
        d && typeof d === 'object' && '@graph' in d ? ((d as { '@graph': JsonLd[] })['@graph'] ?? []) : [d as JsonLd],
      );
      for (const n of nodes) {
        out.title ??= firstString(n.headline) ?? firstString(n.name);
        out.description ??= firstString(n.description);
        out.image ??= firstString(n.image) ?? firstString(n.thumbnailUrl);
      }
    } catch {
      // Ignore malformed blocks.
    }
  }
  return out;
}

export function parseHtmlMetadata(html: string, pageUrl: string): LinkMetadata {
  const head = html.slice(0, 400_000);
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop'))?.toLowerCase();
    const content = attr(tag, 'content');
    if (key && content && !meta.has(key)) meta.set(key, content);
  }

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  let favicon: string | null = null;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel')?.toLowerCase() ?? '';
    const href = attr(tag, 'href');
    if (!href) continue;
    if (rel.includes('apple-touch-icon')) {
      favicon = href;
      break;
    }
    if (rel.split(/\s+/).includes('icon') && !favicon) favicon = href;
  }

  const ld = parseJsonLd(head);
  const imageSrc = (head.match(/<link\b[^>]*rel=["']image_src["'][^>]*>/i)?.[0] ?? '').match(/href=["']([^"']+)/i)?.[1];
  const candidates = [clean(meta.get('og:title')), clean(meta.get('twitter:title')), clean(ld.title), clean(titleTag)];
  const title = candidates.find((t) => t && !isWeakTitle(t, pageUrl)) ?? candidates.find(Boolean) ?? hostname(pageUrl);
  const image =
    meta.get('og:image:secure_url') ??
    meta.get('og:image') ??
    meta.get('og:image:url') ??
    meta.get('twitter:image') ??
    meta.get('twitter:image:src') ??
    meta.get('image') ??
    meta.get('thumbnail') ??
    ld.image ??
    imageSrc;

  return {
    title,
    description: clean(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description') ?? ld.description),
    thumbnail: resolveUrl(image ? decodeEntities(image) : null, pageUrl),
    favicon: resolveUrl(favicon ? decodeEntities(favicon) : '/favicon.ico', pageUrl),
    siteName: clean(meta.get('og:site_name')) ?? hostname(pageUrl),
  };
}

// Instagram's public embed page (instagram.com/p/<code>/embed/captioned/).
export function parseInstagramEmbed(html: string): { image: string | null; caption: string | null; user: string | null } {
  const img = html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]*>/i)?.[0];
  const src = img?.match(/src="([^"]+)"/i)?.[1] ?? null;
  const user = html.match(/class="UsernameText"[^>]*>([^<]+)</i)?.[1] ?? null;
  const captionBlock = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i)?.[1] ?? null;
  const caption = captionBlock
    ? decodeEntities(captionBlock.replace(/<a[^>]*class="CaptionUsername"[^>]*>[\s\S]*?<\/a>/i, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim()
    : null;
  return { image: src ? decodeEntities(src) : null, caption: caption || null, user: user ? decodeEntities(user).trim() : null };
}
