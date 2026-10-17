// Fetches link previews directly from the device. No backend, no tracking.
import { hostname } from './url';
import { parseHtmlMetadata, type LinkMetadata } from './metadataParse';

export type { LinkMetadata };

const TIMEOUT_MS = 10_000;
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string; provider_name?: string };

const OEMBED_PROVIDERS: { test: RegExp; endpoint: (url: string) => string }[] = [
  {
    test: /(^|\.)(youtube\.com|youtu\.be)$/,
    endpoint: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  },
  { test: /(^|\.)tiktok\.com$/, endpoint: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}` },
  { test: /(^|\.)vimeo\.com$/, endpoint: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}` },
  {
    test: /(^|\.)open\.spotify\.com$/,
    endpoint: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  },
];

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryOEmbed(url: string): Promise<LinkMetadata | null> {
  const host = hostname(url);
  const provider = OEMBED_PROVIDERS.find((p) => p.test.test(host));
  if (!provider) return null;
  try {
    const res = await fetchWithTimeout(provider.endpoint(url), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as OEmbed;
    if (!data.title && !data.thumbnail_url) return null;
    return {
      title: data.title || data.author_name || host,
      description: data.author_name ? `by ${data.author_name}` : null,
      thumbnail: data.thumbnail_url ?? null,
      favicon: `https://${host}/favicon.ico`,
      siteName: data.provider_name ?? host,
    };
  } catch {
    return null;
  }
}

export function fallbackMetadata(url: string): LinkMetadata {
  const host = hostname(url);
  return { title: host, description: null, thumbnail: null, favicon: `https://${host}/favicon.ico`, siteName: host };
}

export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  const oembed = await tryOEmbed(url);
  if (oembed) return oembed;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    const type = res.headers.get('content-type') ?? '';
    if (type.startsWith('image/')) {
      return { ...fallbackMetadata(url), thumbnail: url };
    }
    if (!res.ok || !type.includes('html')) return fallbackMetadata(url);
    const html = await res.text();
    return parseHtmlMetadata(html, res.url || url);
  } catch {
    return fallbackMetadata(url);
  }
}
