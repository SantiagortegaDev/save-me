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

  const title =
    clean(meta.get('og:title')) ?? clean(meta.get('twitter:title')) ?? clean(titleTag) ?? hostname(pageUrl);
  const image = meta.get('og:image:secure_url') ?? meta.get('og:image') ?? meta.get('twitter:image') ?? meta.get('twitter:image:src') ?? meta.get('image');

  return {
    title,
    description: clean(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description')),
    thumbnail: resolveUrl(image ? decodeEntities(image) : null, pageUrl),
    favicon: resolveUrl(favicon ? decodeEntities(favicon) : '/favicon.ico', pageUrl),
    siteName: clean(meta.get('og:site_name')) ?? hostname(pageUrl),
  };
}
