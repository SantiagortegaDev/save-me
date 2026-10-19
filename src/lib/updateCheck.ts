// Pure helpers for the in-app update check. Unit-tested in tests/.

export type Release = { version: string; notes: string; apkUrl: string | null; pageUrl: string };

type GitHubRelease = {
  tag_name?: string;
  body?: string | null;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name?: string; browser_download_url?: string }[];
};

function parts(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((p) => parseInt(p, 10) || 0);
}

// 1 when a is newer than b, -1 when older, 0 when equal.
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function parseRelease(json: GitHubRelease): Release | null {
  if (!json.tag_name || json.draft || json.prerelease) return null;
  const apk = (json.assets ?? []).find((a) => a.name?.toLowerCase().endsWith('.apk') && a.browser_download_url);
  return {
    version: json.tag_name.replace(/^v/i, ''),
    notes: (json.body ?? '').trim(),
    apkUrl: apk?.browser_download_url ?? null,
    pageUrl: json.html_url ?? '',
  };
}

// Release notes trimmed to something that fits a dialog: markdown markers removed, a few lines kept.
export function shortNotes(notes: string, maxLines = 8): string {
  const lines = notes
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^#+\s*/, '')
        .replace(/^\s*[-*]\s+/, '• ')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim(),
    )
    .filter(Boolean);
  return lines.length > maxLines ? `${lines.slice(0, maxLines).join('\n')}\n…` : lines.join('\n');
}
