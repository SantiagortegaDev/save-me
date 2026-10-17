"""Generates SaveMe's app icons into assets/ (run: python3 scripts/make-icons.py)."""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'
YELLOW, INK, PAPER, TEAL = (255, 210, 63, 255), (17, 17, 17, 255), (255, 248, 236, 255), (59, 206, 172, 255)


def bookmark(draw, box, fill, outline, width):
    x0, y0, x1, y1 = box
    mid = (x0 + x1) / 2
    notch = y1 - (x1 - x0) * 0.32
    pts = [(x0, y0), (x1, y0), (x1, y1), (mid, notch), (x0, y1)]
    draw.polygon(pts, fill=fill)
    draw.line(pts + [pts[0]], fill=outline, width=width, joint='curve')


def glyph(size, bg, shadow=True, mono=False):
    img = Image.new('RGBA', (size, size), bg)
    d = ImageDraw.Draw(img)
    s = size / 1024
    ink = (255, 255, 255, 255) if mono else INK
    card = (0, 0, 0, 0) if mono else YELLOW
    box = (300 * s, 220 * s, 724 * s, 800 * s)
    if shadow and not mono:
        off = 34 * s
        bookmark(d, (box[0] + off, box[1] + off, box[2] + off, box[3] + off), INK, INK, int(36 * s))
    bookmark(d, box, card, ink, int(36 * s))
    font = ImageFont.truetype(FONT, int(300 * s))
    d.text((512 * s, 440 * s), 'S', font=font, fill=ink, anchor='mm')
    return img


def main():
    icon = Image.new('RGBA', (1024, 1024), PAPER)
    d = ImageDraw.Draw(icon)
    d.rounded_rectangle((40, 40, 984, 984), radius=200, fill=TEAL, outline=INK, width=40)
    icon.alpha_composite(glyph(1024, (0, 0, 0, 0)))
    icon.convert('RGB').save('assets/icon.png')

    glyph(1024, (0, 0, 0, 0)).save('assets/android-icon-foreground.png')
    Image.new('RGBA', (1024, 1024), TEAL).save('assets/android-icon-background.png')
    glyph(1024, (0, 0, 0, 0), mono=True).save('assets/android-icon-monochrome.png')
    glyph(1024, (0, 0, 0, 0)).save('assets/splash-icon.png')
    glyph(1024, (0, 0, 0, 0), mono=True).resize((96, 96)).save('assets/notification-icon.png')
    icon.resize((48, 48)).save('assets/favicon.png')


if __name__ == '__main__':
    sys.exit(main())
