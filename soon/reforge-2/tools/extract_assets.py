"""Selectively extract + crop Ninja Adventure assets into res://assets.

Run from project root:  python tools/extract_assets.py
Idempotent: safe to re-run. Requires Pillow.
"""
import io
import os
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP = os.path.join(ROOT, "Ninja Adventure - Asset Pack.zip")
PREFIX = "Ninja Adventure - Asset Pack/"
ASSETS = os.path.join(ROOT, "assets")

z = zipfile.ZipFile(ZIP)


def load(name: str) -> Image.Image:
    return Image.open(io.BytesIO(z.read(PREFIX + name))).convert("RGBA")


def save(img: Image.Image, *rel: str) -> None:
    out = os.path.join(ASSETS, *rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out)
    print("  wrote", os.path.relpath(out, ROOT), img.size)


def copy_raw(src: str, *rel: str) -> None:
    out = os.path.join(ASSETS, *rel)
    data = z.read(PREFIX + src)  # read first so a bad path doesn't leave a 0-byte file
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write(data)
    print("  copied", os.path.relpath(out, ROOT))


# --- Characters: copy the 64x64 Walk sheet (4 dir rows x 4 frames) ---
print("characters:")
for who, folder in [("boy", "Boy"), ("master", "Master"), ("hunter", "Hunter")]:
    copy_raw(f"Actor/Character/{folder}/SeparateAnim/Walk.png",
             "characters", f"{who}_walk.png")
    copy_raw(f"Actor/Character/{folder}/SeparateAnim/Idle.png",
             "characters", f"{who}_idle.png")

# --- Single tiles cropped from tilesets for repeating backgrounds ---
print("tiles:")
# Interior floor tile: TilesetInteriorFloor.png has plain floor tiles; take a
# clean wood-plank tile at column 1,row 1 (16x16).
floor = load("Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png")
save(floor.crop((16, 16, 32, 32)), "tiles", "room_floor.png")
# Grass tile from TilesetNature.png - tile (1,3) is a clean opaque grass.
nature = load("Backgrounds/Tilesets/TilesetNature.png")
save(nature.crop((16, 48, 32, 64)), "tiles", "town_grass.png")
# A grass variant for subtle variety.
save(nature.crop((32, 48, 48, 64)), "tiles", "town_path.png")

# --- Building sprites: pull a house from TilesetHouse for shop/gambling ---
# Keep the full house tileset; we slice via AtlasTexture region in the scene.
copy_raw("Backgrounds/Tilesets/TilesetHouse.png", "tiles", "house_sheet.png")

# --- UI: Wood theme nine-patches + buttons we use, plus font ---
print("ui:")
wood = "Ui/Theme/Theme Wood/"
for f in [
    "nine_path_panel.png", "nine_path_bg.png", "nine_path_panel_interior.png",
    "button_normal.png", "button_hover.png", "button_pressed.png",
    "button_disabled.png", "tab_selected.png", "tab_unselected.png",
    "inventory_cell.png",
]:
    copy_raw(wood + f, "ui", "wood", f)
copy_raw("Ui/Font/NormalFont.ttf", "ui", "NormalFont.ttf")

# --- Item icons (representative; pack lacks 1:1 armor icons) ---
print("items:")
icon_map = {
    "sword": "Items/Weapons/Katana/Sprite.png",
    "shield": "Items/Treasure/SilverKey.png",       # placeholder icon
    "armor": "Items/Object/Bag.png",
    "boots": "Items/Object/Gourd.png",
    "helmet": "Items/Treasure/GoldCup.png",
    "coin": "Items/Treasure/GoldCoin.png",
    "dice": "Items/Object/Dice 6.png",
}
for name, src in icon_map.items():
    try:
        copy_raw(src, "items", f"{name}.png")
    except KeyError:
        print("  MISSING", src)

# 제작연마제 (crafting material) icon — a purple gem reads as a rare drop.
copy_raw("Items/Resource/GemPurple.png", "items", "whetstone.png")

# Katana the ninja holds — the full item sprite (blade + handle) reads clearly
# as a sword (the small SpriteInHand blade looked like a plain pipe).
copy_raw("Items/Weapons/Katana/Sprite.png", "characters", "katana.png")

# --- Monsters: 64x64 walk sheets (4 dir rows x 4 frames), one per stage tier ---
print("monsters:")
monster_sheets = {
    "slime": "Actor/Monster/Slime/Slime.png",
    "mushroom": "Actor/Monster/Mushroom/mushroom.png",
    "snake": "Actor/Monster/Snake/Snake.png",
    "mole": "Actor/Monster/Mole/Mole.png",
    "eye": "Actor/Monster/Eye/Eye.png",
}
for name, src in monster_sheets.items():
    try:
        copy_raw(src, "monsters", f"{name}.png")
    except KeyError:
        print("  MISSING", src)

print("done.")
