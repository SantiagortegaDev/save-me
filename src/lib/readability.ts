// Turns an article page into plain, readable blocks for offline reading. Pure, unit-tested in tests/.
import { decodeEntities } from './metadataParse';

export type Block = { type: 'h' | 'p' | 'quote' | 'li'; text: string };

const MIN_ARTICLE_CHARS = 400;

const DROP_TAGS = ['script', 'style', 'noscript', 'svg', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'button', 'figure', 'template', 'select'];

// Paragraphs that are site chrome rather than content.
const BOILERPLATE =
  /(cookie|subscribe|newsletter|sign up|log in|all rights reserved|advertisement|share this|follow us|related articles|read more|accept all|privacy policy|terms of (use|service))/i;

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function removeTags(html: string, tags: string[]): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const t of tags) out = out.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}>`, 'gi'), ' ');
  return out;
}

// Content of the first element of the given tag, or null.
function firstElement(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)<\\/${tag}>`, 'i'));
  return m ? m[1] : null;
}

// Elements whose class/id mark them as the article body on most CMSs.
function bodyByHint(html: string): string | null {
  const m = html.match(
    /<(div|section)\b[^>]*(?:class|id)=["'][^"']*(article-body|article__body|post-content|entry-content|story-body|article-content|post-body|content-body)[^"']*["'][^>]*>/i,
  );
  if (!m || m.index === undefined) return null;
  return html.slice(m.index, m.index + 200_000);
}

export function extractArticle(html: string): Block[] {
  const clean = removeTags(html, DROP_TAGS);
  const scope = firstElement(clean, 'article') ?? bodyByHint(clean) ?? firstElement(clean, 'main') ?? firstElement(clean, 'body') ?? clean;
  const blocks: Block[] = [];
  const re = /<(h[1-4]|p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(scope))) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    if (tag.startsWith('h')) {
      if (text.length <= 160) blocks.push({ type: 'h', text });
    } else if (tag === 'li') {
      if (text.length >= 20 && !BOILERPLATE.test(text)) blocks.push({ type: 'li', text });
    } else if (tag === 'blockquote') {
      if (text.length >= 20) blocks.push({ type: 'quote', text });
    } else if (text.length >= 40 && !(text.length < 160 && BOILERPLATE.test(text))) {
      blocks.push({ type: 'p', text });
    }
  }
  // Drop leading/trailing headings with no content after them.
  while (blocks.length && blocks[blocks.length - 1].type === 'h') blocks.pop();
  const chars = blocks.filter((b) => b.type !== 'h').reduce((n, b) => n + b.text.length, 0);
  return chars >= MIN_ARTICLE_CHARS ? blocks : [];
}

// Stored form: one block per paragraph, headings prefixed with "## ", quotes "> ", list items "• ".
export function serializeBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === 'h' ? `## ${b.text}` : b.type === 'quote' ? `> ${b.text}` : b.type === 'li' ? `• ${b.text}` : b.text))
    .join('\n\n');
}

export function parseBlocks(text: string): Block[] {
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((t) =>
      t.startsWith('## ')
        ? { type: 'h' as const, text: t.slice(3) }
        : t.startsWith('> ')
          ? { type: 'quote' as const, text: t.slice(2) }
          : t.startsWith('• ')
            ? { type: 'li' as const, text: t.slice(2) }
            : { type: 'p' as const, text: t },
    );
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).length / 230));
}
