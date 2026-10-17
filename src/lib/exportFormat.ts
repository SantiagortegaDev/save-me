// Pure serializers for exporting the library to other apps. Unit-tested in tests/.

export type ExportRow = {
  url: string;
  title: string;
  folder: string;
  tags: string[];
  note: string | null;
  createdAt: number;
};

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: ExportRow[]): string {
  const header = 'url,title,folder,tags,note,created';
  const lines = rows.map((r) =>
    [r.url, r.title, r.folder, r.tags.join(','), r.note ?? '', new Date(r.createdAt).toISOString()].map(csvField).join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Netscape bookmark file: importable by every desktop browser.
export function toNetscapeHtml(rows: ExportRow[]): string {
  const byFolder = new Map<string, ExportRow[]>();
  for (const r of rows) {
    const list = byFolder.get(r.folder) ?? [];
    list.push(r);
    byFolder.set(r.folder, list);
  }
  const parts = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const [folder, list] of byFolder) {
    parts.push(`    <DT><H3>${esc(folder)}</H3>`, '    <DL><p>');
    for (const r of list) {
      const added = Math.floor(r.createdAt / 1000);
      const tags = r.tags.length ? ` TAGS="${esc(r.tags.join(','))}"` : '';
      parts.push(`        <DT><A HREF="${esc(r.url)}" ADD_DATE="${added}"${tags}>${esc(r.title || r.url)}</A>`);
      if (r.note) parts.push(`        <DD>${esc(r.note)}`);
    }
    parts.push('    </DL><p>');
  }
  parts.push('</DL><p>');
  return parts.join('\n') + '\n';
}
