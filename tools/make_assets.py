#!/usr/bin/env python3
"""사무실 그림(assets/office.png), 캐릭터 스프라이트(assets/sprite.png, 4x3),
좌표표(assets/layout.json)를 만든다.

    python3 tools/make_assets.py

그림을 직접 그린 것으로 바꾸고 싶으면 같은 크기/같은 좌표계로 덮어쓰면 된다.
layout.json 의 tile/origin 값이 화면 좌표 계산의 기준이다.
"""
import json
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")

# ---------------------------------------------------------------- office
W, H = 1200, 660          # 최종 그림 크기
SS = 2                    # 슈퍼샘플링 배율
TW, TH = 72, 36           # 타일 1칸의 화면 폭/높이
GX, GY = 12, 10           # 방 크기 (타일)
WALL = 170                # 벽 높이(px)
OX = W / 2 - (GX - GY) * TW / 4
OY = 215

DESKS = [(x, y) for x in (2.6, 5.0, 7.4) for y in (1.6, 4.3, 7.0)] + \
        [(10.8, y) for y in (1.6, 4.3, 7.0)]
ELEVATOR_Y = (4.2, 5.8)       # 왼쪽 벽 엘리베이터 범위
DOOR_X = (8.3, 9.7)           # 오른쪽 벽 문(대표실 문) 범위


def P(x, y, z=0):
    return ((OX + (x - y) * TW / 2) * SS, (OY + (x + y) * TH / 2 - z) * SS)


def poly(d, pts, fill, outline=None, width=1):
    d.polygon([P(*p) for p in pts], fill=fill)
    if outline:
        q = [P(*p) for p in pts]
        d.line(q + [q[0]], fill=outline, width=width * SS, joint="curve")


def box(d, x0, y0, x1, y1, z0, z1, top, left, right, edge=None):
    poly(d, [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], left, edge)
    poly(d, [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], right, edge)
    poly(d, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top, edge)


def office():
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    edge = (60, 52, 46, 255)

    # 바닥
    poly(d, [(0, 0), (GX, 0), (GX, GY), (0, GY)], (214, 184, 146, 255))
    for i in range(1, GX):
        d.line([P(i, 0), P(i, GY)], fill=(196, 165, 128, 255), width=SS)
    for j in range(1, GY):
        d.line([P(0, j), P(GX, j)], fill=(196, 165, 128, 255), width=SS)
    # 바닥 두께
    poly(d, [(0, GY, 0), (GX, GY, 0), (GX, GY, -14), (0, GY, -14)], (150, 118, 86, 255))
    poly(d, [(GX, 0, 0), (GX, GY, 0), (GX, GY, -14), (GX, 0, -14)], (126, 98, 70, 255))

    # 벽
    poly(d, [(0, 0, 0), (0, GY, 0), (0, GY, WALL), (0, 0, WALL)], (236, 230, 218, 255))
    poly(d, [(0, 0, 0), (GX, 0, 0), (GX, 0, WALL), (0, 0, WALL)], (222, 214, 200, 255))
    # 걸레받이
    poly(d, [(0, 0, 0), (0, GY, 0), (0, GY, 10), (0, 0, 10)], (170, 150, 128, 255))
    poly(d, [(0, 0, 0), (GX, 0, 0), (GX, 0, 10), (0, 0, 10)], (160, 140, 118, 255))
    # 벽 윗면 두께
    poly(d, [(0, 0, WALL), (0, GY, WALL), (-0.25, GY + 0.25, WALL), (-0.25, -0.25, WALL)],
         (120, 108, 96, 255))
    poly(d, [(0, 0, WALL), (GX, 0, WALL), (GX + 0.25, -0.25, WALL), (-0.25, -0.25, WALL)],
         (132, 120, 108, 255))

    # 창문 (오른쪽 벽)
    for xa in (1.0, 3.2, 5.4):
        xb = xa + 1.7
        poly(d, [(xa, 0, 55), (xb, 0, 55), (xb, 0, 145), (xa, 0, 145)], (150, 196, 230, 255), edge, 2)
        mid = (xa + xb) / 2
        d.line([P(mid, 0, 55), P(mid, 0, 145)], fill=edge, width=2 * SS)
        d.line([P(xa, 0, 100), P(xb, 0, 100)], fill=edge, width=2 * SS)
        poly(d, [(xa + 0.15, 0, 110), (xa + 0.45, 0, 110), (xa + 0.35, 0, 140), (xa + 0.05, 0, 140)],
             (210, 234, 250, 255))

    # 문 (오른쪽 벽) – 맨 위층에선 대표실 문
    xa, xb = DOOR_X
    poly(d, [(xa - 0.1, 0, 0), (xb + 0.1, 0, 0), (xb + 0.1, 0, 132), (xa - 0.1, 0, 132)], (92, 70, 52, 255))
    poly(d, [(xa, 0, 0), (xb, 0, 0), (xb, 0, 124), (xa, 0, 124)], (150, 104, 66, 255), edge, 2)
    poly(d, [(xa + 0.15, 0, 70), (xb - 0.15, 0, 70), (xb - 0.15, 0, 112), (xa + 0.15, 0, 112)],
         (132, 90, 56, 255))
    kx, ky = P(xb - 0.25, 0, 58)
    d.ellipse([kx - 4 * SS, ky - 4 * SS, kx + 4 * SS, ky + 4 * SS], fill=(232, 196, 90, 255))

    # 엘리베이터 (왼쪽 벽)
    ya, yb = ELEVATOR_Y
    poly(d, [(0, ya - 0.2, 0), (0, yb + 0.2, 0), (0, yb + 0.2, 138), (0, ya - 0.2, 138)], (120, 124, 132, 255))
    ym = (ya + yb) / 2
    poly(d, [(0, ya, 0), (0, ym, 0), (0, ym, 126), (0, ya, 126)], (190, 196, 206, 255), edge, 2)
    poly(d, [(0, ym, 0), (0, yb, 0), (0, yb, 126), (0, ym, 126)], (178, 184, 196, 255), edge, 2)
    poly(d, [(0, ym - 0.35, 146), (0, ym + 0.35, 146), (0, ym + 0.35, 162), (0, ym - 0.35, 162)],
         (40, 40, 48, 255))
    # 호출 버튼
    bx, by = P(0, yb + 0.45, 62)
    d.ellipse([bx - 5 * SS, by - 5 * SS, bx + 5 * SS, by + 5 * SS], fill=(240, 200, 90, 255), outline=edge)

    objs = []
    # 커피 머신 (왼쪽 벽, 안쪽)
    objs.append((8.4, lambda: (
        box(d, 0.15, 8.0, 0.95, 8.8, 0, 46, (110, 110, 118, 255), (80, 80, 88, 255), (64, 64, 72, 255), edge),
        box(d, 0.25, 8.15, 0.85, 8.65, 46, 82, (60, 60, 66, 255), (44, 44, 50, 255), (36, 36, 42, 255), edge),
        poly(d, [(0.4, 8.65, 58), (0.7, 8.65, 58), (0.7, 8.65, 74), (0.4, 8.65, 74)], (230, 120, 70, 255)),
    )))
    # 화분
    def plant(x, y):
        def f():
            box(d, x - 0.25, y - 0.25, x + 0.25, y + 0.25, 0, 22,
                (200, 120, 80, 255), (176, 98, 62, 255), (150, 82, 50, 255), edge)
            cx, cy = P(x, y, 44)
            for dx, dy, r in ((0, 0, 20), (-12, 8, 14), (12, 8, 14), (0, -14, 13)):
                d.ellipse([cx + (dx - r) * SS, cy + (dy - r) * SS, cx + (dx + r) * SS, cy + (dy + r) * SS],
                          fill=(76, 150, 86, 255), outline=(48, 104, 58, 255), width=SS)
        return f
    objs.append((0.8, plant(0.5, 0.5)))
    objs.append((GX - 0.5 + 0.5, plant(GX - 0.5, 0.5)))
    objs.append((GY - 0.5 + 0.5, plant(0.5, GY - 0.5)))

    # 책상
    for (cx, cy) in DESKS:
        def desk(cx=cx, cy=cy):
            x0, x1, y0, y1 = cx - 0.6, cx + 0.6, cy - 0.4, cy + 0.4
            for (lx, ly) in ((x0 + 0.06, y0 + 0.06), (x1 - 0.12, y0 + 0.06), (x0 + 0.06, y1 - 0.12), (x1 - 0.12, y1 - 0.12)):
                box(d, lx, ly, lx + 0.06, ly + 0.06, 0, 30, (90, 70, 56, 255), (90, 70, 56, 255), (70, 54, 44, 255))
            box(d, x0, y0, x1, y1, 30, 36, (238, 222, 196, 255), (196, 172, 140, 255), (176, 152, 120, 255), edge)
            # 모니터 (사람 쪽 = +y 를 향함)
            box(d, cx - 0.06, cy - 0.22, cx + 0.06, cy - 0.14, 36, 44, (60, 60, 66, 255), (50, 50, 56, 255), (40, 40, 46, 255))
            box(d, cx - 0.42, cy - 0.24, cx + 0.42, cy - 0.16, 44, 74, (52, 52, 60, 255), (36, 36, 44, 255), (30, 30, 36, 255), edge)
            poly(d, [(cx - 0.36, cy - 0.16, 48), (cx + 0.36, cy - 0.16, 48), (cx + 0.36, cy - 0.16, 70), (cx - 0.36, cy - 0.16, 70)],
                 (120, 190, 240, 255))
            # 키보드
            box(d, cx - 0.3, cy + 0.05, cx + 0.3, cy + 0.22, 36, 38, (90, 90, 98, 255), (70, 70, 78, 255), (60, 60, 68, 255))
        objs.append((cx + cy, desk))

    for _, f in sorted(objs, key=lambda o: o[0]):
        f()

    img = img.resize((W, H), Image.LANCZOS)
    img.save(os.path.join(OUT, "office.png"), optimize=True)


# ---------------------------------------------------------------- sprite
FW, FH = 96, 120     # 프레임 크기 (최종)
K = 4                # 그리기 배율
SKIN = (242, 201, 160, 255)
HAIR = (59, 42, 32, 255)
SHIRT = (74, 123, 208, 255)
SHIRT_D = (52, 92, 166, 255)
PANTS = (57, 65, 79, 255)
SHOE = (34, 34, 40, 255)
LINE = (40, 32, 28, 255)


def frame(pose, k):
    im = Image.new("RGBA", (FW * K, FH * K), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def s(*v):
        return [a * K for a in v]

    def limb(p, q, w, c):
        d.line(s(*p, *q), fill=c, width=w * K)
        r = w / 2
        for (x, y) in (p, q):
            d.ellipse(s(x - r, y - r, x + r, y + r), fill=c)

    def head(cx, cy, eyes="open", mouth="smile", tilt=0):
        d.ellipse(s(cx - 21, cy - 21, cx + 21, cy + 21), fill=SKIN, outline=LINE, width=2 * K)
        d.chord(s(cx - 22 + tilt, cy - 23, cx + 22 + tilt, cy + 12), 180, 360, fill=HAIR)
        d.ellipse(s(cx - 22 + tilt, cy - 16, cx - 12 + tilt, cy + 2), fill=HAIR)
        d.ellipse(s(cx - 21, cy - 21, cx + 21, cy + 21), outline=LINE, width=2 * K)
        ex = 8
        if eyes == "open":
            for sx in (-ex, ex):
                d.ellipse(s(cx + sx - 2.6 + tilt / 2, cy + 3, cx + sx + 2.6 + tilt / 2, cy + 9), fill=LINE)
        else:
            for sx in (-ex, ex):
                d.line(s(cx + sx - 4 + tilt / 2, cy + 6, cx + sx + 4 + tilt / 2, cy + 7), fill=LINE, width=2 * K)
        d.ellipse(s(cx - 16, cy + 9, cx - 10, cy + 13), fill=(240, 160, 150, 160))
        d.ellipse(s(cx + 10, cy + 9, cx + 16, cy + 13), fill=(240, 160, 150, 160))
        if mouth == "smile":
            d.arc(s(cx - 5, cy + 8, cx + 5, cy + 16), 20, 160, fill=LINE, width=2 * K)
        elif mouth == "open":
            d.ellipse(s(cx - 5, cy + 10, cx + 5, cy + 18), fill=(150, 50, 50, 255), outline=LINE, width=K)
        elif mouth == "flat":
            d.line(s(cx - 4, cy + 14, cx + 4, cy + 14), fill=LINE, width=2 * K)
        elif mouth == "o":
            d.ellipse(s(cx - 2.5, cy + 12, cx + 2.5, cy + 16), outline=LINE, width=K)

    def torso(cx, top, bottom):
        d.rounded_rectangle(s(cx - 16, top, cx + 16, bottom), radius=9 * K, fill=SHIRT, outline=LINE, width=2 * K)
        d.line(s(cx, top + 3, cx, bottom - 4), fill=SHIRT_D, width=K)

    cx = 48
    if pose == "walk":
        bob = (0, -2, 0, -2)[k]
        sw = (6, 0, -6, 0)[k]
        top = 60 + bob
        limb((cx - 7, 90 + bob), (cx - 7 - sw, 112), 9, PANTS)
        limb((cx + 7, 90 + bob), (cx + 7 + sw, 112), 9, PANTS)
        d.ellipse(s(cx - 7 - sw - 6, 108, cx - 7 - sw + 6, 116), fill=SHOE)
        d.ellipse(s(cx + 7 + sw - 6, 108, cx + 7 + sw + 6, 116), fill=SHOE)
        torso(cx, top, 94 + bob)
        limb((cx - 15, top + 8), (cx - 19 + sw, top + 30), 7, SHIRT)
        limb((cx + 15, top + 8), (cx + 19 - sw, top + 30), 7, SHIRT)
        d.ellipse(s(cx - 23 + sw, top + 27, cx - 15 + sw, top + 35), fill=SKIN, outline=LINE, width=K)
        d.ellipse(s(cx + 15 - sw, top + 27, cx + 23 - sw, top + 35), fill=SKIN, outline=LINE, width=K)
        head(cx, 38 + bob)
    elif pose == "type":
        # 앉아서 무릎 위 노트북으로 타자
        top = 66
        limb((cx - 8, 96), (cx - 12, 112), 9, PANTS)
        limb((cx + 8, 96), (cx + 12, 112), 9, PANTS)
        d.ellipse(s(cx - 19, 108, cx - 5, 116), fill=SHOE)
        d.ellipse(s(cx + 5, 108, cx + 19, 116), fill=SHOE)
        d.rounded_rectangle(s(cx - 20, 90, cx + 20, 100), radius=4 * K, fill=PANTS)
        torso(cx, top, 98)
        head(cx, 44, mouth="flat")
        # 노트북
        d.polygon(s(cx - 22, 96, cx + 22, 96, cx + 26, 104, cx - 26, 104), fill=(170, 174, 184, 255), outline=LINE)
        d.polygon(s(cx - 20, 78, cx + 20, 78, cx + 22, 96, cx - 22, 96), fill=(110, 116, 128, 255), outline=LINE)
        d.ellipse(s(cx - 3, 84, cx + 3, 90), fill=(220, 224, 232, 255))
        hy = (0, 3)[k]
        d.ellipse(s(cx - 20, 92 + hy, cx - 11, 100 + hy), fill=SKIN, outline=LINE, width=K)
        d.ellipse(s(cx + 11, 92 + (3 - hy), cx + 20, 100 + (3 - hy)), fill=SKIN, outline=LINE, width=K)
    elif pose == "cheer":
        up = (0, -7)[k]
        top = 60 + up
        limb((cx - 7, 90 + up), (cx - 9, 112 + up), 9, PANTS)
        limb((cx + 7, 90 + up), (cx + 9, 112 + up), 9, PANTS)
        d.ellipse(s(cx - 15, 108 + up, cx - 3, 116 + up), fill=SHOE)
        d.ellipse(s(cx + 3, 108 + up, cx + 15, 116 + up), fill=SHOE)
        torso(cx, top, 94 + up)
        limb((cx - 14, top + 6), (cx - 28, top - 22), 7, SHIRT)
        limb((cx + 14, top + 6), (cx + 28, top - 22), 7, SHIRT)
        d.ellipse(s(cx - 33, top - 28, cx - 23, top - 18), fill=SKIN, outline=LINE, width=K)
        d.ellipse(s(cx + 23, top - 28, cx + 33, top - 18), fill=SKIN, outline=LINE, width=K)
        head(cx, 38 + up, mouth="open")
    elif pose in ("stand", "doze"):
        top = 60
        limb((cx - 7, 90), (cx - 8, 112), 9, PANTS)
        limb((cx + 7, 90), (cx + 8, 112), 9, PANTS)
        d.ellipse(s(cx - 14, 108, cx - 2, 116), fill=SHOE)
        d.ellipse(s(cx + 2, 108, cx + 14, 116), fill=SHOE)
        torso(cx, top, 94)
        limb((cx - 15, top + 8), (cx - 19, top + 30), 7, SHIRT)
        d.ellipse(s(cx - 23, top + 27, cx - 15, top + 35), fill=SKIN, outline=LINE, width=K)
        if pose == "stand":
            # 오른손은 가슴 앞 (커피잔 자리)
            limb((cx + 15, top + 8), (cx + 18, top + 22), 7, SHIRT)
            d.ellipse(s(cx + 13, top + 18, cx + 22, top + 27), fill=SKIN, outline=LINE, width=K)
            head(cx, 38)
        else:
            limb((cx + 15, top + 8), (cx + 19, top + 30), 7, SHIRT)
            d.ellipse(s(cx + 15, top + 27, cx + 23, top + 35), fill=SKIN, outline=LINE, width=K)
            head(cx + 3, 41, eyes="closed", mouth="o", tilt=2)
    elif pose == "squat":
        b = (0, 1)[k]
        limb((cx - 9, 98), (cx - 16, 104), 10, PANTS)
        limb((cx + 9, 98), (cx + 16, 104), 10, PANTS)
        limb((cx - 16, 104), (cx - 12, 113), 9, PANTS)
        limb((cx + 16, 104), (cx + 12, 113), 9, PANTS)
        d.ellipse(s(cx - 19, 109, cx - 5, 117), fill=SHOE)
        d.ellipse(s(cx + 5, 109, cx + 19, 117), fill=SHOE)
        torso(cx, 74 + b, 104)
        limb((cx - 14, 80 + b), (cx - 15, 98), 7, SHIRT)
        limb((cx + 14, 80 + b), (cx + 15, 98), 7, SHIRT)
        d.ellipse(s(cx - 20, 94, cx - 11, 103), fill=SKIN, outline=LINE, width=K)
        d.ellipse(s(cx + 11, 94, cx + 20, 103), fill=SKIN, outline=LINE, width=K)
        head(cx, 54 + b, mouth="flat")

    return im.resize((FW, FH), Image.LANCZOS)


# 4열 x 3행 – app.js 의 FRAMES 와 반드시 같아야 한다.
SHEET = [
    [("walk", 0), ("walk", 1), ("walk", 2), ("walk", 3)],
    [("type", 0), ("type", 1), ("cheer", 0), ("cheer", 1)],
    [("stand", 0), ("doze", 0), ("squat", 0), ("squat", 1)],
]


def sprite():
    sheet = Image.new("RGBA", (FW * 4, FH * 3), (0, 0, 0, 0))
    for r, row in enumerate(SHEET):
        for c, (pose, k) in enumerate(row):
            sheet.alpha_composite(frame(pose, k), (c * FW, r * FH))
    sheet.save(os.path.join(OUT, "sprite.png"), optimize=True)


def layout():
    data = {
        "image": {"width": W, "height": H},
        "tile": {"w": TW, "h": TH},
        "origin": {"x": OX, "y": OY},
        "grid": {"x": GX, "y": GY},
        "sprite": {"frameWidth": FW, "frameHeight": FH, "cols": 4, "rows": 3},
        # 사람이 서는 자리 (책상 앞, +y 쪽)
        "seats": [{"x": round(x + 0.15, 2), "y": round(y + 0.95, 2)} for (x, y) in DESKS],
        "elevator": {"x": 0.55, "y": round(sum(ELEVATOR_Y) / 2, 2)},
        "aisleX": 1.45,
        "door": {"x": round(sum(DOOR_X) / 2, 2), "y": 0.0},
        "queue": {"x": round(sum(DOOR_X) / 2, 2), "y0": 0.85, "step": 1.0, "max": 7},
        "coffee": {"x": 1.3, "y": 8.4},
    }
    with open(os.path.join(OUT, "layout.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    office()
    sprite()
    layout()
    print("ok:", os.listdir(OUT))
