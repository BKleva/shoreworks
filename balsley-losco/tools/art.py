# -*- coding: utf-8 -*-
"""Placeholder artwork: sleek twilight illustrations (stand-ins until real listing photography is connected)."""
import html, random

E = lambda s: html.escape(str(s), quote=True)
def _hsl(h, s, l): return "hsl(%d,%d%%,%d%%)" % (h % 360, s, l)

def _sky(r, hue, w, hz, glow_x=None):
    ember = 14 + hue % 22
    golden = r.random() < 0.4
    top = _hsl(18, 28, 22) if golden else _hsl(335, 20, 15)
    mid = _hsl(12, 38, 34) if golden else _hsl(350, 26, 27)
    hor = _hsl(36 + hue % 8, 88, 72) if golden else _hsl(ember, 80, 60)
    gx = glow_x if glow_x is not None else r.randint(220, 580)
    return (f'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset=".55" stop-color="{mid}"/><stop offset="1" stop-color="{hor}"/></linearGradient>'
            f'<radialGradient id="g" cx="{gx}" cy="{hz}" r="260" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe3a8" stop-opacity=".85"/><stop offset="1" stop-color="#ffe3a8" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs>'), gx

def _win(x, y, ww=42, hh=54, lit=True):
    c = "#f8d98c" if lit else "#4a3d3a"
    glow = f'<rect x="{x-6}" y="{y-6}" width="{ww+12}" height="{hh+12}" fill="#f8d98c" opacity=".16"/>' if lit else ""
    return f'{glow}<rect x="{x}" y="{y}" width="{ww}" height="{hh}" fill="{c}"/><path d="M{x+ww/2} {y}V{y+hh}M{x} {y+hh/2}H{x+ww}" stroke="#1b1416" stroke-width="2.5"/>'

def _tree(x, y, s=1.0):
    return f'<rect x="{x-4*s}" y="{y-8*s}" width="{8*s}" height="{40*s}" fill="#0f0b0c"/><ellipse cx="{x}" cy="{y-30*s}" rx="{34*s}" ry="{44*s}" fill="#14100f"/><ellipse cx="{x+16*s}" cy="{y-18*s}" rx="{24*s}" ry="{30*s}" fill="#1a1514"/>'

def scene(seed, hue, kind="gable", water=False, w=800, h=600, label=""):
    r = random.Random(seed)
    hz = int(h * 0.66)
    defs, gx = _sky(r, hue, w, hz)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{E(label)}">', defs,
         f'<rect width="{w}" height="{h}" fill="url(#s)"/><rect width="{w}" height="{h}" fill="url(#g)"/>']
    # distant treeline
    pts = " ".join(f"L{x} {hz-r.randint(14,38)}" for x in range(0, w + 40, 40))
    o.append(f'<path d="M0 {hz} {pts} L{w} {hz}Z" fill="#1d1618" opacity=".9"/>')
    if water:
        o.append(f'<rect y="{hz-6}" width="{w}" height="{h-hz+6}" fill="#241f26"/>')
        for i in range(9):
            y = hz + 8 + i * 17; ww = r.randint(60, 220); x = gx - ww / 2 + r.randint(-40, 40)
            o.append(f'<rect x="{x}" y="{y}" width="{ww*(1-i*0.06)}" height="2.5" fill="#ffd89a" opacity="{.38-i*.03}"/>')
        o.append(f'<path d="M0 {hz+70} Q{w/2} {hz+40} {w} {hz+76} V{h} H0Z" fill="#2c2420"/>')
    else:
        o.append(f'<rect y="{hz-4}" width="{w}" height="{h-hz+4}" fill="#171112"/><path d="M0 {hz+14} Q{w/2} {hz-6} {w} {hz+14} V{h} H0Z" fill="#1f1816"/>')
    ground = hz + 34
    body = "#2d2629"; roof = "#151011"
    if kind == "gable":
        x, bw, bh = 200, 400, 168; y = ground - bh
        o.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" fill="{body}"/><path d="M{x-26} {y+3} L{x+bw/2} {y-104} L{x+bw+26} {y+3}Z" fill="{roof}"/><rect x="{x+bw-110}" y="{y-92}" width="28" height="60" fill="#1d1618"/>')
        for wx in (x + 34, x + 128, x + 292, x + 336): o.append(_win(wx, y + 34, 42, 56, r.random() > .2))
        o.append(f'<rect x="{x+bw/2-24}" y="{y+72}" width="48" height="{bh-72}" fill="#e8744a" opacity=".92"/><rect x="{x+bw/2-70}" y="{y+bh-8}" width="140" height="8" fill="#3b3033"/>')
    elif kind == "modern":
        x = 140
        o.append(f'<rect x="{x}" y="{ground-118}" width="370" height="118" fill="{body}"/><rect x="{x+92}" y="{ground-212}" width="372" height="96" fill="#1a1416"/><rect x="{x+110}" y="{ground-196}" width="336" height="62" fill="#f8d98c" opacity=".92"/>')
        for i in range(1, 5): o.append(f'<rect x="{x+110+i*67}" y="{ground-196}" width="3" height="62" fill="#1a1416"/>')
        o.append(f'<rect x="{x+16}" y="{ground-98}" width="214" height="98" fill="#f8d98c" opacity=".85"/><rect x="{x+122}" y="{ground-98}" width="3" height="98" fill="#1a1416"/><rect x="{x+256}" y="{ground-84}" width="44" height="84" fill="#e8744a"/><rect x="{x+320}" y="{ground-122}" width="160" height="6" fill="#0f0b0c"/>')
        o.append(f'<rect x="{x-8}" y="{ground-120}" width="388" height="5" fill="#0f0b0c"/>')
    else:
        x = 280
        o.append(f'<rect x="{x}" y="{ground-290}" width="240" height="290" fill="{body}"/><rect x="{x-10}" y="{ground-302}" width="260" height="14" fill="{roof}"/>')
        for rr in range(4):
            for cc in range(3): o.append(_win(x + 26 + cc * 74, ground - 262 + rr * 68, 46, 40, r.random() > .3))
        o.append(f'<rect x="{x+92}" y="{ground-62}" width="56" height="62" fill="#e8744a" opacity=".92"/>')
    if kind != "tall":
        o.append(_tree(70, ground + 6, 1.05)); o.append(_tree(735, ground + 4, .95))
    o.append(f'<rect width="{w}" height="{h}" fill="url(#v)"/></svg>')
    return "".join(o)

def landscape(seed, hue, kind, label=""):
    w, h = 800, 500
    r = random.Random(seed)
    hz = 290
    defs, gx = _sky(r, hue, w, hz)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{E(label)}">', defs,
         f'<rect width="{w}" height="{h}" fill="url(#s)"/><rect width="{w}" height="{h}" fill="url(#g)"/>']
    if kind in ("beach", "bay"):
        o.append(f'<rect y="{hz}" width="{w}" height="{h-hz}" fill="#241f26"/>')
        for i in range(9):
            y = hz + 8 + i * 16; ww = r.randint(70, 240); x = gx - ww / 2 + r.randint(-40, 40)
            o.append(f'<rect x="{x}" y="{y}" width="{ww*(1-i*0.06)}" height="2.5" fill="#ffd89a" opacity="{.4-i*.03}"/>')
        if kind == "beach":
            o.append(f'<path d="M0 {h-100} Q400 {h-150} {w} {h-92} V{h} H0Z" fill="#33271f"/><path d="M0 {h-60} Q400 {h-96} {w} {h-50} V{h} H0Z" fill="#241a15"/>')
            o.append(f'<path d="M60 {h-100} L150 {hz+40}" stroke="#120d0e" stroke-width="3"/>')
            for i in range(7): o.append(f'<rect x="{90+i*14}" y="{hz+34}" width="4" height="{50}" fill="#120d0e"/>')
            o.append(f'<rect x="84" y="{hz+34}" width="108" height="6" fill="#120d0e"/>')
        else:
            o.append(f'<path d="M0 {h-70} Q400 {h-104} {w} {h-60} V{h} H0Z" fill="#2c2420"/><rect x="60" y="{h-128}" width="330" height="8" fill="#120d0e"/>')
            for i in range(5): o.append(f'<rect x="{74+i*72}" y="{h-124}" width="7" height="58" fill="#120d0e"/>')
            for bx in (520, 660):
                o.append(f'<path d="M{bx-54} {hz+48} H{bx+54} L{bx+38} {hz+78} H{bx-38}Z" fill="#120d0e"/><rect x="{bx-2}" y="{hz-62}" width="4" height="110" fill="#120d0e"/><path d="M{bx+4} {hz-58} L{bx+46} {hz+30} H{bx+4}Z" fill="#c8202f"/>')
    elif kind == "farm":
        for i, (c, y) in enumerate([("#2a1f1d", hz - 20), ("#201817", hz + 20), ("#181112", hz + 70), ("#120c0d", hz + 130)]):
            o.append(f'<path d="M0 {y} Q{w/2} {y-34-i*6} {w} {y-4} V{h} H0Z" fill="{c}"/>')
        o.append(f'<rect x="520" y="{hz-52}" width="150" height="104" fill="#1c1415"/><path d="M510 {hz-48} L595 {hz-118} L680 {hz-48}Z" fill="#100b0c"/><rect x="568" y="{hz-8}" width="54" height="60" fill="#f8d98c" opacity=".9"/>')
        for i in range(5): o.append(_tree(r.randint(60, 420), hz + 40, .7))
    else:  # suburb
        o.append(f'<path d="M0 {hz} Q400 {hz-20} {w} {hz} V{h} H0Z" fill="#1d1618"/><rect y="{h-64}" width="{w}" height="64" fill="#100b0c"/><rect y="{h-34}" width="{w}" height="3" fill="#ffd89a" opacity=".35"/>')
        for i in range(3):
            x = 60 + i * 250
            o.append(f'<rect x="{x}" y="{hz-56}" width="190" height="96" fill="#2d2629"/><path d="M{x-12} {hz-54} L{x+95} {hz-130} L{x+202} {hz-54}Z" fill="#151011"/><rect x="{x+82}" y="{hz-4}" width="28" height="44" fill="#e8744a"/>')
            o.append(_win(x + 20, hz - 38, 34, 30, r.random() > .25) + _win(x + 138, hz - 38, 34, 30, r.random() > .25))
            o.append(_tree(x + 214, hz + 30, .6))
    o.append(f'<rect width="{w}" height="{h}" fill="url(#v)"/></svg>')
    return "".join(o)

def hero_art():
    return ""
