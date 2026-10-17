// Pure parsers for bookmark exports from other apps. Unit-tested in tests/.
import { normalizeUrl } from './url';

export type ImportedLink = {
  url: string;
  title: string;
  folder: string | null;
  tags: string[];
  note: string | null;
  createdAt: number | null;
};

function toTimestamp(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n > 1e12) return n; // milliseconds
    if (n > 1e9) return n * 1000; // seconds
    return null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function splitTags(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[,|;]/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean);
}

// RFC 4180-ish CSV parser supporting quoted fields, escaped quotes and newlines in quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('Unterminated quoted field in CSV');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_ALIASES: Record<keyof Omit<ImportedLink, 'tags'> | 'tags', string[]> = {
  url: ['url', 'link', 'href', 'address', 'uri'],
  title: ['title', 'name', 'excerpt'],
  folder: ['folder', 'collection', 'category', 'list', 'group'],
  tags: ['tags', 'tag', 'labels'],
  note: ['note', 'notes', 'description', 'comment', 'annotation'],
  createdAt: ['created', 'created_at', 'createdat', 'date', 'time_added', 'added', 'timestamp'],
};

// Handles Pocket, Raindrop, Instapaper, Omnivore and generic CSV exports.
export function parseCsvBookmarks(text: string): ImportedLink[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (key: keyof typeof HEADER_ALIASES) => header.findIndex((h) => HEADER_ALIASES[key].includes(h));
  let urlIdx = col('url');
  let body = rows.slice(1);
  if (urlIdx === -1) {
    // No header: take the first column that looks like a URL.
    urlIdx = rows[0].findIndex((c) => normalizeUrl(c) !== null && /^https?:/i.test(c.trim()));
    if (urlIdx === -1) return [];
    body = rows;
  }
  const titleIdx = col('title');
  const folderIdx = col('folder');
  const tagsIdx = col('tags');
  const noteIdx = col('note');
  const createdIdx = col('createdAt');
  const out: ImportedLink[] = [];
  for (const r of body) {
    const url = normalizeUrl(r[urlIdx] ?? '');
    if (!url) continue;
    out.push({
      url,
      title: (titleIdx >= 0 ? r[titleIdx]?.trim() : '') || '',
      folder: (folderIdx >= 0 ? r[folderIdx]?.trim() : '') || null,
      tags: tagsIdx >= 0 ? splitTags(r[tagsIdx]) : [],
      note: (noteIdx >= 0 ? r[noteIdx]?.trim() : '') || null,
      createdAt: createdIdx >= 0 ? toTimestamp(r[createdIdx]) : null,
    });
  }
  return out;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Netscape bookmark file format (Chrome, Firefox, Safari, Edge, Pinboard, Raindrop HTML export).
export function parseNetscapeHtml(html: string): ImportedLink[] {
  const out: ImportedLink[] = [];
  const folders: string[] = [];
  const token = /<h3[^>]*>([\s\S]*?)<\/h3>|<\/dl>|<a\b([^>]*)>([\s\S]*?)<\/a>(?:\s*<dd>([^<]*))?/gi;
  let m: RegExpExecArray | null;
  let pendingFolder: string | null = null;
  const dlOpen = /<dl/gi;
  // Track nesting by counting <DL> openings between tokens.
  let lastIndex = 0;
  while ((m = token.exec(html))) {
    const between = html.slice(lastIndex, m.index);
    const opens = (between.match(dlOpen) ?? []).length;
    for (let i = 0; i < opens; i++) {
      folders.push(pendingFolder ?? '');
      pendingFolder = null;
    }
    lastIndex = token.lastIndex;
    if (m[1] !== undefined) {
      pendingFolder = decodeHtml(m[1].replace(/<[^>]+>/g, ''));
    } else if (m[0].toLowerCase() === '</dl>') {
      folders.pop();
    } else {
      const attrs = m[2] ?? '';
      const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? attrs.match(/href\s*=\s*'([^']*)'/i)?.[1];
      const url = href ? normalizeUrl(decodeHtml(href)) : null;
      if (!url) continue;
      const added = attrs.match(/add_date\s*=\s*"(\d+)"/i)?.[1];
      const tags = attrs.match(/tags\s*=\s*"([^"]*)"/i)?.[1];
      const folder = [...folders].reverse().find((f) => f && !/^(bookmarks( bar| menu| toolbar)?|other bookmarks)$/i.test(f));
      out.push({
        url,
        title: decodeHtml(m[3].replace(/<[^>]+>/g, '')),
        folder: folder ?? null,
        tags: splitTags(tags ? decodeHtml(tags) : null),
        note: m[4] ? decodeHtml(m[4]) || null : null,
        createdAt: toTimestamp(added),
      });
    }
  }
  return out;
}

type LooseJson = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// Generic JSON: an array of bookmark-ish objects, or { items | bookmarks | links: [...] }.
export function parseJsonBookmarks(text: string): ImportedLink[] {
  const data = JSON.parse(text) as unknown;
  const list: unknown[] = Array.isArray(data)
    ? data
    : ((data as LooseJson).items ?? (data as LooseJson).bookmarks ?? (data as LooseJson).links ?? []) as unknown[];
  if (!Array.isArray(list)) return [];
  const out: ImportedLink[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as LooseJson;
    const url = normalizeUrl(str(o.url) ?? str(o.link) ?? str(o.href) ?? '');
    if (!url) continue;
    const rawTags = o.tags;
    const tags = Array.isArray(rawTags)
      ? rawTags.map((t) => (typeof t === 'string' ? t : str((t as LooseJson)?.name) ?? '')).filter(Boolean)
      : splitTags(str(rawTags));
    const created = o.created ?? o.created_at ?? o.createdAt ?? o.date ?? o.time_added;
    out.push({
      url,
      title: str(o.title) ?? str(o.name) ?? '',
      folder: str(o.folder) ?? str(o.collection) ?? str((o.collection as LooseJson | undefined)?.title) ?? null,
      tags,
      note: str(o.note) ?? str(o.notes) ?? str(o.excerpt) ?? str(o.description) ?? null,
      createdAt: typeof created === 'number' ? toTimestamp(String(created)) : toTimestamp(str(created)),
    });
  }
  return out;
}

export function detectAndParse(fileName: string, text: string): ImportedLink[] {
  const lower = fileName.toLowerCase();
  const head = text.slice(0, 512).toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm') || head.includes('netscape-bookmark-file')) {
    return parseNetscapeHtml(text);
  }
  if (lower.endsWith('.json') || /^\s*[[{]/.test(text)) return parseJsonBookmarks(text);
  return parseCsvBookmarks(text);
}
