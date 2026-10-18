"""Generates SaveMe's icons from assets/logo-source.jpg (run: python3 scripts/make-icons.py)."""
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

SOURCE = 'assets/logo-source.jpg'
CREAM = (255, 248, 236)


def cut_out(img: Image.Image) -> Image.Image:
    """Removes the flat cream background by flood-filling from the edges, keeping a soft edge."""
    rgb = np.asarray(img.convert('RGB')).astype(np.int32)
    h, w, _ = rgb.shape
    bg = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    outside = np.zeros((h, w), bool)
    queue = deque((y, x) for y in range(h) for x in (0, w - 1)) + deque((y, x) for x in range(w) for y in (0, h - 1))
    while queue:
        y, x = queue.popleft()
        if outside[y, x] or dist[y, x] > 60:
            continue
        outside[y, x] = True
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not outside[ny, nx]:
                queue.append((ny, nx))
    alpha = Image.fromarray(np.where(outside, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    out = img.convert('RGBA')
    out.putalpha(alpha)
    return out.crop(out.getbbox())


def place(logo: Image.Image, size: int, fraction: float, bg=(0, 0, 0, 0)) -> Image.Image:
    """Centers the logo so its longest side takes `fraction` of the canvas."""
    canvas = Image.new('RGBA', (size, size), bg)
    scale = size * fraction / max(logo.size)
    resized = logo.resize((round(logo.width * scale), round(logo.height * scale)), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def silhouette(logo: Image.Image) -> Image.Image:
    """White fills with the black outlines and face cut out, for monochrome and notification icons."""
    rgb = np.asarray(logo.convert('RGB')).astype(np.int32)
    light = (rgb.sum(axis=2) > 330).astype(np.float32)
    alpha = np.asarray(logo.getchannel('A')).astype(np.float32) * light
    white = Image.new('RGBA', logo.size, (255, 255, 255, 255))
    white.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    return white


def main():
    logo = cut_out(Image.open(SOURCE))
    logo.save('assets/logo.png')
    place(logo, 1024, 0.72, CREAM + (255,)).convert('RGB').save('assets/icon.png')
    # Android adaptive icons crop to the inner ~66%, so keep the art inside it.
    place(logo, 1024, 0.62).save('assets/android-icon-foreground.png')
    Image.new('RGBA', (1024, 1024), CREAM + (255,)).save('assets/android-icon-background.png')
    place(silhouette(logo), 1024, 0.62).save('assets/android-icon-monochrome.png')
    place(logo, 1024, 0.9).save('assets/splash-icon.png')
    place(silhouette(logo), 96, 0.84).save('assets/notification-icon.png')
    place(logo, 64, 0.9, CREAM + (255,)).save('assets/favicon.png')


if __name__ == '__main__':
    main()
