// Pure helper for shareState; unit-tested in tests/.
type Payload = { value?: string | null; mimeType?: string | null; shareType?: string | null };

// Order-independent fingerprint of what was shared. Empty when nothing was shared.
export function shareSignature(payloads: readonly Payload[]): string {
  return payloads
    .map((p) => `${p.shareType ?? ''}|${p.mimeType ?? ''}|${p.value ?? ''}`)
    .sort()
    .join('\n');
}
