"""Generator (dev tool). Writes assets/tiles/interior.tres — a TileSet over
interior_main.png (Franuka Interior pack, 2x = 32px cells) in the same
hand-written text format as world.tres.

Single atlas source (id 0) so TileMapLayer atlas coords == sheet cell coords.
Registered area = rows 0..11 (room frames, inner-corner nubs, floors, wall
panels, doors, windows); furniture below row 11 is placed as Sprite2D regions,
not tiles.

Run from project root:  python tools/gen_interior_tileset.py
"""
COLS, ROWS = 32, 12

HEADER = """[gd_resource type="TileSet" format=3]

[ext_resource type="Texture2D" path="res://assets/world/interior/interior_main.png" id="1_main"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_inter"]
texture = ExtResource("1_main")
texture_region_size = Vector2i(32, 32)
"""

FOOTER = """
[resource]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("TileSetAtlasSource_inter")
"""


def main() -> None:
    lines = [HEADER]
    for y in range(ROWS):
        for x in range(COLS):
            lines.append(f"{x}:{y}/0 = 0")
    lines.append(FOOTER)
    with open("assets/tiles/interior.tres", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"interior.tres written: {COLS}x{ROWS} cells registered")


if __name__ == "__main__":
    main()
