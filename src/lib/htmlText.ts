// Decodes fetched pages in their declared character set. Many older sites (Spanish ones included) still
// serve ISO-8859-1 / Windows-1252, which read as UTF-8 turns "Canción" into "Canci�n". Unit-tested in tests/.

// Windows-1252 differs from ISO-8859-1 only in 0x80-0x9F (curly quotes, euro sign, dashes...).
const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6,
  0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c,
  0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

export function charsetOf(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = contentType?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  // <meta charset="..."> or <meta http-equiv="Content-Type" content="text/html; charset=...">, near the top.
  let head = '';
  for (let i = 0; i < Math.min(bytes.length, 4096); i++) head += String.fromCharCode(bytes[i]);
  return head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? 'utf-8';
}

function decodeSingleByte(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = Array.from(bytes.subarray(i, i + 8192), (b) => CP1252[b] ?? b);
    out += String.fromCharCode(...chunk);
  }
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  // Fallback for engines without TextDecoder; invalid sequences become U+FFFD.
  const codes: number[] = [];
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    const need = b < 0x80 ? 0 : b >= 0xf0 && b < 0xf8 ? 3 : b >= 0xe0 ? 2 : b >= 0xc2 && b < 0xe0 ? 1 : -1;
    let cp = need === 0 ? b : need === 1 ? b & 0x1f : need === 2 ? b & 0x0f : b & 0x07;
    let ok = need >= 0 && i + need < bytes.length + (need === 0 ? 1 : 0);
    for (let k = 1; ok && k <= need; k++) {
      const c = bytes[i + k];
      if ((c & 0xc0) !== 0x80) ok = false;
      else cp = (cp << 6) | (c & 0x3f);
    }
    if (!ok) {
      codes.push(0xfffd);
      i += 1;
    } else {
      if (cp > 0xffff) {
        cp -= 0x10000;
        codes.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      } else codes.push(cp);
      i += need + 1;
    }
    if (codes.length > 8000) {
      out += String.fromCharCode(...codes);
      codes.length = 0;
    }
  }
  return out + String.fromCharCode(...codes);
}

export function decodeHtmlBytes(bytes: Uint8Array, contentType: string | null): string {
  const charset = charsetOf(contentType, bytes);
  if (/^(iso-8859-1|iso-8859-15|latin-?1|windows-1252|cp1252|us-ascii|ascii)$/.test(charset)) return decodeSingleByte(bytes);
  return decodeUtf8(bytes);
}

export async function readHtml(res: Response): Promise<string> {
  try {
    return decodeHtmlBytes(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type'));
  } catch {
    return '';
  }
}
