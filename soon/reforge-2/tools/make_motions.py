"""Bake the remaining player motion spritesheets for reforge-2, using the Franuka
heroes "Swashbuckler" sheets as pose references (frame counts and row layout match
the reference 1:1, minus the farming/fishing tool motions).

Same approach as tools/make_melee.py: the player's layered 32x48 frames
(body + armor + hair, idle/walk sheets) are composited into 96x96 cells anchored
at the feet, then per-frame offsets, tints, rotations and small pixel-drawn
extras (shadow, sparkles, Z bubble, afterimage) carry the motion.

Sheets produced (cols = frames, rows = facing down/left/right/up like the base
pack, except sleeping which is a single down-facing row like the reference):

    dash 3f | jump 1f | falling 3f | hit 2f | ranged 1f | cast 1f
    grab 1f | itemGot 1f | push 4f | sleeping 4f (1 row) | death 8f
    melee 4f (replaces the older tools/make_melee.py bake — same layout, but the
    body now tilts into the swing and frame 0 punches with an afterimage; the
    exact Swashbuckler slash arcs from assets/fx/melee_slash.png are overlaid
    frame-for-frame as before, and they already carry the thin reference blade)

Run:  python tools/make_motions.py
"""
from PIL import Image, ImageDraw

ROOT = "."
CELL = 96
DIRS = ["down", "left", "right", "up"]            # base-pack row order
DIR_VEC = {"down": (0, 1), "up": (0, -1), "left": (-1, 0), "right": (1, 0)}

# Player's 32x48 frame anchor inside a 96x96 cell: bottom-center (feet).
FEET = (CELL // 2, 62)
BASE = (FEET[0] - 16, FEET[1] - 48)               # top-left paste position

SHADOW = (40, 32, 44, 80)


def _sheet(path):
    return Image.open(f"{ROOT}/{path}").convert("RGBA")


def _frame(sheet, f):
    c, r = f % 4, f // 4
    return sheet.crop((c * 32, r * 48, c * 32 + 32, r * 48 + 48))


def composite_body(body, armor, hair, f):
    cell = Image.new("RGBA", (32, 48), (0, 0, 0, 0))
    cell.alpha_composite(_frame(body, f))
    cell.alpha_composite(_frame(armor, f))
    cell.alpha_composite(_frame(hair, f))
    return cell


def new_cell():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


def paste(cell, stance, dx=0, dy=0):
    cell.alpha_composite(stance, (BASE[0] + int(dx), BASE[1] + int(dy)))


def strip_shadow(stance):
    """Remove the baked translucent drop shadow (alpha 100) so airborne and
    rotated poses don't carry it along; callers redraw a ground shadow."""
    out = stance.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if 0 < px[x, y][3] < 255:
                px[x, y] = (0, 0, 0, 0)
    return out


def ghost(stance, alpha):
    g = stance.copy()
    a = g.getchannel("A").point(lambda v: v * alpha // 255)
    g.putalpha(a)
    return g


def tint_hit(stance):
    """Recolor every opaque pixel into the two-tone orange/red silhouette the
    reference uses for its first hit frame (luminance keyed)."""
    out = stance.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r * 299 + g * 587 + b * 114) // 1000
            if lum < 70:
                px[x, y] = (122, 28, 32, a)       # outline
            elif lum < 150:
                px[x, y] = (196, 50, 38, a)       # mid red
            else:
                px[x, y] = (244, 126, 72, a)      # bright orange
    return out


def draw_ground_shadow(cell, w=8):
    d = ImageDraw.Draw(cell)
    d.ellipse([FEET[0] - w, FEET[1] - 3, FEET[0] + w, FEET[1] + 1], fill=SHADOW)


def draw_sparkles(cell, pts, color=(168, 230, 255)):
    d = ImageDraw.Draw(cell)
    for (x, y) in pts:
        d.point([(x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)], fill=color)
        d.point([(x, y)], fill=(255, 255, 255))


def draw_star(cell, cx, cy):
    d = ImageDraw.Draw(cell)
    gold, hi = (240, 198, 60), (255, 244, 180)
    d.line([(cx - 3, cy), (cx + 3, cy)], fill=gold)
    d.line([(cx, cy - 3), (cx, cy + 3)], fill=gold)
    d.point([(cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1), (cx + 1, cy + 1)],
            fill=gold)
    d.point([(cx, cy)], fill=hi)


def draw_z_bubble(cell, cx, cy, size):
    """Tiny cream thought-bubble with a dark Z, like the reference sleeping Z."""
    d = ImageDraw.Draw(cell)
    half = 3 + size
    d.rounded_rectangle([cx - half, cy - half, cx + half, cy + half],
                        radius=2, fill=(244, 232, 200), outline=(82, 51, 63))
    s = 1 + size  # Z half-width
    zc = (82, 51, 63)
    d.line([(cx - s, cy - s), (cx + s, cy - s)], fill=zc)
    d.line([(cx + s, cy - s), (cx - s, cy + s)], fill=zc)
    d.line([(cx - s, cy + s), (cx + s, cy + s)], fill=zc)


def save(img, name):
    img.save(f"{ROOT}/assets/characters/{name}")
    print(f"wrote assets/characters/{name}  {img.size[0]}x{img.size[1]}")


def make_sheet(cols, build_cell, rows=4):
    out = Image.new("RGBA", (CELL * cols, CELL * rows), (0, 0, 0, 0))
    for row in range(rows):
        for col in range(cols):
            cell = new_cell()
            build_cell(cell, row, col)
            out.paste(cell, (col * CELL, row * CELL))
    return out


def main():
    body_i = _sheet("assets/characters/player_body_idle.png")
    armor_i = _sheet("assets/characters/player_armor_idle.png")
    hair_i = _sheet("assets/characters/player_hair_idle.png")
    body_w = _sheet("assets/characters/player_body_walk.png")
    armor_w = _sheet("assets/characters/player_armor_walk.png")
    hair_w = _sheet("assets/characters/player_hair_walk.png")

    def idle(row, col=0):
        return composite_body(body_i, armor_i, hair_i, row * 4 + col)

    def walk(row, col):
        return composite_body(body_w, armor_w, hair_w, row * 4 + col)

    sheets = {}

    # --- dash: hard forward lean + fading afterimage trail behind ------------
    DASH_LEAN = {0: 6, 1: 5, 2: 4}

    def dash(cell, row, col):
        fwd = DIR_VEC[DIRS[row]]
        lean = DASH_LEAN[col]
        st = idle(row)
        paste(cell, ghost(st, 60), -fwd[0] * (lean + 6), -fwd[1] * (lean + 6) // 2)
        paste(cell, ghost(st, 110), -fwd[0] * (lean + 3), -fwd[1] * (lean + 3) // 2)
        paste(cell, st, fwd[0] * lean, fwd[1] * lean // 2)
    sheets["player_dash.png"] = make_sheet(3, dash)

    # --- jump: body lifted, ground shadow stays at the feet ------------------
    def jump(cell, row, col):
        draw_ground_shadow(cell)
        paste(cell, strip_shadow(idle(row)), 0, -7)
    sheets["player_jump.png"] = make_sheet(1, jump)

    # --- falling: airborne wobble (no shadow, like the reference) ------------
    FALL_DX = {0: -2, 1: 2, 2: 0}
    FALL_DY = {0: -5, 1: -4, 2: -6}

    def falling(cell, row, col):
        paste(cell, strip_shadow(idle(row)), FALL_DX[col], FALL_DY[col])
    sheets["player_falling.png"] = make_sheet(3, falling)

    # --- hit: frame 0 = full red/orange tint, frame 1 = knocked back ---------
    def hit(cell, row, col):
        fwd = DIR_VEC[DIRS[row]]
        if col == 0:
            paste(cell, tint_hit(idle(row)))
        else:
            paste(cell, idle(row), -fwd[0] * 2, -fwd[1] * 2)
    sheets["player_hit.png"] = make_sheet(2, hit)

    # --- ranged: slight recoil lean back -------------------------------------
    def ranged(cell, row, col):
        fwd = DIR_VEC[DIRS[row]]
        paste(cell, idle(row), -fwd[0], -fwd[1])
    sheets["player_ranged.png"] = make_sheet(1, ranged)

    # --- cast: raised stance + sparkles over the head -------------------------
    def cast(cell, row, col):
        paste(cell, idle(row), 0, -1)
        draw_sparkles(cell, [(FEET[0] - 8, 18), (FEET[0] + 7, 14), (FEET[0], 9)])
    sheets["player_cast.png"] = make_sheet(1, cast)

    # --- grab: crouched forward lean ------------------------------------------
    def grab(cell, row, col):
        fwd = DIR_VEC[DIRS[row]]
        paste(cell, idle(row), fwd[0] * 2, max(fwd[1] * 2, 0) + 1)
    sheets["player_grab.png"] = make_sheet(1, grab)

    # --- itemGot: golden star held up over the head ---------------------------
    def itemgot(cell, row, col):
        paste(cell, idle(row))
        draw_star(cell, FEET[0], 12)
    sheets["player_itemgot.png"] = make_sheet(1, itemgot)

    # --- push: walk cycle squashed into a forward lean -------------------------
    def push(cell, row, col):
        fwd = DIR_VEC[DIRS[row]]
        paste(cell, walk(row, col), fwd[0] * 3, max(fwd[1] * 3, 0) + 1)
    sheets["player_push.png"] = make_sheet(4, push)

    # --- sleeping: single down-facing row, animated Z bubble -------------------
    Z_SIZE = {0: 0, 1: 1, 2: 2, 3: 1}
    Z_POS = {0: (62, 26), 1: (63, 23), 2: (64, 20), 3: (63, 23)}

    def sleeping(cell, row, col):
        paste(cell, idle(0), 0, 1)
        zx, zy = Z_POS[col]
        draw_z_bubble(cell, zx, zy, Z_SIZE[col])
    sheets["player_sleeping.png"] = make_sheet(4, sleeping, rows=1)

    # --- melee: lunge + tilt into the swing, exact slash arc overlaid -----------
    slash_fx = _sheet("assets/fx/melee_slash.png")        # 96x96 cells, rows match
    SLASH_DY = -4                                         # our feet sit ~4px higher
    MELEE_LEAN = {0: 6, 1: 4, 2: 2, 3: 1}
    MELEE_TILT = {0: 9, 1: 4, 2: 0, 3: 0}
    # body tips toward the side the arc sweeps on: down swings across the left,
    # up across the right; side facings tip "forward" into the lunge
    TILT_SIGN = {"down": 1, "up": -1, "left": 1, "right": -1}

    def melee(cell, row, col):
        facing = DIRS[row]
        fwd = DIR_VEC[facing]
        lean = MELEE_LEAN[col]
        dx, dy = fwd[0] * lean, fwd[1] * lean // 2

        stage = new_cell()
        paste(stage, idle(row), dx, dy)
        tilt = MELEE_TILT[col] * TILT_SIGN[facing]
        if tilt:
            stage = stage.rotate(tilt, resample=Image.NEAREST,
                                 center=(FEET[0] + dx, FEET[1] + dy))
        if col == 0:   # impact frame: afterimage trailing the lunge
            paste(cell, ghost(strip_shadow(idle(row)), 70),
                  dx - fwd[0] * 5, dy - fwd[1] * 3)
        cell.alpha_composite(stage)

        # arc shifted up by SLASH_DY via source crop (alpha_composite dest
        # coordinates must be non-negative)
        arc = slash_fx.crop((col * CELL, row * CELL - SLASH_DY,
                             col * CELL + CELL, row * CELL + CELL))
        cell.alpha_composite(arc, (0, 0))
    sheets["player_melee.png"] = make_sheet(4, melee)

    # --- death: tip over sideways around the feet, settle lying down -----------
    # PIL rotate() is counter-clockwise: positive angle tips the head to the left.
    DEATH_ANGLE = {0: 0, 1: 12, 2: 30, 3: 55, 4: 80, 5: 95, 6: 88, 7: 90}
    DEATH_SINK = {0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2}

    def death(cell, row, col):
        import math
        angle = DEATH_ANGLE[col]
        # ground shadow stays flat, sliding under the body's center as it tips
        # (body center sits ~20px above the feet pivot)
        shift = -math.sin(math.radians(angle)) * 20
        w = 8 + int(abs(math.sin(math.radians(angle))) * 5)
        d = ImageDraw.Draw(cell)
        d.ellipse([FEET[0] + shift - w, FEET[1] - 3,
                   FEET[0] + shift + w, FEET[1] + 1], fill=SHADOW)
        stage = new_cell()
        paste(stage, strip_shadow(idle(row)), 0, DEATH_SINK[col])
        stage = stage.rotate(angle, resample=Image.NEAREST, center=FEET)
        cell.alpha_composite(stage)
    sheets["player_death.png"] = make_sheet(8, death)

    for name, img in sheets.items():
        save(img, name)

    # --- 2x contact sheet preview ---------------------------------------------
    order = list(sheets.keys())
    pad = 8
    w = max(sheets[n].width for n in order) * 2 + pad * 2
    h = sum(sheets[n].height * 2 + pad + 14 for n in order) + pad
    contact = Image.new("RGBA", (w, h), (24, 24, 32, 255))
    d = ImageDraw.Draw(contact)
    y = pad
    for n in order:
        d.text((pad, y), n, fill=(255, 120, 220))
        y += 14
        img = sheets[n]
        contact.alpha_composite(
            img.resize((img.width * 2, img.height * 2), Image.NEAREST), (pad, y))
        y += img.height * 2 + pad
    # build/ is .gdignore'd, so the preview never gets imported into res://
    contact.save(f"{ROOT}/build/motions_preview.png")
    print("wrote build/motions_preview.png", contact.size)


if __name__ == "__main__":
    main()
