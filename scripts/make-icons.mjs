// Renders every app icon from assets/brand/logo.svg (run: node scripts/make-icons.mjs).
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const LOGO = readFileSync('assets/brand/logo.svg', 'utf8');
const inner = LOGO.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const LIGHT_BG = '#FFFFFF';
export const DARK_BG = '#161616';

// Monochrome variants: white fills, cut-out outlines and face (for themed, tinted and notification icons).
const mono = inner
  .replace(/fill="#(86BEF4|FCCF44)"/g, 'fill="#FFFFFF"')
  .replace(/stroke="#111111"/g, 'stroke="#000000"')
  .replace(/fill="#111111"/g, 'fill="#000000"');

// `scale` is the share of the canvas the 512 viewBox takes; the drawing is already centered in it.
function svg({ size = 1024, scale, bg, body = inner, mask = false }) {
  const s = (size * scale) / 512;
  const o = (size - 512 * s) / 2;
  const content = `<g transform="translate(${o} ${o}) scale(${s})">${body}</g>`;
  if (mask) {
    // Draw white shapes, then knock out the black parts so only fills remain (transparent elsewhere).
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs><mask id="m" maskUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="black"/>${content}</mask></defs>
      <rect width="${size}" height="${size}" fill="${bg ?? '#FFFFFF'}" mask="url(#m)"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}${content}</svg>`;
}

function png(path, markup) {
  writeFileSync(path, new Resvg(markup, { background: 'rgba(0,0,0,0)' }).render().asPng());
}

png('assets/icon.png', svg({ scale: 0.86, bg: LIGHT_BG }));
png('assets/icon-dark.png', svg({ scale: 0.86 }));
png('assets/icon-tinted.png', svg({ scale: 0.86, body: mono, mask: true }));
// Adaptive icons are masked to the inner ~66%, so the art stays inside that safe zone.
png('assets/android-icon-foreground.png', svg({ scale: 0.72 }));
png('assets/android-icon-monochrome.png', svg({ scale: 0.72, body: mono, mask: true }));
png('assets/splash-icon.png', svg({ scale: 1 }));
png('assets/notification-icon.png', svg({ size: 96, scale: 1, body: mono, mask: true }));
png('assets/favicon.png', svg({ size: 64, scale: 1, bg: LIGHT_BG }));
for (const old of ['assets/android-icon-background.png', 'assets/logo.png', 'assets/logo-source.jpg']) rmSync(old, { force: true });
console.log('icons written');
