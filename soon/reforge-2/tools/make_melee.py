"""DEPRECATED: player_melee.png is now baked by tools/make_motions.py (same
layout, plus swing tilt + afterimage). Kept for the documentation below on how
assets/fx/melee_slash.png was extracted from the Swashbuckler sheets.

Bake a melee-attack spritesheet for the reforge-2 player, matching the Franuka
heroes "Swashbuckler_melee" motion + effect.

How the reference actually works (verified by diffing Swashbuckler_melee.png vs
Swashbuckler_melee_NoHitbox.png): the attack is carried by a cream-white SLASH
ARC that is largest on frame 0 and fades out over the next frames, while a small
sword is held forward at waist height and the body barely leans. So:

  * the exact slash arcs are reused (extracted to assets/fx/melee_slash.png) and
    overlaid frame-for-frame — identical effect;
  * a small sword is drawn (pixel blade, not the big equip icon) held forward;
  * the body is the player's idle stance with a slight settling lean.

The base pack orders its rows down / left / right / up, and the swashbuckler slash
sheet is in a different order, so it is sampled with a remap:
    our facing  ->  swashbuckler row
    down  -> 0     left -> 1     right -> 2     up -> 3

    4 rows = facing (down, left, right, up) | 4 cols = frames | 96x96 -> 384x384

Run:  python tools/make_melee.py
"""
import math
from PIL import Image, ImageDraw

ROOT = "."
CELL = 96
COLS = 4
DIRS = ["down", "left", "right", "up"]            # base-pack row order
DIR_VEC = {"down": (0, 1), "up": (0, -1), "left": (-1, 0), "right": (1, 0)}

# our facing -> swashbuckler slash-sheet row
SB_ROW = {"down": 0, "up": 3, "left": 1, "right": 2}
SLASH_DY = -4                                    # our feet sit ~4px higher than sb

# Player's 32x48 frame anchor inside a 96x96 cell: bottom-center (feet).
FEET = (CELL // 2, 62)
LEAN = {0: 5, 1: 4, 2: 2, 3: 1}                  # forward body lean per frame (settling)

# --- small hand-drawn sword (held forward at waist, like the reference) --------
BLADE_LEN = 13
BLADE_STEEL = (214, 220, 228)
BLADE_HI = (242, 246, 250)
BLADE_DARK = (66, 62, 78)
GUARD = (196, 150, 70)
HANDLE = (110, 72, 55)
# "down" is a left-handed downward half-circle swing: the blade is gripped on the
# screen-LEFT and sweeps down through the slash arc (which is the left-side semicircle).
# It rotates across the frames to trace that arc (down-left -> recovering up-left).
# For the side views the grip sits a little lower (nearer the waist).
OUT_ANGLE = {"down": 108.0, "up": -90.0, "left": 180.0, "right": 0.0}
SWING = {0: -10.0, 1: -2.0, 2: 4.0, 3: 2.0}      # tiny — the arc shows the swing
# Per-facing override: "down" sweeps a wide arc (down-left at impact, recovering up).
SWING_DOWN = {0: 18.0, 1: 4.0, 2: -16.0, 3: -34.0}
# Grip sits right at the body's hand/edge so the sword reads as held by the body's
# own arms — no separate forearm is drawn (that looked wrong). Small forward push.
PUSH = {0: 2, 1: 1, 2: 1, 3: 0}
GRIP_REST = {"down": (40, 50), "up": (47, 49), "left": (40, 51), "right": (56, 51)}

ARM_SKIN = (255, 194, 161)
OUTLINE = (82, 51, 63)


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


def draw_fist(cell, grip):
    gx, gy = grip
    d = ImageDraw.Draw(cell)
    d.ellipse([gx - 4, gy - 4, gx + 4, gy + 4], fill=OUTLINE)
    d.ellipse([gx - 2.5, gy - 2.5, gx + 2.5, gy + 2.5], fill=ARM_SKIN)


def draw_sword(cell, grip, angle_deg, length):
    d = ImageDraw.Draw(cell)
    a = math.radians(angle_deg)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    gx, gy = grip
    guard = (gx + ux * 2.0, gy + uy * 2.0)
    tip = (guard[0] + ux * length, guard[1] + uy * length)
    pommel = (gx - ux * 2.5, gy - uy * 2.5)
    d.line([pommel, guard], fill=HANDLE, width=3)
    d.line([guard, tip], fill=BLADE_DARK, width=4)
    d.line([guard, tip], fill=BLADE_STEEL, width=2)
    d.line([(guard[0] + px, guard[1] + py), (tip[0] + px, tip[1] + py)],
           fill=BLADE_HI, width=1)
    d.line([(guard[0] - px * 3, guard[1] - py * 3),
            (guard[0] + px * 3, guard[1] + py * 3)], fill=GUARD, width=2)


def main():
    body = _sheet("assets/characters/player_body_idle.png")
    armor = _sheet("assets/characters/player_armor_idle.png")
    hair = _sheet("assets/characters/player_hair_idle.png")
    slash = _sheet("assets/fx/melee_slash.png")          # extracted real arcs

    out = Image.new("RGBA", (CELL * COLS, CELL * len(DIRS)), (0, 0, 0, 0))

    for row, facing in enumerate(DIRS):
        body_f = DIRS.index(facing) * 4
        fwd = DIR_VEC[facing]
        sb_row = SB_ROW[facing]
        for col in range(COLS):
            cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            lean = LEAN[col]
            ox = FEET[0] - 16 + fwd[0] * lean
            oy = FEET[1] - 48 + fwd[1] * lean
            stance = composite_body(body, armor, hair, body_f)

            push = lean + PUSH[col]
            gpt = (GRIP_REST[facing][0] + fwd[0] * push,
                   GRIP_REST[facing][1] + fwd[1] * push)
            swing = SWING_DOWN[col] if facing == "down" else SWING[col]
            angle = OUT_ANGLE[facing] + swing

            if facing == "up":                               # blade behind body
                draw_sword(cell, gpt, angle, BLADE_LEN)
                cell.alpha_composite(stance, (int(ox), int(oy)))
            else:
                # front & side: no drawn sword/hand — the body + slash arc alone
                # read best (the drawn blade looked off here).
                cell.alpha_composite(stance, (int(ox), int(oy)))

            # exact swashbuckler slash arc, frame-matched + row-remapped
            arc = slash.crop((col * CELL, sb_row * CELL,
                              col * CELL + CELL, sb_row * CELL + CELL))
            cell.alpha_composite(arc, (0, SLASH_DY))

            out.paste(cell, (col * CELL, row * CELL))

    out.save(f"{ROOT}/assets/characters/player_melee.png")
    out.resize((out.width * 2, out.height * 2), Image.NEAREST).save(
        f"{ROOT}/.tmp_melee_preview.png")
    print("wrote assets/characters/player_melee.png", out.size)


if __name__ == "__main__":
    main()
