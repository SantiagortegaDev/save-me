// Normalizes what the user types as a tag: "  ##Comida   rápida " -> "Comida rápida". Empty means invalid.
export const MAX_TAG_LENGTH = 40;

export function cleanTagName(input: string): string {
  return input
    .replace(/^[\s#]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
}
