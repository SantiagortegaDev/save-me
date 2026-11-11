// Pure helpers for building LIKE searches. Unit-tested in tests/.

export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// One LIKE pattern per word; a leading "#" (tag syntax) is ignored. At most 8 words.
export function likeTerms(query: string): string[] {
  const words = foldAccents(query)
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^#+/, ''))
    .filter(Boolean);
  return [...new Set(words.map((w) => w.toLowerCase()))].slice(0, 8).map((w) => `%${escapeLike(w)}%`);
}

// "Canción" -> "cancion". Applied to the query here and to stored text in SQL (see foldSql).
export function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const FOLDS: [string, string][] = [
  ['áàâäãåÁÀÂÄÃÅ', 'a'],
  ['éèêëÉÈÊË', 'e'],
  ['íìîïÍÌÎÏ', 'i'],
  ['óòôöõÓÒÔÖÕ', 'o'],
  ['úùûüÚÙÛÜ', 'u'],
  ['ñÑ', 'n'],
  ['çÇ', 'c'],
];

// SQLite's LIKE only ignores case for ASCII, so accented letters are replaced in SQL before matching.
export function foldSql(expr: string): string {
  let out = expr;
  for (const [chars, plain] of FOLDS) for (const ch of chars) out = `replace(${out}, '${ch}', '${plain}')`;
  return out;
}
