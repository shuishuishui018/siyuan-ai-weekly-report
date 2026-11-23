"""生成插件市场图标 (160x160) 与预览图 (1024x768)。"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = "C:/Windows/Fonts"


def font(name, size, fallback="arial.ttf"):
    for candidate in (name, fallback):
        path = os.path.join(FONT_DIR, candidate)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def gradient(size, start, end):
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    w, h = size
    for y in range(h):
        t = y / max(h - 1, 1)
        color = tuple(int(start[i] + (end[i] - start[i]) * t) for i in range(3))
        draw.line([(0, y), (w, y)], fill=color)
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def make_icon():
    size = (160, 160)
    base = gradient(size, (79, 70, 229), (124, 58, 237))
    # 文档
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([44, 34, 106, 126], radius=10, outline=(255, 255, 255), width=6)
    d.line([(80, 34), (106, 60)], fill=(255, 255, 255), width=6)
    for i, y in enumerate((72, 88, 104)):
        width = 44 if i < 2 else 28
        d.line([(58, y), (58 + width, y)], fill=(255, 255, 255), width=6)
    # 星芒
    cx, cy = 118, 112
    d.polygon(
        [
            (cx, cy - 22), (cx + 6, cy - 6), (cx + 22, cy),
            (cx + 6, cy + 6), (cx, cy + 22), (cx - 6, cy + 6),
            (cx - 22, cy), (cx - 6, cy - 6),
        ],
        fill=(255, 236, 140),
    )
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.paste(base, (0, 0), rounded_mask(size, 34))
    img.save(os.path.join(OUT, "icon.png"))
    print("icon.png", os.path.getsize(os.path.join(OUT, "icon.png")), "bytes")


def make_preview():
    W, H = 1024, 768
    img = gradient((W, H), (238, 242, 255), (248, 250, 252))
    d = ImageDraw.Draw(img)

    title_font = font("msyhbd.ttc", 54)
    sub_font = font("msyh.ttc", 24)
    bullet_font = font("msyh.ttc", 22)
    card_title_font = font("msyhbd.ttc", 26)
    card_font = font("msyh.ttc", 18)
    small_font = font("msyh.ttc", 18)

    d.text((72, 110), "AI 周报生成器", font=title_font, fill=(15, 23, 42))
    d.text((72, 190), "收集工作日志  →  AI 汇总  →  结构化周报", font=sub_font, fill=(71, 85, 105))

    bullets = [
        "按时间范围自动收集工作日志、待办",
        "兼容 DeepSeek / OpenAI / 本地模型",
        "自动排除含敏感词的文档",
        "结构可自定义：完成 / 进行中 / 风险 / 计划",
    ]
    y = 268
    for text in bullets:
        d.ellipse([76, y + 8, 88, y + 20], fill=(99, 102, 241))
        d.text((104, y), text, font=bullet_font, fill=(51, 65, 85))
        y += 46

    d.text((72, 690), "SiYuan  ·  Obsidian", font=small_font, fill=(100, 116, 139))

    # 右侧周报卡片
    card = Image.new("RGBA", (392, 486), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([0, 0, 391, 485], radius=20, fill=(255, 255, 255, 255))
    cd.rounded_rectangle([0, 0, 391, 66], radius=20, fill=(79, 70, 229, 255))
    cd.rectangle([0, 46, 391, 66], fill=(79, 70, 229, 255))
    cd.text((24, 20), "2026-W47 工作周报", font=card_title_font, fill=(255, 255, 255))
    rows = [
        ("本周完成", 96),
        ("进行中", 226),
        ("问题与风险", 330),
    ]
    for label, top in rows:
        cd.text((24, top), label, font=card_font, fill=(79, 70, 229))
        for i in range(3):
            line_y = top + 34 + i * 28
            width = [300, 262, 208][i]
            cd.rounded_rectangle([24, line_y, 24 + width, line_y + 10], radius=5, fill=(226, 232, 240))
    img.paste(card, (556, 140), card)
    img.save(os.path.join(OUT, "preview.png"))
    print("preview.png", os.path.getsize(os.path.join(OUT, "preview.png")), "bytes")


make_icon()
make_preview()
