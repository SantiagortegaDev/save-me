// A readable title for an image picked from the gallery, instead of its file name. Unit-tested in tests/.
export function imageTitle(fileName: string | null | undefined): string {
  if (!fileName) return 'Image';
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  // "Screenshot_20261111-120000_Instagram" -> "Screenshot · Instagram"
  const shot = base.match(/^screen[\s_-]?shot(?:[\s_-]+[\d_.-]+)?(?:[\s_-]+(.+))?$/i);
  if (shot) {
    const app = shot[1]?.replace(/[_-]+/g, ' ').trim();
    return app && !/^(\d+|at\b.*)$/i.test(app) ? `Screenshot · ${app}` : 'Screenshot';
  }
  // Camera names, numeric ids and random UUIDs carry no meaning.
  if (/^(img|pxl|dsc|dcim|mvimg|photo|image|vid)[\s_-]*\d/i.test(base) || /^[\d_-]+$/.test(base) || /^[0-9a-f-]{20,}$/i.test(base)) {
    return 'Photo';
  }
  const words = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words ? words.slice(0, 80) : 'Image';
}
