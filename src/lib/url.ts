// Pure helpers for working with URLs (no React Native imports, unit-tested in tests/).

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/i;

// Pulls the first http(s) URL out of shared text like "Look at this! https://x.com/a".
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_IN_TEXT);
  if (!match) return null;
  return match[0].replace(/[).,;!?\]]+$/, '');
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function resolveUrl(maybeRelative: string | null | undefined, base: string): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}
