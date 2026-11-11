// Pure helpers for working with URLs (no React Native imports, unit-tested in tests/).

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/i;

// Pulls the first http(s) URL out of shared text like "Look at this! https://x.com/a".
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_IN_TEXT);
  if (!match) return null;
  return match[0].replace(/[).,;!?\]]+$/, '');
}

// Share-sheet tracking parameters. Removing them keeps URLs clean and lets the same post be detected as a duplicate.
const TRACKING_ANYWHERE = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igsh|igshid|_hsenc|_hsmi|mkt_tok|yclid|twclid)$/i;
const TRACKING_BY_HOST: [RegExp, string[]][] = [
  [/(^|\.)(youtube\.com|youtu\.be|spotify\.com)$/, ['si', 'feature', 'pp']],
  [/(^|\.)(x\.com|twitter\.com)$/, ['s', 't', 'ref_src', 'ref_url']],
  [/(^|\.)tiktok\.com$/, ['_r', '_t', 'is_from_webapp', 'sender_device', 'web_id', 'share_app_id', 'share_link_id', 'u_code', 'preview_pb', 'tt_from', 'social_share_type']],
  [/(^|\.)instagram\.com$/, ['img_index', 'utm_source']],
  [/(^|\.)reddit\.com$/, ['share_id', 'rdt']],
  [/(^|\.)(facebook\.com|fb\.watch)$/, ['mibextid', 'rdid', 'share_url']],
  [/(^|\.)threads\.net$/, ['xmt', 'slof']],
  [/(^|\.)pinterest\.\w+$/, ['invite_code', 'sender', 'sfo']],
];

function stripTracking(url: URL) {
  const host = url.hostname.replace(/^www\./, '');
  const hostParams = TRACKING_BY_HOST.find(([re]) => re.test(host))?.[1] ?? [];
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_ANYWHERE.test(key) || hostParams.includes(key)) url.searchParams.delete(key);
  }
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    stripTracking(url);
    return url.toString();
  } catch {
    return null;
  }
}

// What the user typed or pasted: a bare link, or text with a link in it ("Watch this https://vm.tiktok.com/x").
export function linkFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const found = extractUrl(text);
  return found ? normalizeUrl(found) : normalizeUrl(text);
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
