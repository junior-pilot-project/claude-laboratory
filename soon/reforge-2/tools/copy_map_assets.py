"""Copy Franuka pack assets (2x = 32px scale) needed by the map rework into
res://assets. Also bakes labeled grid previews of the interior sheets and frame
contact sheets of the animated strips into build/ so prop region_rects and
hframes can be read off without the Godot editor.

Run from project root:  python tools/copy_map_assets.py
Idempotent: safe to re-run. Requires Pillow.
"""
import os
import shutil

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BUILD = os.path.join(ROOT, "build")

PACKS = r"D:\Fantasy_RPG_assets"
EXT = os.path.join(PACKS, "Fantasy RPG asset pack", "2x")
INT = os.path.join(PACKS, "Fantasy RPG Interior pack (by Franuka)", "2x")
MINE = os.path.join(PACKS, "RPG Mining & Smithing pack (by Franuka)", "2x")
ICON = os.path.join(PACKS, "Fantasy RPG icon pack (by Franuka)")
DUNGEON = os.path.join(PACKS, "Dungeon Tileset (asset pack)", "2x")


def copy(src: str, *rel: str) -> None:
    out = os.path.join(ASSETS, *rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    shutil.copyfile(src, out)
    print("  copied", os.path.relpath(out, ROOT))


# --- NPCs: Medieval Townsfolk 2x idle sheets (128x192 = 4x4 of 32x48) ---
print("npcs:")
TOWNSFOLK = os.path.join(INT, "Medieval Townsfolk pack (bonus)")
for who in ("Merchant", "Blacksmith", "Bartender", "Alchemist"):
    copy(os.path.join(TOWNSFOLK, f"{who}_idle.png"),
         "characters", f"npc_{who.lower()}_idle.png")

# --- Village exterior: open-door house variants + decoration ---
print("village:")
for name in (
    "House_1 (open).png", "House_2 (open).png", "House_3 (open).png",
    "House_small_1 (open).png", "Stone tile.png",
    "Flower_3.png", "Flower_4.png", "Flower_6.png",
    "Bush_C1.png", "Bush_B1.png", "Tree_D1.png", "Tree_F1.png",
):
    copy(os.path.join(EXT, "Tileset", name), "world", "tiles", name)
for name in (
    "Fences (wood).png",
    "Wooden sign (beer).png", "Wooden sign (potion).png",
    "Barrel_water.png", "Chest_small.png",
):
    copy(os.path.join(EXT, "Objects", name), "world", "objects", name)

# --- Interior sheets (placed as TileMap floor + Sprite2D region props) ---
print("interior sheets:")
INTERIOR_SHEETS = {
    "Fantasy RPG Interior Pack (32x32 grid).png": "interior_main.png",
    "Expansion_Bedroom.png": "interior_bedroom.png",
    "Expansion_AlchemyLab.png": "interior_alchemy.png",
    "Expansion_Workshop.png": "interior_workshop.png",
}
for src, dst in INTERIOR_SHEETS.items():
    copy(os.path.join(INT, src), "world", "interior", dst)

# --- Animated object strips (Sprite2D + hframes; frame counts verified below) ---
print("animated objects:")
ANIM = os.path.join(INT, "Animated objects")
ANIM_STRIPS = [
    "Fireplace.png", "Candle.png", "TorchFront.png",
    "Cauldron (green).png", "AlchemyTable_1.png",
    "EnchantmentTable (purple).png", "Furnace.png",
]
for name in ANIM_STRIPS:
    copy(os.path.join(ANIM, name), "world", "interior", name)

# --- Smithy props for the equipment shop interior ---
print("smithy:")
for name in (
    "Anvil_01A.png", "Blacksmith_Furnace.png", "Barrel_Swords.png",
    "Armour_01.png", "Counters.png", "Basket_Coal.png",
    "Rack_Weapons_01.png", "Rack_Armour_01.png", "Rack_Shields.png",
    "GrindingWheel.png", "Ingot_Iron_02.png", "Ingot_Gold_02.png",
):
    copy(os.path.join(MINE, "Objects & Decoration", name), "world", "smithy", name)

# --- Town-life pass: wandering animals + pedestrian NPCs (4x4 sheets,
# row = down/left/right/up like the rest of the pack) ---
print("animals + walkers:")
ANIMALS = os.path.join(EXT, "Monsters and animals")
for who, size in (("Hen", "32x32"), ("Pig", "32x32"), ("Cow", "40x32")):
    for anim in ("idle", "walk"):
        copy(os.path.join(ANIMALS, f"{who}_{anim} ({size}).png"),
             "characters", "animals", f"{who.lower()}_{anim}.png")
NPCS = os.path.join(EXT, "NPCs")
for i, num in enumerate(("03", "07", "11"), start=1):
    for anim in ("idle", "walk"):
        copy(os.path.join(NPCS, f"NPC {num}_{anim} (32x48).png"),
             "characters", f"npc_walker{i}_{anim}.png")

# --- Town deco pass: stone fence, crops, fruit ---
print("town deco:")
for name in (
    "Fences (stone).png",
    "Crops (berries).png", "Crops (carrot).png", "Crops (sunflower).png",
    "Apple.png", "Orange.png", "Peach.png",
):
    copy(os.path.join(EXT, "Objects", name), "world", "objects", name)

# --- Deep-forest tree variants for the hunt chain (2 = dark green, 3 = autumn) ---
print("forest variants:")
for name in ("Tree_A2.png", "Tree_B2.png",
             "Tree_A3.png", "Tree_B3.png", "Tree_C3.png", "Tree_D3.png"):
    copy(os.path.join(EXT, "Tileset", name), "world", "tiles", name)

# --- Falling-leaf particle texture: one leaf cropped out of Leaves_1.png ---
print("leaf particle:")
leaves = Image.open(os.path.join(EXT, "Tileset", "Leaves_1.png")).convert("RGBA")
bbox = leaves.getbbox()
leaf = leaves.crop(bbox)
# Take roughly one leaf from the cluster's top-left quarter, then trim again.
quarter = leaf.crop((0, 0, max(1, leaf.width // 2), max(1, leaf.height // 2)))
qb = quarter.getbbox()
if qb:
    quarter = quarter.crop(qb)
out = os.path.join(ASSETS, "fx", "leaf.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
quarter.save(out)
print("  wrote", os.path.relpath(out, ROOT), quarter.size)

# --- Potion icons (icon pack index: 81/82/83 = minor/normal/greater healing) ---
print("potions:")
ICONS32 = os.path.join(ICON, "Individual icons (32x32)")
for num, dst in (("81", "potion_small"), ("82", "potion_medium"), ("83", "potion_large")):
    copy(os.path.join(ICONS32, f"{num}.png"), "items", f"{dst}.png")

# --- Dungeon run mode: stone tileset + props + dungeon-dweller monsters ----
print("dungeon:")
DOBJ = os.path.join(DUNGEON, "Objects and traps")
copy(os.path.join(DUNGEON, "Dungeon Tileset.png"), "world", "dungeon", "dungeon_tileset.png")
for src, dst in (
    ("Torch (front).png", "torch_front.png"),
    ("Spiked gate (front).png", "spiked_gate.png"),
    ("Door (front).png", "door_front.png"),
    ("Bones_1.png", "bones_1.png"),
    ("Bones_2.png", "bones_2.png"),
    ("Bones_3.png", "bones_3.png"),
    ("Chains.png", "chains.png"),
    ("Small chest.png", "chest_small.png"),
    ("Large chest.png", "chest_large.png"),
):
    copy(os.path.join(DOBJ, src), "world", "dungeon", dst)
DCHR = os.path.join(DUNGEON, "Characters")
for src, dst in (
    ("Skeleton_idle.png", "skeleton_idle.png"),
    ("Skeleton_walk.png", "skeleton_walk.png"),
    ("Bat.png", "bat_idle.png"),
    ("Slime (red).png", "slime_red_idle.png"),
):
    copy(os.path.join(DCHR, src), "monsters", dst)

# ---------------------------------------------------------------------------
# Previews into build/ (gdignore'd): grid overlays + animated strip reports.
# ---------------------------------------------------------------------------
os.makedirs(BUILD, exist_ok=True)
print("previews:")

def grid_preview(path: str, dst: str) -> None:
    img = Image.open(path).convert("RGBA")
    # Checkerboard backdrop so transparent regions read clearly.
    grid = Image.new("RGBA", img.size, (40, 40, 40, 255))
    d = ImageDraw.Draw(grid)
    for cy in range(0, img.height, 32):
        for cx in range(0, img.width, 32):
            if ((cx + cy) // 32) % 2 == 0:
                d.rectangle([cx, cy, cx + 31, cy + 31], fill=(55, 55, 55, 255))
    grid.alpha_composite(img)
    d = ImageDraw.Draw(grid)
    for cx in range(0, img.width, 32):
        d.line([(cx, 0), (cx, img.height)], fill=(255, 0, 255, 90))
    for cy in range(0, img.height, 32):
        d.line([(0, cy), (img.width, cy)], fill=(255, 0, 255, 90))
    for cy in range(0, img.height, 64):
        for cx in range(0, img.width, 64):
            d.text((cx + 2, cy + 1), f"{cx // 32},{cy // 32}", fill=(255, 255, 0, 255))
    out = os.path.join(BUILD, f"preview_{dst}")
    grid.save(out)
    print("  wrote", os.path.relpath(out, ROOT), img.size)


for dst in INTERIOR_SHEETS.values():
    grid_preview(os.path.join(ASSETS, "world", "interior", dst), dst)
grid_preview(os.path.join(ASSETS, "world", "dungeon", "dungeon_tileset.png"),
             "dungeon_tileset.png")

print("animated strip sizes (frames assuming square-ish frames):")
for name in ANIM_STRIPS:
    img = Image.open(os.path.join(ASSETS, "world", "interior", name))
    print(f"  {name}: {img.size}")
for name in ("torch_front.png", "spiked_gate.png", "door_front.png",
             "chest_small.png", "chest_large.png", "chains.png"):
    img = Image.open(os.path.join(ASSETS, "world", "dungeon", name))
    print(f"  dungeon/{name}: {img.size}")
print("done.")
