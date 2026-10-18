// Fetches link previews directly from the device. No backend, no tracking.
// Strategy: platform APIs (oEmbed, fxtwitter) first, then the page's own meta tags,
// retried with a link-preview crawler user agent that social sites answer with full previews.
import { detectPlatform, fallbackTitle, type Platform } from './platform';
import { hostname, resolveUrl } from './url';
import { isWeakTitle, parseHtmlMetadata, parseInstagramEmbed, type LinkMetadata } from './metadataParse';

export type { LinkMetadata };

const TIMEOUT_MS = 10_000;
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const PREVIEW_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json', ...headers } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function faviconFor(url: string): string {
  return `https://icons.duckduckgo.com/ip3/${hostname(url)}.ico`;
}

// Logos that login walls return instead of the real preview image.
const PLACEHOLDER_IMAGE = /static\.cdninstagram\.com\/rsrc\.php|static\.xx\.fbcdn\.net\/rsrc\.php|abs\.twimg\.com\/(responsive-web|rweb)|redditstatic\.com\/(shreddit|desktop2x)|\/favicon|apple-touch-icon/i;

function usableImage(src: string | null | undefined): string | null {
  return src && !PLACEHOLDER_IMAGE.test(src) ? src : null;
}

function result(url: string, platform: Platform, data: Partial<LinkMetadata>): LinkMetadata {
  const title = data.title && !isWeakTitle(data.title, url) ? data.title : fallbackTitle(url);
  return {
    title: title.length > 300 ? `${title.slice(0, 297)}…` : title,
    description: data.description ?? null,
    thumbnail: usableImage(data.thumbnail),
    favicon: data.favicon ?? faviconFor(url),
    siteName: platform.key === 'web' ? (data.siteName ?? hostname(url)) : platform.name,
  };
}

export function fallbackMetadata(url: string): LinkMetadata {
  return result(url, detectPlatform(url), {});
}

// --- platform-specific sources -------------------------------------------

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string; provider_name?: string };

const OEMBED: Partial<Record<Platform['key'], (u: string) => string>> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  vimeo: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  soundcloud: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  pinterest: (u) => `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(u)}`,
};

async function fromOEmbed(url: string, platform: Platform): Promise<Partial<LinkMetadata> | null> {
  const endpoint = OEMBED[platform.key];
  if (!endpoint) return null;
  const data = await getJson<OEmbed>(endpoint(url));
  if (!data || (!data.title && !data.thumbnail_url)) return null;
  return {
    title: data.title || (data.author_name ? `${data.author_name} on ${platform.name}` : undefined),
    description: data.author_name ? `by ${data.author_name}` : null,
    thumbnail: data.thumbnail_url ?? null,
  };
}

type FxTweet = {
  tweet?: {
    text?: string;
    author?: { name?: string; screen_name?: string; avatar_url?: string };
    media?: { photos?: { url: string }[]; videos?: { thumbnail_url?: string }[]; mosaic?: { formats?: { jpeg?: string } } };
  };
};

// X/Twitter hides previews from plain fetches; fxtwitter's public API exposes them.
async function fromX(url: string): Promise<Partial<LinkMetadata> | null> {
  const m = url.match(/(?:x|twitter)\.com\/([^/?#]+)\/status(?:es)?\/(\d+)/i);
  if (!m) return null;
  const data = await getJson<FxTweet>(`https://api.fxtwitter.com/${m[1]}/status/${m[2]}`);
  const t = data?.tweet;
  if (!t) return null;
  const media = t.media;
  const author = t.author?.name ? `${t.author.name} (@${t.author.screen_name})` : `@${m[1]}`;
  const text = t.text?.trim();
  return {
    title: text ? (text.length > 120 ? `${text.slice(0, 117)}…` : text) : `Post by ${author}`,
    description: text ? `${author} on X` : null,
    thumbnail: media?.photos?.[0]?.url ?? media?.mosaic?.formats?.jpeg ?? media?.videos?.[0]?.thumbnail_url ?? t.author?.avatar_url ?? null,
  };
}

async function fromInstagramEmbed(url: string): Promise<Partial<LinkMetadata> | null> {
  const m = url.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|reels|tv)\/([^/?#]+)/i);
  if (!m) return null;
  try {
    const res = await fetchWithTimeout(`https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed/captioned/`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const embed = parseInstagramEmbed(await res.text());
    if (!embed.image && !embed.caption) return null;
    const caption = embed.caption;
    return {
      title: caption ? (caption.length > 120 ? `${caption.slice(0, 117)}…` : caption) : undefined,
      description: embed.user ? `@${embed.user} on Instagram` : null,
      thumbnail: embed.image,
    };
  } catch {
    return null;
  }
}

async function fromHtml(url: string, userAgent: string): Promise<(Partial<LinkMetadata> & { finalUrl: string }) | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.8' },
    });
    const type = res.headers.get('content-type') ?? '';
    if (type.startsWith('image/')) return { thumbnail: url, finalUrl: url };
    if (!res.ok || !type.includes('html')) return null;
    const finalUrl = res.url || url;
    const meta = parseHtmlMetadata(await res.text(), finalUrl);
    return { ...meta, thumbnail: resolveUrl(meta.thumbnail, finalUrl), finalUrl };
  } catch {
    return null;
  }
}

function good(m: Partial<LinkMetadata> | null, url: string): boolean {
  return !!m && !!usableImage(m.thumbnail) && !isWeakTitle(m.title, url);
}

// Fills gaps in `base` from `extra` without replacing good values.
function merge(base: Partial<LinkMetadata> | null, extra: Partial<LinkMetadata> | null, url: string): Partial<LinkMetadata> | null {
  if (!base) return extra;
  if (!extra) return base;
  return {
    title: !isWeakTitle(base.title, url) ? base.title : extra.title ?? base.title,
    description: base.description ?? extra.description,
    thumbnail: usableImage(base.thumbnail) ?? usableImage(extra.thumbnail),
    siteName: base.siteName ?? extra.siteName,
  };
}

// Social sites answer link-preview crawlers with full meta tags but show login walls to browsers.
const CRAWLER_FIRST = new Set<Platform['key']>(['instagram', 'facebook', 'threads', 'reddit', 'linkedin', 'pinterest']);

export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  const platform = detectPlatform(url);
  let best: Partial<LinkMetadata> | null = null;

  if (platform.key === 'x') best = await fromX(url);
  else best = await fromOEmbed(url, platform);
  if (good(best, url)) return result(url, platform, best!);

  const agents = CRAWLER_FIRST.has(platform.key) ? [PREVIEW_UA, BROWSER_UA] : [BROWSER_UA, PREVIEW_UA];
  for (const ua of agents) {
    best = merge(best, await fromHtml(url, ua), url);
    if (good(best, url)) return result(url, platform, best!);
  }

  if (platform.key === 'instagram') best = merge(best, await fromInstagramEmbed(url), url);
  return result(url, platform, best ?? {});
}
