#!/usr/bin/env python3
"""
Draws the Ironwyrm brand mark and every icon the stores and platforms need.

    python3 scripts/build-icons.py

The mark is a kettlebell whose handle grows dragon horns, with a slit dragon
eye glowing in the bell. Everything is drawn in code with Pillow at 4x size and
downsampled, so there are no source files or licenses to track.

Outputs:
  assets/images/icon.png                     1024 app icon (iOS, web manifest)
  assets/images/android-icon-foreground.png  adaptive icon foreground, safe zone
  assets/images/android-icon-background.png  adaptive icon background
  assets/images/android-icon-monochrome.png  themed icon (Android 13+)
  assets/images/notification-icon.png        white status bar icon
  assets/images/splash-icon.png              splash mark on transparent
  assets/images/favicon.png                  web favicon
  store/play-icon-512.png                    Play Console hi-res icon
  store/feature-graphic.png                  Play Console feature graphic 1024x500
"""
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMAGES = os.path.join(ROOT, 'assets', 'images')
STORE = os.path.join(ROOT, 'store')
FONT = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'grenze-gotisch', '800ExtraBold', 'GrenzeGotisch_800ExtraBold.ttf')

ABYSS = (11, 17, 16)
TORCH = (242, 169, 59)
TORCH_HIGH = (255, 210, 122)
TORCH_DEEP = (150, 92, 18)
EMBER = (232, 85, 62)
S = 4  # supersampling factor


def hex_gradient(size, top, bottom):
    """Vertical gradient image."""
    w, h = size
    grad = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        grad.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return grad.resize((w, h))


def radial(size, center, radius, inner, outer, inner_alpha=255, outer_alpha=0):
    """Radial RGBA gradient."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.clip(np.hypot(xx - center[0], yy - center[1]) / radius, 0, 1)[..., None]
    rgb = np.array(inner) + (np.array(outer) - np.array(inner)) * d
    alpha = inner_alpha + (outer_alpha - inner_alpha) * d
    return Image.fromarray(np.concatenate([rgb, alpha], axis=2).round().astype(np.uint8), 'RGBA')


def bezier(p0, p1, p2, steps=40):
    return [
        (
            (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
        )
        for t in (i / steps for i in range(steps + 1))
    ]


def mark_masks(size):
    """Masks (L mode) for the parts of the mark, drawn in a 1024 design space scaled to `size`."""
    k = size / 1024

    def P(x, y):
        return (x * k, y * k)

    def new():
        return Image.new('L', (size, size), 0)

    # Handle: thick upper arc.
    handle = new()
    d = ImageDraw.Draw(handle)
    # Narrower than the bell, so the handle's ends land inside its shoulders.
    cx, cy, r, w = 512, 470, 150, 70
    d.arc([P(cx - r - w / 2, cy - r - w / 2), P(cx + r + w / 2, cy + r + w / 2)], 180, 360, fill=255, width=round(w * k))

    # Horns sprouting from the handle shoulders.
    horns = new()
    d = ImageDraw.Draw(horns)
    for side in (-1, 1):
        def sx(x):
            return 512 + side * (x - 512)
        outer = bezier((sx(352), 384), (sx(212), 270), (sx(232), 66))
        inner = bezier((sx(232), 66), (sx(300), 212), (sx(424), 312))
        d.polygon([P(*pt) for pt in outer + inner], fill=255)

    # Bell body, and the iron face inside its gold rim. The base is flat like a real kettlebell.
    bx, by, br, rim = 512, 648, 262, 24
    bell = new()
    d = ImageDraw.Draw(bell)
    d.ellipse([P(bx - br, by - br), P(bx + br, by + br)], fill=255)
    d.rectangle([P(0, by + br - 36), P(1024, 1024)], fill=0)
    bell_inner = new()
    d = ImageDraw.Draw(bell_inner)
    d.ellipse([P(bx - br + rim, by - br + rim), P(bx + br - rim, by + br - rim)], fill=255)
    d.rectangle([P(0, by + br - 36 - rim), P(1024, 1024)], fill=0)

    # Eye: a vesica (two overlapping circles) with a slit pupil.
    eye = new()
    d = ImageDraw.Draw(eye)
    ex, ey, ew, eh = 512, 640, 330, 150
    rr = (ew ** 2 / 4 + eh ** 2 / 4) / eh  # circle radius giving that lens
    a = Image.new('L', (size, size), 0)
    b = Image.new('L', (size, size), 0)
    ImageDraw.Draw(a).ellipse([P(ex - rr, ey - eh / 2), P(ex + rr, ey - eh / 2 + 2 * rr)], fill=255)
    ImageDraw.Draw(b).ellipse([P(ex - rr, ey + eh / 2 - 2 * rr), P(ex + rr, ey + eh / 2)], fill=255)
    eye = ImageChops.multiply(a, b)

    pupil = new()
    ImageDraw.Draw(pupil).ellipse([P(ex - 20, ey - 66), P(ex + 20, ey + 66)], fill=255)
    return {'handle': handle, 'horns': horns, 'bell': bell, 'bell_inner': bell_inner, 'eye': eye, 'pupil': pupil}


def draw_mark(size, glow=True):
    """Full color mark on a transparent canvas."""
    big = size * S
    m = mark_masks(big)
    out = Image.new('RGBA', (big, big), (0, 0, 0, 0))

    metal = m['handle'].copy()
    metal.paste(255, mask=m['horns'])
    gold = hex_gradient((big, big), TORCH_HIGH, TORCH_DEEP).convert('RGBA')
    out.paste(gold, mask=metal)

    # Bell: dark iron with a gold rim.
    out.paste(gold, mask=m['bell'])
    inner = m['bell_inner']
    iron = hex_gradient((big, big), (58, 64, 60), (16, 20, 18)).convert('RGBA')
    out.paste(iron, mask=inner)

    if glow:
        halo = Image.new('RGBA', (big, big), (255, 120, 50, 0))
        halo.putalpha(m['eye'].filter(ImageFilter.GaussianBlur(big * 0.03)).point(lambda v: min(255, int(v * 1.6))))
        halo_mask = ImageChops.multiply(halo.getchannel('A'), inner)
        out.paste(Image.new('RGBA', (big, big), (255, 120, 50, 255)), mask=halo_mask.point(lambda v: v * 0.7))

    iris = radial((big, big), (big / 2, big * 0.625), big * 0.17, TORCH_HIGH, EMBER)
    out.paste(iris, mask=m['eye'])
    out.paste(Image.new('RGBA', (big, big), (12, 6, 4, 255)), mask=m['pupil'])
    # A catchlight keeps the eye alive.
    k = big / 1024
    ImageDraw.Draw(out).ellipse([(560 * k, 604 * k), (582 * k, 626 * k)], fill=(255, 240, 210, 230))
    return out.resize((size, size), Image.LANCZOS)


def silhouette(size, scale=1.0):
    """White mark with the eye cut out, for monochrome and notification icons."""
    big = size * S
    m = mark_masks(big)
    shape = m['handle'].copy()
    shape.paste(255, mask=m['horns'])
    shape.paste(255, mask=m['bell'])
    shape.paste(0, mask=m['eye'])
    shape.paste(255, mask=m['pupil'])
    img = Image.new('RGBA', (big, big), (255, 255, 255, 0))
    img.putalpha(shape)
    img = img.resize((size, size), Image.LANCZOS)
    if scale != 1.0:
        inner = img.resize((round(size * scale), round(size * scale)), Image.LANCZOS)
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        img.paste(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
    return img


def background(size):
    bg = Image.new('RGBA', (size, size), (*ABYSS, 255))
    glow = radial((size // 4, size // 4), (size / 8, size * 0.6 / 4), size * 0.62 / 4, (110, 70, 20), ABYSS, 255, 255)
    bg.paste(glow.resize((size, size), Image.BICUBIC), (0, 0))
    return bg


def centered(mark, size, scale):
    inner = mark.resize((round(size * scale), round(size * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(inner, ((size - inner.width) // 2, (size - inner.height) // 2), inner)
    return canvas


def main():
    os.makedirs(IMAGES, exist_ok=True)
    os.makedirs(STORE, exist_ok=True)
    mark = draw_mark(1024)

    icon = background(1024)
    icon.alpha_composite(centered(mark, 1024, 0.84))
    icon.convert('RGB').save(os.path.join(IMAGES, 'icon.png'), optimize=True)
    icon.convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(STORE, 'play-icon-512.png'), optimize=True)
    icon.convert('RGB').resize((48, 48), Image.LANCZOS).save(os.path.join(IMAGES, 'favicon.png'), optimize=True)

    # Adaptive icon: launchers mask to a circle or squircle inside the middle 66%.
    centered(mark, 1024, 0.6).save(os.path.join(IMAGES, 'android-icon-foreground.png'), optimize=True)
    background(1024).convert('RGB').save(os.path.join(IMAGES, 'android-icon-background.png'), optimize=True)
    silhouette(1024, 0.6).save(os.path.join(IMAGES, 'android-icon-monochrome.png'), optimize=True)
    silhouette(96, 0.92).save(os.path.join(IMAGES, 'notification-icon.png'), optimize=True)
    centered(mark, 512, 0.95).save(os.path.join(IMAGES, 'splash-icon.png'), optimize=True)

    # Feature graphic: mark on the left, wordmark and promise on the right.
    fg = Image.new('RGBA', (1024, 500), (*ABYSS, 255))
    glow = radial((256, 125), (70, 62), 130, (120, 72, 18), ABYSS, 255, 255)
    fg.paste(glow.resize((1024, 500), Image.BICUBIC), (0, 0))
    fg.alpha_composite(mark.resize((400, 400), Image.LANCZOS), (60, 50))
    title = ImageFont.truetype(FONT, 132)
    tagline = ImageFont.truetype(FONT, 46)
    d = ImageDraw.Draw(fg)
    # Blackletter capital I reads like a J, so the initial is drawn as a sword.
    x0, top, base = 500, 150, 262
    cap = base - top
    gold = (*TORCH_HIGH, 255)
    blade_w = cap * 0.15
    d.polygon([(x0 - blade_w / 2, top + cap * 0.3), (x0 + blade_w / 2, top + cap * 0.3), (x0 + blade_w / 2, base - cap * 0.12), (x0, base + cap * 0.08), (x0 - blade_w / 2, base - cap * 0.12)], fill=gold)
    d.rectangle([(x0 - cap * 0.3, top + cap * 0.2), (x0 + cap * 0.3, top + cap * 0.3)], fill=gold)
    d.rectangle([(x0 - blade_w * 0.35, top + cap * 0.04), (x0 + blade_w * 0.35, top + cap * 0.2)], fill=gold)
    d.polygon([(x0, top - cap * 0.1), (x0 + cap * 0.09, top + cap * 0.02), (x0, top + cap * 0.14), (x0 - cap * 0.09, top + cap * 0.02)], fill=gold)
    d.text((x0 + cap * 0.36, base), 'ronwyrm', font=title, fill=gold, anchor='ls')
    d.text((494, 330), 'Train. Loot. Slay the dragon.', font=tagline, fill=(238, 230, 211, 255), anchor='ls')
    fg.convert('RGB').save(os.path.join(STORE, 'feature-graphic.png'), optimize=True)
    print('icons written')


if __name__ == '__main__':
    main()
