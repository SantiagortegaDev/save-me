import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toCsv, toNetscapeHtml } from '../src/lib/exportFormat';
import { detectAndParse, parseCsv, parseCsvBookmarks, parseJsonBookmarks, parseNetscapeHtml } from '../src/lib/importParse';

test('parseCsv handles quotes, commas and newlines', () => {
  const rows = parseCsv('a,b\n"x, y","say ""hi""\nthere"\n');
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['x, y', 'say "hi"\nthere'],
  ]);
  assert.throws(() => parseCsv('"open'));
});

test('Pocket-style CSV export', () => {
  const csv = 'title,url,time_added,tags,status\nGreat read,https://a.com/1,1700000000,dev|js,unread\n,not a url,1,,\n';
  const links = parseCsvBookmarks(csv);
  assert.equal(links.length, 1);
  assert.equal(links[0].url, 'https://a.com/1');
  assert.equal(links[0].title, 'Great read');
  assert.deepEqual(links[0].tags, ['dev', 'js']);
  assert.equal(links[0].createdAt, 1700000000 * 1000);
});

test('Raindrop-style CSV with folders', () => {
  const csv = 'id,title,note,excerpt,url,folder,tags,created\n1,Kyoto,go early,,https://kyoto.example,Travel,"japan, trip",2024-05-01T10:00:00Z\n';
  const [link] = parseCsvBookmarks(csv);
  assert.equal(link.folder, 'Travel');
  assert.equal(link.note, 'go early');
  assert.deepEqual(link.tags, ['japan', 'trip']);
  assert.equal(link.createdAt, Date.parse('2024-05-01T10:00:00Z'));
});

test('CSV without header picks the URL column', () => {
  const links = parseCsvBookmarks('https://one.example,One\nhttps://two.example,Two\n');
  assert.deepEqual(
    links.map((l) => l.url),
    ['https://one.example/', 'https://two.example/'],
  );
});

test('Netscape bookmarks keep folder names', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://top.example" ADD_DATE="1600000000">Top</A>
    <DT><H3>Recipes</H3>
    <DL><p>
      <DT><A HREF="https://pasta.example/?a=1&amp;b=2" TAGS="food,quick">Pasta &amp; more</A>
      <DD>Try on Sunday
    </DL><p>
    <DT><A HREF="https://after.example">After</A>
  </DL><p>
</DL><p>`;
  const links = parseNetscapeHtml(html);
  assert.equal(links.length, 3);
  assert.equal(links[0].folder, null);
  assert.equal(links[0].createdAt, 1600000000 * 1000);
  assert.equal(links[1].folder, 'Recipes');
  assert.equal(links[1].url, 'https://pasta.example/?a=1&b=2');
  assert.equal(links[1].title, 'Pasta & more');
  assert.deepEqual(links[1].tags, ['food', 'quick']);
  assert.equal(links[1].note, 'Try on Sunday');
  assert.equal(links[2].folder, null);
});

test('generic JSON exports', () => {
  const json = JSON.stringify({ items: [{ link: 'https://j.example', title: 'J', tags: [{ name: 'x' }, 'y'], created: 1700000000123 }, { nope: 1 }] });
  const links = parseJsonBookmarks(json);
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].tags, ['x', 'y']);
  assert.equal(links[0].createdAt, 1700000000123);
});

test('detectAndParse routes by content', () => {
  assert.equal(detectAndParse('export.txt', '[{"url":"https://a.example"}]').length, 1);
  assert.equal(detectAndParse('bookmarks.html', '<DL><DT><A HREF="https://b.example">B</A></DL>').length, 1);
  assert.equal(detectAndParse('pocket.csv', 'url,title\nhttps://c.example,C\n').length, 1);
});

test('exports round-trip through the importers', () => {
  const rows = [
    { url: 'https://a.example/', title: 'A, "quoted"', folder: 'Reading', tags: ['one', 'two'], note: 'line1\nline2', createdAt: 1700000000000 },
    { url: 'https://b.example/', title: 'B & C', folder: 'Inbox', tags: [], note: null, createdAt: 1600000000000 },
  ];
  const fromCsv = parseCsvBookmarks(toCsv(rows));
  assert.equal(fromCsv[0].title, 'A, "quoted"');
  assert.equal(fromCsv[0].note, 'line1\nline2');
  assert.deepEqual(fromCsv[0].tags, ['one', 'two']);
  assert.equal(fromCsv[0].folder, 'Reading');

  const fromHtml = parseNetscapeHtml(toNetscapeHtml(rows));
  assert.equal(fromHtml.length, 2);
  assert.equal(fromHtml[1].title, 'B & C');
  assert.equal(fromHtml[1].folder, 'Inbox');
  assert.equal(fromHtml[0].createdAt, 1700000000000);
});
