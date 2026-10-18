export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SPACE_ID = /^[A-Za-z0-9_-]{16,64}$/;
const SECRET = /^[A-Za-z0-9_-]{32,128}$/;

// MCP tokens look like "sm.<spaceId>.<secret>" so the router knows which space to open.
export function parseMcpToken(token: string): { spaceId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'sm' || !SPACE_ID.test(parts[1]) || !SECRET.test(parts[2])) return null;
  return { spaceId: parts[1] };
}

export function isValidSecret(secret: string): boolean {
  return SECRET.test(secret);
}
