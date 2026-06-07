"""Generator (dev tool, not shipped at runtime). Rebuilds the reworked maps:

  Room.tscn                cozy 640x480 bedroom (bed = death respawn)
  EquipShopInterior.tscn   smithy/workshop (Merchant buy/craft + Blacksmith enhance)
  GambleInterior.tscn      tavern/casino (Bartender)
  PotionShopInterior.tscn  alchemy lab (Alchemist)
  Town.tscn                2048x1280 exploration village (4 buildings + hunt exit)

Interior rooms follow the Franuka Interior-pack assembly: a mahogany 9-slice
frame outlines the room, a 2-row wall panel band sits under the top edge,
floor tiles fill the inside, and everything outside the frame is the dark
void colour. Furniture comes from sheet regions (coords read off the labeled
build/zoom_*.png previews); animated strips use AnimFrames.gd.

Run from the project root:  python tools/gen_maps_tscn.py
"""
import base64
import struct

TILE = 32

# interior.tres source 0 == interior_main.png sheet cells.
FRAME = {  # mahogany room frame 9-slice
    "tl": (0, 0), "t": (1, 0), "tr": (2, 0),
    "l": (0, 1), "r": (2, 1),
    "bl": (0, 2), "b": (1, 2), "br": (2, 2),
}
WALLS_BY_THEME = {  # (top row cell, bottom row cell) of the 2-row wall panels
    "plank": ((10, 0), (10, 1)),
    "red": ((16, 0), (16, 1)),
    "navy": ((19, 0), (19, 1)),
    "brick": ((26, 0), (26, 1)),
}
FLOORS = {
    "planks_orange": (7, 2),
    "ornate_red": (10, 2),
    "cobble": (12, 3),
    "cream_squares": (6, 3),
}
VOID = "Color(0.16, 0.11, 0.17, 1)"   # dark purple void around interior frames

# world.tres ids (match tools/gen_hunt_tscn.py / build_world.gd).
GRASS_SRC, GRASS_CELL = 0, (6, 1)
ROAD_STONE_SRC = 3   # Roads_stone.png: same 3x3 9-slice at cols 0-2

ASSET = {
    # shared
    "door": "res://assets/world/tiles/Door (closed).png",
    "interior_main": "res://assets/world/interior/interior_main.png",
    "interior_bedroom": "res://assets/world/interior/interior_bedroom.png",
    "interior_alchemy": "res://assets/world/interior/interior_alchemy.png",
    "interior_workshop": "res://assets/world/interior/interior_workshop.png",
    "fireplace": "res://assets/world/interior/Fireplace.png",
    "candle": "res://assets/world/interior/Candle.png",
    "torch_front": "res://assets/world/interior/TorchFront.png",
    "cauldron": "res://assets/world/interior/Cauldron (green).png",
    "alchemy_table": "res://assets/world/interior/AlchemyTable_1.png",
    "ench_table": "res://assets/world/interior/EnchantmentTable (purple).png",
    "npc_merchant": "res://assets/characters/npc_merchant_idle.png",
    "npc_blacksmith": "res://assets/characters/npc_blacksmith_idle.png",
    "npc_bartender": "res://assets/characters/npc_bartender_idle.png",
    "npc_alchemist": "res://assets/characters/npc_alchemist_idle.png",
    # smithy
    "anvil_s": "res://assets/world/smithy/Anvil_01A.png",
    "bs_furnace": "res://assets/world/smithy/Blacksmith_Furnace.png",
    "barrel_swords": "res://assets/world/smithy/Barrel_Swords.png",
    "armour": "res://assets/world/smithy/Armour_01.png",
    "counters": "res://assets/world/smithy/Counters.png",
    "rack_weapons": "res://assets/world/smithy/Rack_Weapons_01.png",
    "rack_armour": "res://assets/world/smithy/Rack_Armour_01.png",
    "rack_shields": "res://assets/world/smithy/Rack_Shields.png",
    "grindwheel": "res://assets/world/smithy/GrindingWheel.png",
    "basket_coal": "res://assets/world/smithy/Basket_Coal.png",
    "ingot_iron": "res://assets/world/smithy/Ingot_Iron_02.png",
    "ingot_gold": "res://assets/world/smithy/Ingot_Gold_02.png",
    # misc world objects already in the project
    "chest_big": "res://assets/world/objects/Chest_big.png",
    "crate": "res://assets/world/objects/Crate.png",
    "barrel": "res://assets/world/objects/Barrel.png",
    "stool": "res://assets/world/objects/Stool.png",
    # town
    "house_1": "res://assets/world/tiles/House_1 (open).png",
    "house_2": "res://assets/world/tiles/House_2 (open).png",
    "house_3": "res://assets/world/tiles/House_3 (open).png",
    "house_small": "res://assets/world/tiles/House_small_1 (open).png",
    "well": "res://assets/world/tiles/Well_1.png",
    "sign_sword": "res://assets/world/objects/Wooden sign (sword).png",
    "sign_skull": "res://assets/world/objects/Wooden sign (skull).png",
    "sign_beer": "res://assets/world/objects/Wooden sign (beer).png",
    "sign_potion": "res://assets/world/objects/Wooden sign (potion).png",
    "forest_g": "res://assets/world/tiles/Forest tiles_1.png",
    "forest_t": "res://assets/world/tiles/Forest tiles_3.png",
    "tree_a": "res://assets/world/tiles/Tree_A1.png",
    "tree_b": "res://assets/world/tiles/Tree_B1.png",
    "tree_c": "res://assets/world/tiles/Tree_C1.png",
    "tree_d": "res://assets/world/tiles/Tree_D1.png",
    "tree_e": "res://assets/world/tiles/Tree_E1.png",
    "tree_f": "res://assets/world/tiles/Tree_F1.png",
    "bush_a": "res://assets/world/tiles/Bush_A.png",
    "bush_b": "res://assets/world/tiles/Bush_B1.png",
    "bush_c": "res://assets/world/tiles/Bush_C1.png",
    "flower_1": "res://assets/world/tiles/Flower_1.png",
    "flower_3": "res://assets/world/tiles/Flower_3.png",
    "flower_4": "res://assets/world/tiles/Flower_4.png",
    "flower_6": "res://assets/world/tiles/Flower_6.png",
    "rock_1": "res://assets/world/tiles/Rock_1.png",
    "rock_3": "res://assets/world/tiles/Rock_3.png",
    # dungeon entrance (SE clearing): dungeon-pack door framed by rocks
    "dungeon_door": "res://assets/world/dungeon/door_front.png",
    "tallgrass": "res://assets/world/tiles/Tall grass.png",
    "stump": "res://assets/world/tiles/Tree stump.png",
    # town-life pass
    "torch_w": "res://assets/world/objects/Torch.png",
    "barrel_water": "res://assets/world/objects/Barrel_water.png",
    "fence_w": "res://assets/world/objects/Fences (wood).png",
    "crop_carrot": "res://assets/world/objects/Crops (carrot).png",
    "crop_sunflower": "res://assets/world/objects/Crops (sunflower).png",
    "crop_berries": "res://assets/world/objects/Crops (berries).png",
    "apple": "res://assets/world/objects/Apple.png",
    "orange": "res://assets/world/objects/Orange.png",
    "peach": "res://assets/world/objects/Peach.png",
    "hen_idle": "res://assets/characters/animals/hen_idle.png",
    "hen_walk": "res://assets/characters/animals/hen_walk.png",
    "pig_idle": "res://assets/characters/animals/pig_idle.png",
    "pig_walk": "res://assets/characters/animals/pig_walk.png",
    "cow_idle": "res://assets/characters/animals/cow_idle.png",
    "cow_walk": "res://assets/characters/animals/cow_walk.png",
    "walker1_idle": "res://assets/characters/npc_walker1_idle.png",
    "walker1_walk": "res://assets/characters/npc_walker1_walk.png",
    "walker2_idle": "res://assets/characters/npc_walker2_idle.png",
    "walker2_walk": "res://assets/characters/npc_walker2_walk.png",
    "walker3_idle": "res://assets/characters/npc_walker3_idle.png",
    "walker3_walk": "res://assets/characters/npc_walker3_walk.png",
}

INTERACTABLE = "res://scenes/actors/Interactable.tscn"
PLAYER = "res://scenes/actors/Player.tscn"
NPC_SCRIPT = "res://scenes/actors/NpcSprite.gd"
ANIM_SCRIPT = "res://scenes/actors/AnimFrames.gd"
WANDER_SCRIPT = "res://scenes/actors/WanderActor.gd"
TORCH_SCRIPT = "res://scenes/world/fx/TorchFlicker.gd"
SMOKE_SCENE = "res://scenes/world/fx/ChimneySmoke.tscn"
LEAVES_SCENE = "res://scenes/world/fx/FallingLeaves.tscn"
FOREST_REGION = "Rect2(0, 0, 352, 288)"


def rect(cx, cy, w, h) -> str:
    """Region rect from sheet-cell coords (w/h in cells)."""
    return f"Rect2({cx * 32}, {cy * 32}, {w * 32}, {h * 32})"


def pack_cells(cells: dict) -> str:
    raw = struct.pack("<H", 0)
    for (x, y), (src, (ax, ay)) in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        raw += struct.pack("<hhHHHH", x, y, src, ax, ay, 0)
    return base64.b64encode(raw).decode()


class B:
    """Tiny .tscn text builder (same conventions as gen_hunt_tscn.py)."""

    def __init__(self):
        self.ext = []    # (type, path, id)
        self.subs = []   # (id, body_text)
        self.nodes = []

    def ext_id(self, type_: str, path: str) -> str:
        for t, p, i in self.ext:
            if p == path:
                return i
        i = f"{len(self.ext) + 1}"
        self.ext.append((type_, path, i))
        return i

    def sub_rect(self, sid: str, w: float, h: float) -> str:
        body = f'[sub_resource type="RectangleShape2D" id="{sid}"]\nsize = Vector2({w}, {h})\n'
        if not any(s[0] == sid for s in self.subs):
            self.subs.append((sid, body))
        return sid

    def node(self, text: str) -> None:
        self.nodes.append(text)

    def write(self, path: str) -> None:
        out = [f"[gd_scene load_steps={len(self.ext) + len(self.subs) + 1} format=3]\n"]
        for t, p, i in self.ext:
            out.append(f'[ext_resource type="{t}" path="{p}" id="{i}"]')
        out.append("")
        for _sid, body in self.subs:
            out.append(body)
        out.append("\n\n".join(self.nodes))
        out.append("")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(out))
        print("wrote", path)


# ---------------------------------------------------------------------------
# Shared scene chunks
# ---------------------------------------------------------------------------
def add_sprite(b: B, name: str, parent: str, tex_key: str, x: float, y: float,
               z: int = -4, region: str = "", hframes: int = 0, anim_fps: float = 0.0):
    tid = b.ext_id("Texture2D", ASSET[tex_key])
    lines = [f'[node name="{name}" type="Sprite2D" parent="{parent}"]']
    if anim_fps > 0:
        sid = b.ext_id("Script", ANIM_SCRIPT)
        lines.append(f'script = ExtResource("{sid}")')
        lines.append(f"fps = {anim_fps}")
    if z:
        lines.append(f"z_index = {z}")
    lines.append(f"position = Vector2({x}, {y})")
    lines.append(f'texture = ExtResource("{tid}")')
    if hframes:
        lines.append(f"hframes = {hframes}")
    if region:
        lines.append("region_enabled = true")
        lines.append(f"region_rect = {region}")
    b.node("\n".join(lines))


def add_npc(b: B, name: str, tex_key: str, x: float, y: float, prompt: str):
    tid = b.ext_id("Texture2D", ASSET[tex_key])
    sid = b.ext_id("Script", NPC_SCRIPT)
    iid = b.ext_id("PackedScene", INTERACTABLE)
    shape = b.sub_rect("npc_body", 20, 12)
    b.node(f'[node name="{name}" type="Node2D" parent="."]\nposition = Vector2({x}, {y})')
    b.node(f'[node name="Sprite" type="Sprite2D" parent="{name}"]\n'
           f'script = ExtResource("{sid}")\n'
           f'texture = ExtResource("{tid}")\nhframes = 4\nvframes = 4')
    b.node(f'[node name="Body" type="StaticBody2D" parent="{name}"]\n'
           f'collision_layer = 2\ncollision_mask = 0')
    b.node(f'[node name="Shape" type="CollisionShape2D" parent="{name}/Body"]\n'
           f'position = Vector2(0, 16)\nshape = SubResource("{shape}")')
    b.node(f'[node name="Interact" parent="{name}" instance=ExtResource("{iid}")]\n'
           f'prompt = "{prompt}"')


def add_exit_door(b: B, name: str, x: float, y: float, prompt: str):
    tid = b.ext_id("Texture2D", ASSET["door"])
    iid = b.ext_id("PackedScene", INTERACTABLE)
    b.node(f'[node name="{name}" type="Node2D" parent="."]\nposition = Vector2({x}, {y})')
    b.node(f'[node name="Visual" type="Sprite2D" parent="{name}"]\nz_index = -3\n'
           f'texture = ExtResource("{tid}")')
    b.node(f'[node name="Interact" parent="{name}" instance=ExtResource("{iid}")]\n'
           f'position = Vector2(0, -24)\nprompt = "{prompt}"')


def add_marker(b: B, name: str, x: float, y: float):
    b.node(f'[node name="{name}" type="Marker2D" parent="."]\nposition = Vector2({x}, {y})')


def add_torch(b: B, name: str, parent: str, x: float, y: float):
    """World torch with the warm modulate-flicker script (single-frame art)."""
    tid = b.ext_id("Texture2D", ASSET["torch_w"])
    sid = b.ext_id("Script", TORCH_SCRIPT)
    b.node(f'[node name="{name}" type="Sprite2D" parent="{parent}"]\n'
           f'script = ExtResource("{sid}")\n'
           f'position = Vector2({x}, {y})\n'
           f'texture = ExtResource("{tid}")')


def add_wander(b: B, name: str, parent: str, idle_key: str, walk_key: str,
               x: float, y: float, bounds: tuple, speed: float):
    """Ambient wanderer (animal / pedestrian) — WanderActor.gd on a Sprite2D."""
    iid = b.ext_id("Texture2D", ASSET[idle_key])
    wid = b.ext_id("Texture2D", ASSET[walk_key])
    sid = b.ext_id("Script", WANDER_SCRIPT)
    bx, by, bw, bh = bounds
    b.node(f'[node name="{name}" type="Sprite2D" parent="{parent}"]\n'
           f'script = ExtResource("{sid}")\n'
           f'position = Vector2({x}, {y})\n'
           f'texture = ExtResource("{iid}")\n'
           f'idle_texture = ExtResource("{iid}")\n'
           f'walk_texture = ExtResource("{wid}")\n'
           f'bounds = Rect2({bx}, {by}, {bw}, {bh})\n'
           f'speed = {speed}')


def add_fx(b: B, name: str, parent: str, scene_path: str, x: float, y: float):
    """Instance one of the fx scenes (chimney smoke / falling leaves)."""
    pid = b.ext_id("PackedScene", scene_path)
    b.node(f'[node name="{name}" parent="{parent}" instance=ExtResource("{pid}")]\n'
           f'position = Vector2({x}, {y})')


def add_player(b: B, x: float, y: float):
    pid = b.ext_id("PackedScene", PLAYER)
    b.node(f'[node name="Player" parent="." instance=ExtResource("{pid}")]\n'
           f'position = Vector2({x}, {y})')


def interior_base(b: B, script_path: str, root: str, cols: int, rows: int,
                  wall_theme: str, floor_key: str, colliders: list):
    """Root + void Bg + framed floor TileMapLayer + border/prop collisions."""
    w, h = cols * TILE, rows * TILE
    sid = b.ext_id("Script", script_path)
    tsid = b.ext_id("TileSet", "res://assets/tiles/interior.tres")
    b.node(f'[node name="{root}" type="Node2D"]\nscript = ExtResource("{sid}")')
    b.node(f'[node name="Bg" type="ColorRect" parent="."]\nz_index = -11\n'
           f'offset_left = {-w}\noffset_top = {-h}\noffset_right = {w * 2}\noffset_bottom = {h * 2}\n'
           f'color = {VOID}')

    wt, wb = WALLS_BY_THEME[wall_theme]
    fl = FLOORS[floor_key]
    cells = {}
    cells[(0, 0)] = (0, FRAME["tl"])
    cells[(cols - 1, 0)] = (0, FRAME["tr"])
    cells[(0, rows - 1)] = (0, FRAME["bl"])
    cells[(cols - 1, rows - 1)] = (0, FRAME["br"])
    for x in range(1, cols - 1):
        cells[(x, 0)] = (0, FRAME["t"])
        cells[(x, rows - 1)] = (0, FRAME["b"])
        cells[(x, 1)] = (0, wt)
        cells[(x, 2)] = (0, wb)
        for y in range(3, rows - 1):
            cells[(x, y)] = (0, fl)
    for y in range(1, rows - 1):
        cells[(0, y)] = (0, FRAME["l"])
        cells[(cols - 1, y)] = (0, FRAME["r"])

    b.node(f'[node name="Floor" type="TileMapLayer" parent="."]\nz_index = -10\n'
           f'tile_map_data = PackedByteArray("{pack_cells(cells)}")\n'
           f'tile_set = ExtResource("{tsid}")')

    b.node('[node name="Walls" type="StaticBody2D" parent="."]\n'
           'collision_layer = 2\ncollision_mask = 0')
    border = [
        (w / 2, 48, w, 96),                 # top: frame edge + 2-row wall band
        (w / 2, h - 16, w, 32),             # bottom frame edge
        (16, h / 2, 32, h),                 # left
        (w - 16, h / 2, 32, h),             # right
    ]
    for i, (cx, cy, cw, ch) in enumerate(border + colliders):
        shape = b.sub_rect(f"col_{int(cw)}x{int(ch)}", cw, ch)
        b.node(f'[node name="Wall{i}" type="CollisionShape2D" parent="Walls"]\n'
               f'position = Vector2({cx}, {cy})\nshape = SubResource("{shape}")')


# ---------------------------------------------------------------------------
# Room: 640x480 cozy bedroom
# ---------------------------------------------------------------------------
def gen_room():
    b = B()
    colliders = [
        (96, 160, 60, 70),     # bed
        (200, 150, 56, 20),    # bookshelf feet
        (552, 150, 56, 20),    # wardrobe feet
        (480, 146, 56, 20),    # fireplace base
        (320, 210, 56, 26),    # table
        (60, 268, 20, 14),     # plant pot
        (560, 314, 28, 16),    # crate
    ]
    interior_base(b, "res://scenes/world/Room.gd", "Room", 20, 15, "plank", "planks_orange", colliders)

    # Furniture (sheet regions; pixel-exact rects come from alpha-bbox scans —
    # several props are NOT cell-aligned in the sheets).
    add_sprite(b, "Carpet", ".", "interior_main", 320, 300, z=-7,
               region="Rect2(4, 932, 88, 88)")
    add_sprite(b, "Bed", ".", "interior_bedroom", 96, 150,
               region="Rect2(16, 518, 64, 74)")
    add_sprite(b, "Window", ".", "interior_bedroom", 320, 64, z=-6,
               region="Rect2(400, 74, 62, 50)")
    add_sprite(b, "Bookshelf", ".", "interior_main", 200, 110, region=rect(6, 12, 2, 3))
    add_sprite(b, "Wardrobe", ".", "interior_main", 552, 110, region=rect(0, 12, 2, 3))
    add_sprite(b, "Table", ".", "interior_main", 320, 192, region=rect(4, 15, 2, 2))
    add_sprite(b, "Plant", ".", "interior_main", 60, 250, region=rect(21, 12, 1, 2))
    add_sprite(b, "Crate", ".", "crate", 560, 304)
    add_sprite(b, "Stool", ".", "stool", 384, 220)
    # Animated warmth: fireplace on the top wall + a candle on the table.
    add_sprite(b, "Fireplace", ".", "fireplace", 480, 96, hframes=4, anim_fps=6.0)
    add_sprite(b, "Candle", ".", "candle", 320, 162, z=-3, hframes=4, anim_fps=6.0)

    add_exit_door(b, "DoorToTown", 320, 452, "마을로")
    add_player(b, 320, 280)
    add_marker(b, "start", 320, 280)
    add_marker(b, "bed", 110, 200)
    add_marker(b, "from_town", 320, 404)
    b.write("scenes/world/Room.tscn")


# ---------------------------------------------------------------------------
# Equipment shop interior: smithy/workshop, 640x480
# ---------------------------------------------------------------------------
def gen_equip_shop():
    b = B()
    colliders = [
        (140, 150, 60, 24),    # stone furnace
        (320, 152, 120, 20),   # blacksmith furnace strip
        (520, 150, 60, 24),    # worktable
        (320, 276, 124, 36),   # shop counter
        (452, 308, 24, 12),    # anvil
        (60, 196, 24, 14),     # sword barrel
        (60, 250, 24, 12),     # coal basket
        (584, 220, 24, 14),    # grinding wheel
    ]
    interior_base(b, "res://scenes/world/EquipShopInterior.gd", "EquipShopInterior",
                  20, 15, "brick", "cobble", colliders)

    add_sprite(b, "Furnace", ".", "interior_workshop", 140, 112, region=rect(4, 0, 2, 3))
    add_sprite(b, "BsFurnace", ".", "bs_furnace", 320, 128, hframes=4, anim_fps=8.0)
    add_sprite(b, "Worktable", ".", "interior_workshop", 520, 112, region=rect(0, 0, 2, 3))
    add_sprite(b, "RackWeapons", ".", "rack_weapons", 240, 112)
    add_sprite(b, "RackShields", ".", "rack_shields", 412, 112)
    add_sprite(b, "Counter", ".", "counters", 320, 256, region=rect(3, 0, 3, 2))
    add_sprite(b, "Anvil", ".", "anvil_s", 452, 296)
    add_sprite(b, "BarrelSwords", ".", "barrel_swords", 60, 180)
    add_sprite(b, "BasketCoal", ".", "basket_coal", 60, 244)
    add_sprite(b, "GrindWheel", ".", "grindwheel", 584, 204)
    add_sprite(b, "IngotIron", ".", "ingot_iron", 104, 320, z=-6)
    add_sprite(b, "IngotGold", ".", "ingot_gold", 136, 348, z=-6)
    add_sprite(b, "Torch1", ".", "torch_front", 200, 64, z=-3, hframes=4, anim_fps=6.0)
    add_sprite(b, "Torch2", ".", "torch_front", 440, 64, z=-3, hframes=4, anim_fps=6.0)

    add_npc(b, "MerchantNPC", "npc_merchant", 252, 218, "구매·제작")
    add_npc(b, "BlacksmithNPC", "npc_blacksmith", 452, 248, "강화")
    add_exit_door(b, "ExitDoor", 320, 452, "마을로")
    add_player(b, 320, 380)
    add_marker(b, "from_town", 320, 396)
    b.write("scenes/world/EquipShopInterior.tscn")


# ---------------------------------------------------------------------------
# Gamble house interior: tavern/casino, 640x480
# ---------------------------------------------------------------------------
def gen_gamble():
    b = B()
    colliders = [
        (200, 196, 124, 36),   # bar counter
        (520, 196, 28, 20),    # barrel by the bar
        (560, 150, 40, 20),    # treasure chest
        (140, 322, 56, 26),    # table 1
        (320, 342, 56, 26),    # table 2
        (500, 322, 56, 26),    # table 3
    ]
    interior_base(b, "res://scenes/world/GambleInterior.gd", "GambleInterior",
                  20, 15, "red", "ornate_red", colliders)

    add_sprite(b, "Carpet", ".", "interior_main", 320, 330, z=-7,
               region="Rect2(484, 932, 88, 88)")
    add_sprite(b, "BarCounter", ".", "counters", 200, 180, region=rect(3, 0, 3, 2))
    add_sprite(b, "Barrel", ".", "barrel", 520, 184)
    add_sprite(b, "TreasureChest", ".", "chest_big", 560, 140)
    # Tavern tables reuse the verified main-sheet dining table (plates + bottle).
    add_sprite(b, "Table1", ".", "interior_main", 140, 304, region=rect(4, 15, 2, 2))
    add_sprite(b, "Table2", ".", "interior_main", 320, 324, region=rect(4, 15, 2, 2))
    add_sprite(b, "Table3", ".", "interior_main", 500, 304, region=rect(4, 15, 2, 2))
    add_sprite(b, "Stool1", ".", "stool", 92, 312)
    add_sprite(b, "Stool2", ".", "stool", 272, 332)
    add_sprite(b, "Stool3", ".", "stool", 548, 312)
    add_sprite(b, "Torch1", ".", "torch_front", 120, 64, z=-3, hframes=4, anim_fps=6.0)
    add_sprite(b, "Torch2", ".", "torch_front", 520, 64, z=-3, hframes=4, anim_fps=6.0)
    # On the bar counter (the dining-table region already includes its own candle).
    add_sprite(b, "Candle1", ".", "candle", 232, 148, z=-3, hframes=4, anim_fps=7.0)

    add_npc(b, "BartenderNPC", "npc_bartender", 200, 136, "카지노")
    add_exit_door(b, "ExitDoor", 320, 452, "마을로")
    add_player(b, 320, 380)
    add_marker(b, "from_town", 320, 396)
    b.write("scenes/world/GambleInterior.tscn")


# ---------------------------------------------------------------------------
# Potion shop interior: alchemy lab, 640x480
# ---------------------------------------------------------------------------
def gen_potion_shop():
    b = B()
    colliders = [
        (80, 150, 56, 20),     # shelf 1
        (240, 150, 56, 20),    # potion shelf
        (560, 162, 56, 20),    # skull desk (taller sprite, feet sit lower)
        (320, 276, 124, 36),   # alchemy counter
        (140, 330, 80, 24),    # alchemy table
        (520, 312, 24, 12),    # cauldron
        (584, 230, 28, 18),    # enchantment table
        (60, 224, 20, 12),     # big jar 1
        (60, 300, 20, 12),     # big jar 2
    ]
    interior_base(b, "res://scenes/world/PotionShopInterior.gd", "PotionShopInterior",
                  20, 15, "navy", "cream_squares", colliders)

    add_sprite(b, "MagicCircle", ".", "interior_alchemy", 320, 370, z=-7, region=rect(12, 20, 3, 3))
    add_sprite(b, "WindowGreen", ".", "interior_alchemy", 160, 64, z=-6, region=rect(0, 6, 2, 2))
    add_sprite(b, "WindowPink", ".", "interior_alchemy", 480, 64, z=-6, region=rect(2, 6, 2, 2))
    add_sprite(b, "Shelf1", ".", "interior_alchemy", 80, 110, region=rect(2, 16, 2, 3))
    add_sprite(b, "PotionShelf", ".", "interior_alchemy", 240, 110, region=rect(4, 16, 2, 3))
    add_sprite(b, "SkullDesk", ".", "interior_alchemy", 560, 112,
               region="Rect2(0, 480, 64, 116)")
    add_sprite(b, "Counter", ".", "interior_alchemy", 320, 240, region=rect(4, 10, 4, 3))
    add_sprite(b, "BigJarGreen", ".", "interior_alchemy", 60, 192, region=rect(18, 10, 1, 3))
    add_sprite(b, "BigJarPink", ".", "interior_alchemy", 60, 268, region=rect(19, 10, 1, 3))
    add_sprite(b, "Crystal1", ".", "interior_alchemy", 420, 390, z=-6, region=rect(9, 18, 1, 1))
    add_sprite(b, "Crystal2", ".", "interior_alchemy", 220, 410, z=-6, region=rect(13, 18, 1, 1))
    add_sprite(b, "AlchemyTable", ".", "alchemy_table", 140, 300, hframes=4, anim_fps=6.0)
    add_sprite(b, "EnchTable", ".", "ench_table", 584, 200, hframes=4, anim_fps=6.0)
    add_sprite(b, "Cauldron", ".", "cauldron", 520, 300, hframes=4, anim_fps=6.0)

    add_npc(b, "AlchemistNPC", "npc_alchemist", 320, 200, "물약 상점")
    add_exit_door(b, "ExitDoor", 320, 452, "마을로")
    add_player(b, 320, 380)
    add_marker(b, "from_town", 320, 396)
    b.write("scenes/world/PotionShopInterior.tscn")


# ---------------------------------------------------------------------------
# Town: 2048x1280 exploration village
# ---------------------------------------------------------------------------
T_COLS, T_ROWS = 64, 40
T_W, T_H = T_COLS * TILE, T_ROWS * TILE

# Building centres (sprite 160x160 centred here, open door at bottom middle).
HOUSE_EQUIP = (448, 288)
HOUSE_GAMBLE = (1600, 288)
HOUSE_POTION = (1024, 256)
HOUSE_PLAYER = (640, 1040)
WELL = (1024, 672)
# North exit to the hunting-ground chain: the road between the potion shop and
# the gamble house runs to the top edge; an invisible Interactable at its end is
# the "door" (the [E]/touch button does the rest).
HUNT_EXIT = (1344, 130)


def _road_cell(path: set, x: int, y: int) -> tuple:
    t, bm = (x, y - 1) in path, (x, y + 1) in path
    l, r = (x - 1, y) in path, (x + 1, y) in path
    if not t and not l: return (0, 0)
    if not t and not r: return (2, 0)
    if not bm and not l: return (0, 2)
    if not bm and not r: return (2, 2)
    if not t: return (1, 0)
    if not bm: return (1, 2)
    if not l: return (0, 1)
    if not r: return (2, 1)
    return (1, 1)   # Roads_stone has no inner-corner pieces; plain centre reads fine


def town_tile_data() -> str:
    path = set()
    # Main horizontal road (rows 19-20), west edge to the east forest.
    for x in range(2, T_COLS):
        for y in (19, 20):
            path.add((x, y))
    # Main vertical road (cols 31-32) from the potion shop down to the south road.
    for y in range(10, 36):
        for x in (31, 32):
            path.add((x, y))
    # North road (cols 41-42) up to the top edge: the hunt-chain exit.
    for y in range(0, 21):
        for x in (41, 42):
            path.add((x, y))
    # Shop spurs.
    for y in range(11, 21):
        for x in (13, 14):       # equip (NW)
            path.add((x, y))
        for x in (49, 50):       # gamble (NE)
            path.add((x, y))
    # South road to the player's house.
    for y in (34, 35):
        for x in range(19, 33):
            path.add((x, y))
    # Plaza around the well.
    for y in range(17, 24):
        for x in range(27, 37):
            path.add((x, y))

    cells = {}
    for y in range(T_ROWS):
        for x in range(T_COLS):
            if (x, y) in path:
                cells[(x, y)] = (ROAD_STONE_SRC, _road_cell(path, x, y))
            else:
                cells[(x, y)] = (GRASS_SRC, GRASS_CELL)
    return pack_cells(cells)


TOWN_TREES = [
    ("tree_f", 180, 200), ("tree_a", 270, 480), ("tree_c", 150, 620),
    ("tree_d", 700, 220), ("tree_b", 820, 420), ("tree_e", 250, 880),
    ("tree_f", 1250, 180), ("tree_a", 1440, 460), ("tree_c", 1820, 480),
    ("tree_d", 1880, 220), ("tree_e", 1500, 560), ("tree_b", 760, 580),
    ("tree_a", 360, 1130), ("tree_e", 950, 1160), ("tree_c", 1180, 1000),
    ("tree_f", 1400, 900), ("tree_d", 1650, 1100), ("tree_b", 1850, 950),
    ("tree_e", 130, 1050), ("tree_a", 1750, 820), ("tree_c", 540, 700),
    ("tree_d", 880, 800), ("tree_b", 160, 380), ("tree_f", 1980, 1150),
    # Flank the canopy gap over the north (hunt) road so it reads as a forest path.
    ("tree_e", 1248, 120), ("tree_b", 1444, 112),
    # Flank the west/east road gaps (미구현 exits).
    ("tree_a", 124, 548), ("tree_c", 120, 728),
    ("tree_d", 1928, 544), ("tree_e", 1924, 732),
]
TOWN_BUSHES = [
    ("bush_a", 340, 240), ("bush_c", 560, 540), ("bush_b", 1150, 420),
    ("bush_a", 1700, 380), ("bush_c", 480, 940), ("bush_b", 1300, 1120),
    ("bush_a", 1550, 760), ("bush_c", 850, 1080),
]
TOWN_FLOWERS = [
    ("flower_1", 900, 560), ("flower_3", 1130, 560), ("flower_4", 900, 780),
    ("flower_6", 1140, 780), ("flower_1", 380, 420), ("flower_3", 1520, 420),
    ("flower_4", 240, 760), ("flower_6", 1800, 580), ("flower_1", 540, 1130),
    ("flower_3", 760, 990), ("flower_4", 1280, 880), ("flower_6", 1060, 1100),
]
TOWN_MISC = [
    ("rock_1", 300, 700), ("rock_3", 1730, 520), ("rock_1", 1450, 1060),
    ("stump", 200, 480), ("stump", 1900, 880),
    ("tallgrass", 350, 560), ("tallgrass", 720, 920), ("tallgrass", 1430, 360),
    ("tallgrass", 1620, 940), ("tallgrass", 250, 1140), ("tallgrass", 1880, 760),
    ("barrel", 540, 1000), ("crate", 580, 1010), ("barrel", 366, 350),
    ("crate", 1530, 350), ("barrel", 1110, 320),
]


def gen_town():
    b = B()
    sid = b.ext_id("Script", "res://scenes/world/Town.gd")
    tsid = b.ext_id("TileSet", "res://assets/tiles/world.tres")
    iid = b.ext_id("PackedScene", INTERACTABLE)

    b.node(f'[node name="Town" type="Node2D"]\nscript = ExtResource("{sid}")')
    b.node(f'[node name="Ground" type="TileMapLayer" parent="."]\nz_index = -10\n'
           f'tile_map_data = PackedByteArray("{town_tile_data()}")\n'
           f'tile_set = ExtResource("{tsid}")')

    # Decor sprites (z=-9): trees / bushes / flowers / misc.
    b.node('[node name="Decor" type="Node2D" parent="."]\nz_index = -9')
    for i, (key, x, y) in enumerate(TOWN_TREES + TOWN_BUSHES + TOWN_FLOWERS + TOWN_MISC):
        add_sprite(b, f"Decor{i}", "Decor", key, x, y, z=0)

    # Buildings (z=-5) + hanging signs (z=-4).
    for name, key, (x, y) in [
        ("EquipShopHouse", "house_1", HOUSE_EQUIP),
        ("GambleHouse", "house_2", HOUSE_GAMBLE),
        ("PotionShopHouse", "house_3", HOUSE_POTION),
        ("PlayerHouse", "house_small", HOUSE_PLAYER),
    ]:
        add_sprite(b, name, ".", key, x, y, z=-5)
    add_sprite(b, "SignSword", ".", "sign_sword", HOUSE_EQUIP[0] + 64, HOUSE_EQUIP[1] + 56, z=-4)
    add_sprite(b, "SignBeer", ".", "sign_beer", HOUSE_GAMBLE[0] + 64, HOUSE_GAMBLE[1] + 56, z=-4)
    add_sprite(b, "SignPotion", ".", "sign_potion", HOUSE_POTION[0] + 64, HOUSE_POTION[1] + 56, z=-4)
    add_sprite(b, "Well", ".", "well", WELL[0], WELL[1], z=-5)

    # --- Town-life: fenced crop field east of the player's house ---------------
    b.node('[node name="Field" type="Node2D" parent="."]\nz_index = -6')
    # fence: horizontal runs (sheet row 0: L-cap / rail / R-cap) + post columns
    for fy, row in ((976, "Top"), (1072, "Bottom")):
        add_sprite(b, f"Fence{row}L", "Field", "fence_w", 772, fy, z=0, region=rect(0, 0, 1, 1))
        for i, fx in enumerate((804, 836, 868, 900)):
            add_sprite(b, f"Fence{row}{i}", "Field", "fence_w", fx, fy, z=0, region=rect(1, 0, 1, 1))
        add_sprite(b, f"Fence{row}R", "Field", "fence_w", 932, fy, z=0, region=rect(2, 0, 1, 1))
    for fx, side in ((772, "L"), (932, "R")):
        for i, fy in enumerate((1008, 1040)):
            add_sprite(b, f"FencePost{side}{i}", "Field", "fence_w", fx, fy, z=0, region=rect(3, 1, 1, 1))
    # crops: full-grown plants span two sheet cells vertically (32x64)
    add_sprite(b, "CropSun1", "Field", "crop_sunflower", 804, 1000, z=0, region="Rect2(64, 0, 32, 64)")
    add_sprite(b, "CropSun2", "Field", "crop_sunflower", 868, 1032, z=0, region="Rect2(64, 0, 32, 64)")
    add_sprite(b, "CropCarrot1", "Field", "crop_carrot", 836, 1008, z=0, region="Rect2(32, 32, 32, 32)")
    add_sprite(b, "CropCarrot2", "Field", "crop_carrot", 900, 1040, z=0, region="Rect2(96, 32, 32, 32)")
    add_sprite(b, "CropBerry1", "Field", "crop_berries", 900, 1008, z=0, region="Rect2(64, 0, 32, 64)")
    add_sprite(b, "CropBerry2", "Field", "crop_berries", 804, 1040, z=0, region="Rect2(32, 32, 32, 32)")
    add_sprite(b, "CropCarrot3", "Field", "crop_carrot", 868, 1000, z=0, region="Rect2(32, 32, 32, 32)")

    # --- Town-life: plaza torches (flicker script) + water barrels + fruit -----
    b.node('[node name="TownProps" type="Node2D" parent="."]\nz_index = -6')
    for i, (tx, ty) in enumerate(((880, 560), (1168, 560), (880, 752), (1168, 752))):
        add_torch(b, f"Torch{i}", "TownProps", tx, ty)
    add_sprite(b, "WaterBarrel1", "TownProps", "barrel_water", 530, 348, z=0)
    add_sprite(b, "WaterBarrel2", "TownProps", "barrel_water", 1672, 350, z=0)
    add_sprite(b, "FruitApple", "TownProps", "apple", 972, 708, z=0)
    add_sprite(b, "FruitOrange", "TownProps", "orange", 1076, 712, z=0)
    add_sprite(b, "FruitPeach", "TownProps", "peach", 996, 640, z=0)

    # --- Town-life: wandering animals + pedestrians (pass-through ambience) ----
    b.node('[node name="Ambient" type="Node2D" parent="."]')
    add_wander(b, "HenA", "Ambient", "hen_idle", "hen_walk", 330, 800, (250, 740, 250, 160), 11)
    add_wander(b, "HenB", "Ambient", "hen_idle", "hen_walk", 1300, 950, (1200, 880, 250, 160), 11)
    add_wander(b, "Pig", "Ambient", "pig_idle", "pig_walk", 430, 850, (250, 740, 300, 200), 13)
    add_wander(b, "Cow", "Ambient", "cow_idle", "cow_walk", 1700, 700, (1560, 620, 300, 200), 10)
    add_wander(b, "Walker1", "Ambient", "walker1_idle", "walker1_walk", 500, 632, (300, 614, 550, 40), 22)
    add_wander(b, "Walker2", "Ambient", "walker2_idle", "walker2_walk", 1400, 632, (1180, 614, 600, 40), 22)
    add_wander(b, "Walker3", "Ambient", "walker3_idle", "walker3_walk", 1020, 800, (998, 700, 44, 350), 20)

    # --- Town-life: chimney smoke per house + drifting leaves ------------------
    b.node('[node name="Fx" type="Node2D" parent="."]')
    for name, (hx, hy) in (("SmokeEquip", HOUSE_EQUIP), ("SmokeGamble", HOUSE_GAMBLE),
                           ("SmokePotion", HOUSE_POTION), ("SmokePlayer", HOUSE_PLAYER)):
        add_fx(b, name, "Fx", SMOKE_SCENE, hx - 34, hy - 62)
    add_fx(b, "LeavesPlaza", "Fx", LEAVES_SCENE, WELL[0], WELL[1] - 20)
    add_fx(b, "LeavesMeadow", "Fx", LEAVES_SCENE, 450, 950)

    # Forest canopy border (z=-8) — hides the map edge like the hunting ground.
    # The top strip leaves a gap over the north road (cols 41-42, x 1312-1376) so
    # the hunt path reads as continuing into the forest; flanking trees in
    # TOWN_TREES frame the opening.
    b.node('[node name="Canopy" type="Node2D" parent="."]\nz_index = -8')
    top_xs = [x for x in range(64, T_W + 1, 320) if x != 1344] + [1136, 1552]
    # Side strips leave a gap over the main horizontal road (rows 19-20, y
    # 608-672) — the west/east paths read as continuing into the forest (the
    # exits are 미구현 notice Interactables for now).
    side_ys = [64, 352, 456, 824, 1112, 1300]
    patches = ([("forest_t", 240, -40), ("forest_t", 1500, 1368), ("forest_t", -60, 900)]
               + [("forest_g", x, -56) for x in top_xs]
               + [("forest_g", x, T_H + 56) for x in range(64, T_W + 1, 320)]
               + [("forest_g", -100, y) for y in side_ys]
               + [("forest_g", T_W + 100, y) for y in side_ys])
    for i, (key, x, y) in enumerate(patches):
        tid = b.ext_id("Texture2D", ASSET[key])
        b.node(f'[node name="Patch{i}" type="Sprite2D" parent="Canopy"]\n'
               f'position = Vector2({x}, {y})\n'
               f'texture = ExtResource("{tid}")\n'
               f'region_enabled = true\nregion_rect = {FOREST_REGION}')

    # Collisions: border walls inside the canopy + building/well/decor feet.
    b.node('[node name="Walls" type="StaticBody2D" parent="."]\n'
           'collision_layer = 2\ncollision_mask = 0')
    walls = [
        (T_W / 2, 80, T_W, 16), (T_W / 2, T_H - 80, T_W, 16),
        (72, T_H / 2, 16, T_H), (T_W - 72, T_H / 2, 16, T_H),
    ]
    for name_key, (hx, hy) in [("equip", HOUSE_EQUIP), ("gamble", HOUSE_GAMBLE),
                               ("potion", HOUSE_POTION), ("player", HOUSE_PLAYER)]:
        walls.append((hx, hy + 14, 150, 116))
    walls.append((WELL[0], WELL[1] + 8, 56, 44))
    walls.append((852, 1024, 176, 102))   # fenced crop field
    for key, x, y in TOWN_TREES:
        walls.append((x, y + 38, 28, 14))
    wi = 0
    for cx, cy, cw, ch in walls:
        shape = b.sub_rect(f"tcol_{int(cw)}x{int(ch)}", cw, ch)
        b.node(f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
               f'position = Vector2({cx}, {cy})\nshape = SubResource("{shape}")')
        wi += 1

    # Doors (Interactable zones at each building's open doorway).
    for name, (hx, hy), prompt in [
        ("DoorToEquip", HOUSE_EQUIP, "장비 상점"),
        ("DoorToGamble", HOUSE_GAMBLE, "도박장"),
        ("DoorToPotion", HOUSE_POTION, "물약 상점"),
        ("DoorToRoom", HOUSE_PLAYER, "내 방"),
    ]:
        b.node(f'[node name="{name}" parent="." instance=ExtResource("{iid}")]\n'
               f'position = Vector2({hx}, {hy + 64})\nprompt = "{prompt}"')

    # Hunt-chain exit at the end of the north road (invisible — button only).
    b.node(f'[node name="ExitToHunt" type="Node2D" parent="."]\n'
           f'position = Vector2({HUNT_EXIT[0]}, {HUNT_EXIT[1]})')
    b.node(f'[node name="Interact" parent="ExitToHunt" instance=ExtResource("{iid}")]\n'
           f'prompt = "사냥터로"')

    # West/east road ends: future areas — Town.gd pops a 미구현 notice.
    for name, (ex, ey), prompt in [
        ("ExitWest", (106, 640), "서쪽 숲으로"),
        ("ExitEast", (T_W - 106, 640), "동쪽 숲으로"),
    ]:
        b.node(f'[node name="{name}" type="Node2D" parent="."]\n'
               f'position = Vector2({ex}, {ey})')
        b.node(f'[node name="Interact" parent="{name}" instance=ExtResource("{iid}")]\n'
               f'prompt = "{prompt}"')

    # Dungeon entrance (SE clearing): a rock mound with the dungeon-pack door
    # (frame 0 of the 4-frame strip) set into it, torch-lit so it reads from afar.
    DUN = (1760, 1012)
    b.node('[node name="DungeonMouth" type="Node2D" parent="."]\nz_index = -5')
    for i, (key, mx, my) in enumerate([
        ("rock_3", DUN[0] - 52, DUN[1] - 6), ("rock_1", DUN[0] + 52, DUN[1] - 6),
        ("rock_1", DUN[0] - 26, DUN[1] - 26), ("rock_3", DUN[0] + 26, DUN[1] - 26),
    ]):
        add_sprite(b, f"Rock{i}", "DungeonMouth", key, mx, my, z=0)
    add_sprite(b, "Door", "DungeonMouth", "dungeon_door", DUN[0], DUN[1], z=1, hframes=4)
    add_torch(b, "TorchL", "DungeonMouth", DUN[0] - 30, DUN[1] + 8)
    add_torch(b, "TorchR", "DungeonMouth", DUN[0] + 30, DUN[1] + 8)
    walls_mound = b.sub_rect("tcol_124x36", 124, 36)
    b.node(f'[node name="MoundCol" type="CollisionShape2D" parent="Walls"]\n'
           f'position = Vector2({DUN[0]}, {DUN[1] - 12})\nshape = SubResource("{walls_mound}")')
    b.node(f'[node name="DungeonEntrance" type="Node2D" parent="."]\n'
           f'position = Vector2({DUN[0]}, {DUN[1] + 30})')
    b.node(f'[node name="Interact" parent="DungeonEntrance" instance=ExtResource("{iid}")]\n'
           f'prompt = "던전 입구"')

    add_player(b, HOUSE_PLAYER[0], HOUSE_PLAYER[1] + 110)
    add_marker(b, "from_room", HOUSE_PLAYER[0], HOUSE_PLAYER[1] + 110)
    add_marker(b, "from_equip", HOUSE_EQUIP[0], HOUSE_EQUIP[1] + 112)
    add_marker(b, "from_gamble", HOUSE_GAMBLE[0], HOUSE_GAMBLE[1] + 112)
    add_marker(b, "from_potion", HOUSE_POTION[0], HOUSE_POTION[1] + 112)
    add_marker(b, "from_hunt", HUNT_EXIT[0], HUNT_EXIT[1] + 44)
    add_marker(b, "from_dungeon", 1760, 1086)
    add_marker(b, "from_town", HOUSE_PLAYER[0], HOUSE_PLAYER[1] + 110)  # legacy fallback
    b.write("scenes/world/Town.tscn")


if __name__ == "__main__":
    gen_room()
    gen_equip_shop()
    gen_gamble()
    gen_potion_shop()
    gen_town()
    print("all maps written")
