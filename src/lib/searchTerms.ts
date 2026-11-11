// Pure helpers for building LIKE searches. Unit-tested in tests/.

export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// One LIKE pattern per word; a leading "#" (tag syntax) is ignored. At most 8 words.
export function likeTerms(query: string): string[] {
  const words = query
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^#+/, ''))
    .filter(Boolean);
  return [...new Set(words.map((w) => w.toLowerCase()))].slice(0, 8).map((w) => `%${escapeLike(w)}%`);
}
