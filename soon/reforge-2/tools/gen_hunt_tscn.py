"""Generator (dev tool, not shipped at runtime). Rebuilds the hunting-ground
chain as three portrait 672x1056 deep-forest maps (HuntingGround1/2/3.tscn):
grass + vertical dirt road TileMapLayer, forest-canopy borders, per-map decor
palettes that read as a progressively deeper forest (green -> dark green ->
autumn/rocky), invisible road-end exits (ExitSouth/ExitNorth Interactables),
spawn markers (from_south/from_north), Monsters / Overlay / Player structure,
and the script exports HuntingGround.gd expects (stage / prev / next /
aggressive).

Counterpart of tools/gen_maps_tscn.py (Room / shop interiors / Town). Run from
the project root:
    python tools/gen_hunt_tscn.py
"""
import base64
import random
import struct

TILE = 32
COLS, ROWS = 21, 33          # 672 x 1056 (portrait: the chain runs northward)
W, H = COLS * TILE, ROWS * TILE

GRASS_SRC, GRASS_CELL = 0, (6, 1)   # world.tres source ids (0=Grass..3=Roads_stone)
ROAD_SRC = 2                        # Roads.png — 9-slice autotile w/ grass fringe

# Roads.png 9-slice: cols 0-2 = left/mid/right, rows 0-2 = top/mid/bottom edges;
# the 2x2 block at (3..4, 0..1) holds inner corners (grass tuft at one corner).
ROAD_INNER = {"br": (3, 0), "bl": (4, 0), "tr": (3, 1), "tl": (4, 1)}

def _road_cell(path: set, x: int, y: int) -> tuple:
    t, b = (x, y - 1) in path, (x, y + 1) in path
    l, r = (x - 1, y) in path, (x + 1, y) in path
    if not t and not l: return (0, 0)
    if not t and not r: return (2, 0)
    if not b and not l: return (0, 2)
    if not b and not r: return (2, 2)
    if not t: return (1, 0)
    if not b: return (1, 2)
    if not l: return (0, 1)
    if not r: return (2, 1)
    # Interior: a missing diagonal needs an inner-corner tuft piece.
    for diag, (dx, dy) in (("tl", (-1, -1)), ("tr", (1, -1)), ("bl", (-1, 1)), ("br", (1, 1))):
        if (x + dx, y + dy) not in path:
            return ROAD_INNER[diag]
    return (1, 1)

# ---------------------------------------------------------------------------
# Ground: full grass fill + a vertical road (cols 9-10) running edge to edge —
# both ends disappear under the canopy as if continuing south (town) / north
# (deeper forest). Small clearings at the two road ends.
# ---------------------------------------------------------------------------
def tile_map_data() -> str:
    path = set()
    for y in range(ROWS):
        for x in (9, 10):
            path.add((x, y))
    # Clearings around the spawn (south) and the far exit (north).
    for x in range(8, 12):
        for y in (28, 29):
            path.add((x, y))
        for y in (4, 5):
            path.add((x, y))

    cells = {}
    for y in range(ROWS):
        for x in range(COLS):
            if (x, y) in path:
                cells[(x, y)] = (ROAD_SRC, _road_cell(path, x, y))
            else:
                cells[(x, y)] = (GRASS_SRC, GRASS_CELL)

    raw = struct.pack("<H", 0)  # format version header
    for (x, y), (src, (ax, ay)) in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        raw += struct.pack("<hhHHHH", x, y, src, ax, ay, 0)
    return base64.b64encode(raw).decode()

# ---------------------------------------------------------------------------
# Textures
# ---------------------------------------------------------------------------
TEX = {
    "forest_g":  "res://assets/world/tiles/Forest tiles_1.png",
    "forest_o":  "res://assets/world/tiles/Forest tiles_2.png",
    "forest_t":  "res://assets/world/tiles/Forest tiles_3.png",
    "tree_a":    "res://assets/world/tiles/Tree_A1.png",
    "tree_b":    "res://assets/world/tiles/Tree_B1.png",
    "tree_c":    "res://assets/world/tiles/Tree_C1.png",
    "tree_e":    "res://assets/world/tiles/Tree_E1.png",
    "tree_a2":   "res://assets/world/tiles/Tree_A2.png",
    "tree_b2":   "res://assets/world/tiles/Tree_B2.png",
    "tree_a3":   "res://assets/world/tiles/Tree_A3.png",
    "tree_b3":   "res://assets/world/tiles/Tree_B3.png",
    "tree_c3":   "res://assets/world/tiles/Tree_C3.png",
    "tree_d3":   "res://assets/world/tiles/Tree_D3.png",
    "stump":     "res://assets/world/tiles/Tree stump.png",
    "root_a":    "res://assets/world/tiles/Root_A1.png",
    "root_c":    "res://assets/world/tiles/Root_C1.png",
    "rock1":     "res://assets/world/tiles/Rock_1.png",
    "rock2":     "res://assets/world/tiles/Rock_2.png",
    "rock3":     "res://assets/world/tiles/Rock_3.png",
    "rock4":     "res://assets/world/tiles/Rock_4.png",
    "bush":      "res://assets/world/tiles/Bush_A.png",
    "flower1":   "res://assets/world/tiles/Flower_1.png",
    "flower2":   "res://assets/world/tiles/Flower_2.png",
    "flower5":   "res://assets/world/tiles/Flower_5.png",
    "tallgrass": "res://assets/world/tiles/Tall grass.png",
    "leaves1":   "res://assets/world/tiles/Leaves_1.png",
    "leaves3":   "res://assets/world/tiles/Leaves_3.png",
    "mush1":     "res://assets/world/objects/Mushroom_1.png",
    "mush3":     "res://assets/world/objects/Mushroom_3.png",
}

FOREST_REGION = "Rect2(0, 0, 352, 288)"   # dense seamless patch of the sheet
MUSH_REGION = "Rect2(0, 0, 32, 32)"       # first frame of the 4-frame strip

# Monster spawn anchors flanking the vertical road (kept in sync with
# HuntingGround.gd ANCHORS — decor scatter stays clear of these).
ANCHORS = [(150, 220), (480, 200), (140, 420), (500, 440),
           (160, 640), (490, 620), (150, 820), (500, 840)]

PLAYER_POS = (320, 920)        # = from_south
NORTH_POS = (320, 160)         # = from_north
EXIT_S = (320, 962)
EXIT_N = (320, 130)   # low enough that the foot box reaches past the wall gap
ROAD_X = (256, 384)            # decor keep-out band around the road

# ---------------------------------------------------------------------------
# Per-map configs: progressively deeper forest, fixed monster stage.
# ---------------------------------------------------------------------------
HUNT_CFG = {
    1: {
        "stage": 1, "aggressive": False, "monster_speed": 1.0,
        "prev_scene": "res://scenes/world/Town.tscn", "prev_spawn": "from_hunt",
        "next_scene": "res://scenes/world/HuntingGround2.tscn",
        "prompt_s": "마을로", "prompt_n": "더 깊은 곳으로",
        "canopy_main": "forest_g", "canopy_accent": "forest_t",
        "trees": ["tree_a", "tree_b", "tree_c", "tree_e"], "n_trees": 9,
        "n_rocks": 4, "n_stumps": 2, "n_roots": 2, "n_mush": 3,
        "n_flowers": 6, "n_grass": 9, "n_leaves": 4, "n_bush": 2,
        "tint": None,
    },
    # 사냥터2부터는 선공 — 마을을 벗어날수록 적대적으로.
    2: {
        "stage": 2, "aggressive": True, "monster_speed": 1.0,
        "prev_scene": "res://scenes/world/HuntingGround1.tscn", "prev_spawn": "from_north",
        "next_scene": "res://scenes/world/HuntingGround3.tscn",
        "prompt_s": "이전 사냥터로", "prompt_n": "더 깊은 곳으로",
        "canopy_main": "forest_g", "canopy_accent": "forest_t",
        "trees": ["tree_a2", "tree_b2", "tree_a", "tree_b", "tree_a2", "tree_b2"], "n_trees": 14,
        "n_rocks": 4, "n_stumps": 3, "n_roots": 4, "n_mush": 6,
        "n_flowers": 3, "n_grass": 7, "n_leaves": 5, "n_bush": 2,
        "tint": (0.84, 0.88, 0.95),
    },
    # 사냥터3: 보스 직전 구간 — 선공 + 빠른 발걸음으로 긴장감을 끌어올린다.
    3: {
        "stage": 3, "aggressive": True, "monster_speed": 1.35,
        "prev_scene": "res://scenes/world/HuntingGround2.tscn", "prev_spawn": "from_north",
        "next_scene": "res://scenes/world/BossArena.tscn",
        "prompt_s": "이전 사냥터로", "prompt_n": "보스의 둥지로",
        "canopy_main": "forest_o", "canopy_accent": "forest_t",
        "trees": ["tree_a3", "tree_b3", "tree_c3", "tree_d3"], "n_trees": 11,
        "n_rocks": 8, "n_stumps": 5, "n_roots": 5, "n_mush": 4,
        "n_flowers": 0, "n_grass": 4, "n_leaves": 7, "n_bush": 0,
        "tint": (0.72, 0.65, 0.72),
    },
}

# ---------------------------------------------------------------------------
# Deterministic decor scatter (seeded per map): keeps clear of the road band,
# spawn anchors, exits and the canopy strips.
# ---------------------------------------------------------------------------
def _scatter(rng: random.Random, placed: list, n: int, min_gap: float) -> list:
    pts = []
    tries = 0
    while len(pts) < n and tries < 4000:
        tries += 1
        x = rng.uniform(100, W - 100)
        y = rng.uniform(130, H - 130)
        if ROAD_X[0] - 24 < x < ROAD_X[1] + 24:
            continue
        ok = True
        for ax, ay in ANCHORS:
            if abs(x - ax) < 48 and abs(y - ay) < 48:
                ok = False
                break
        if ok:
            for px, py in placed + pts:
                if abs(x - px) < min_gap and abs(y - py) < min_gap:
                    ok = False
                    break
        if ok:
            pts.append((round(x), round(y)))
    return pts

def build_decor(n_map: int, cfg: dict) -> tuple:
    """Returns (decor list of (key,x,y), tree_feet, rock_feet)."""
    rng = random.Random(1000 + n_map)
    placed = []

    trees = _scatter(rng, placed, cfg["n_trees"], 58)
    placed += trees
    rocks = _scatter(rng, placed, cfg["n_rocks"], 44)
    placed += rocks
    stumps = _scatter(rng, placed, cfg["n_stumps"], 40)
    placed += stumps
    small = _scatter(
        rng, placed,
        cfg["n_roots"] + cfg["n_mush"] + cfg["n_flowers"]
        + cfg["n_grass"] + cfg["n_leaves"] + cfg["n_bush"], 30)

    decor = []
    for x, y in trees:
        decor.append((rng.choice(cfg["trees"]), x, y))
    # Frame the canopy road gaps so the open path still reads as deep forest.
    for i, (x, y) in enumerate(GAP_TREES):
        decor.append((cfg["trees"][i % len(cfg["trees"])], x, y))
    trees = trees + GAP_TREES   # gap trees get solid feet too
    rock_keys = ["rock1", "rock2", "rock3", "rock4"]
    for x, y in rocks:
        decor.append((rng.choice(rock_keys), x, y))
    for x, y in stumps:
        decor.append(("stump", x, y))

    pool = (["root_a", "root_c"] * ((cfg["n_roots"] + 1) // 2))[:cfg["n_roots"]]
    pool += (["mush1", "mush3"] * ((cfg["n_mush"] + 1) // 2))[:cfg["n_mush"]]
    pool += (["flower1", "flower2", "flower5"] * ((cfg["n_flowers"] + 2) // 3))[:cfg["n_flowers"]]
    pool += ["tallgrass"] * cfg["n_grass"]
    pool += (["leaves1", "leaves3"] * ((cfg["n_leaves"] + 1) // 2))[:cfg["n_leaves"]]
    pool += ["bush"] * cfg["n_bush"]
    for (x, y), key in zip(small, pool):
        decor.append((key, x, y))

    tree_feet = [(x, y + 38) for x, y in trees]
    rock_feet = [(x, y + 4) for x, y in rocks]
    return decor, tree_feet, rock_feet

# Canopy border patches (z=-8). 352x288 patches centred so a strip stays
# visible inside the map while the rest hangs off-map. The top/bottom strips
# leave a gap over the road (x 280..360) so the path reads as continuing into
# the forest instead of being walled off by trees; flanking trees (see
# build_decor) frame the opening.
def build_canopy(cfg: dict) -> list:
    accent = cfg["canopy_accent"]
    main = cfg["canopy_main"]
    patches = [(accent, 80, -40), (accent, 560, H + 40)]
    patches += [(main, x, -56) for x in (104, 536)]
    patches += [(main, x, H + 56) for x in (104, 536)]
    patches += [(main, -100, y) for y in (64, 352, 640, 928)]
    patches += [(main, W + 100, y) for y in (64, 352, 640, 928)]
    return patches

# Trees framing the road gaps in the canopy (drawn as normal decor + solid feet).
GAP_TREES = [(232, 104), (408, 98), (232, 948), (408, 952)]

WALLS = [((336, 80), "wall_h"), ((336, 976), "wall_h"),
         ((68, 528), "wall_v"), ((604, 528), "wall_v")]

# ---------------------------------------------------------------------------
# .tscn emit
# ---------------------------------------------------------------------------
def gen_hunt(n_map: int, cfg: dict, ground_b64: str) -> None:
    ext = []   # (type, path, id)
    def ext_id(type_: str, path: str) -> str:
        for t, p, i in ext:
            if p == path:
                return i
        i = f"{len(ext) + 1}"
        ext.append((type_, path, i))
        return i

    script_id = ext_id("Script", "res://scenes/world/HuntingGround.gd")
    tileset_id = ext_id("TileSet", "res://assets/tiles/world.tres")
    inter_id = ext_id("PackedScene", "res://scenes/actors/Interactable.tscn")
    player_id = ext_id("PackedScene", "res://scenes/actors/Player.tscn")

    decor, tree_feet, rock_feet = build_decor(n_map, cfg)
    canopy = build_canopy(cfg)
    used = {k for k, _, _ in decor} | {k for k, _, _ in canopy}
    tex_ids = {k: ext_id("Texture2D", TEX[k]) for k in sorted(used)}

    subs = [
        ("wall_h", f"Vector2({W}, 16)"),
        ("wall_v", f"Vector2(16, {H})"),
        ("foot", "Vector2(28, 14)"),
        ("rock_foot", "Vector2(20, 12)"),
    ]

    n = []  # node blocks
    root = (
        f'[node name="HuntingGround{n_map}" type="Node2D"]\n'
        f'script = ExtResource("{script_id}")\n'
        f'stage = {cfg["stage"]}\n'
        f'aggressive = {"true" if cfg["aggressive"] else "false"}\n'
        f'monster_speed = {cfg["monster_speed"]}\n'
        f'prev_scene = "{cfg["prev_scene"]}"\n'
        f'next_scene = "{cfg["next_scene"]}"\n'
        f'prev_spawn = "{cfg["prev_spawn"]}"'
    )
    n.append(root)

    n.append(
        f'[node name="Ground" type="TileMapLayer" parent="."]\n'
        f'z_index = -10\n'
        f'tile_map_data = PackedByteArray("{ground_b64}")\n'
        f'tile_set = ExtResource("{tileset_id}")'
    )

    decor_lines = ['[node name="Decor" type="Node2D" parent="."]\nz_index = -9']
    for i, (key, x, y) in enumerate(decor):
        extra = f"\nregion_enabled = true\nregion_rect = {MUSH_REGION}" if key.startswith("mush") else ""
        decor_lines.append(
            f'[node name="Decor{i}" type="Sprite2D" parent="Decor"]\n'
            f'position = Vector2({x}, {y})\n'
            f'texture = ExtResource("{tex_ids[key]}")' + extra
        )
    n.extend(decor_lines)

    canopy_lines = ['[node name="Canopy" type="Node2D" parent="."]\nz_index = -8']
    for i, (key, x, y) in enumerate(canopy):
        canopy_lines.append(
            f'[node name="Patch{i}" type="Sprite2D" parent="Canopy"]\n'
            f'position = Vector2({x}, {y})\n'
            f'texture = ExtResource("{tex_ids[key]}")\n'
            f'region_enabled = true\n'
            f'region_rect = {FOREST_REGION}'
        )
    n.extend(canopy_lines)

    # Progressive forest tint; world+actors only (UI lives on CanvasLayers).
    if cfg["tint"]:
        r, g, b = cfg["tint"]
        n.append(f'[node name="Tint" type="CanvasModulate" parent="."]\n'
                 f'color = Color({r}, {g}, {b}, 1)')

    wall_lines = ['[node name="Walls" type="StaticBody2D" parent="."]\ncollision_layer = 2\ncollision_mask = 0']
    wi = 0
    for (x, y), shape in WALLS:
        wall_lines.append(
            f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
            f'position = Vector2({x}, {y})\nshape = SubResource("{shape}")'
        )
        wi += 1
    for x, y in tree_feet:
        wall_lines.append(
            f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
            f'position = Vector2({x}, {y})\nshape = SubResource("foot")'
        )
        wi += 1
    for x, y in rock_feet:
        wall_lines.append(
            f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
            f'position = Vector2({x}, {y})\nshape = SubResource("rock_foot")'
        )
        wi += 1
    n.extend(wall_lines)

    # Invisible road-end exits (the [E]/touch interact button is the "door").
    n.append(f'[node name="ExitSouth" type="Node2D" parent="."]\n'
             f'position = Vector2({EXIT_S[0]}, {EXIT_S[1]})')
    n.append(f'[node name="Interact" parent="ExitSouth" instance=ExtResource("{inter_id}")]\n'
             f'prompt = "{cfg["prompt_s"]}"')
    if cfg["next_scene"]:
        n.append(f'[node name="ExitNorth" type="Node2D" parent="."]\n'
                 f'position = Vector2({EXIT_N[0]}, {EXIT_N[1]})')
        n.append(f'[node name="Interact" parent="ExitNorth" instance=ExtResource("{inter_id}")]\n'
                 f'prompt = "{cfg["prompt_n"]}"')

    n.append('[node name="Monsters" type="Node2D" parent="."]')

    n.append('[node name="Overlay" type="CanvasLayer" parent="."]')
    n.append('[node name="Banner" type="Label" parent="Overlay"]\n'
             'visible = false\n'
             'anchors_preset = 10\n'
             'anchor_right = 1.0\n'
             'offset_top = 34.0\n'
             'offset_bottom = 54.0\n'
             'text = "웨이브 클리어!"\n'
             'horizontal_alignment = 1')

    n.append(f'[node name="Player" parent="." instance=ExtResource("{player_id}")]\n'
             f'position = Vector2({PLAYER_POS[0]}, {PLAYER_POS[1]})')
    n.append(f'[node name="from_south" type="Marker2D" parent="."]\n'
             f'position = Vector2({PLAYER_POS[0]}, {PLAYER_POS[1]})')
    n.append(f'[node name="from_north" type="Marker2D" parent="."]\n'
             f'position = Vector2({NORTH_POS[0]}, {NORTH_POS[1]})')

    load_steps = len(ext) + len(subs) + 1
    out = [f"[gd_scene load_steps={load_steps} format=3]\n"]
    for t, p, i in ext:
        out.append(f'[ext_resource type="{t}" path="{p}" id="{i}"]')
    out.append("")
    for sid, size in subs:
        out.append(f'[sub_resource type="RectangleShape2D" id="{sid}"]\nsize = {size}\n')
    out.append("\n\n".join(n))
    out.append("")

    path = f"scenes/world/HuntingGround{n_map}.tscn"
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out))
    print(f"{path} written: {COLS}x{ROWS} tiles ({W}x{H}px), "
          f"{len(decor)} decor, {len(canopy)} canopy patches, {wi} wall shapes, "
          f"stage {cfg['stage']}{' (aggressive)' if cfg['aggressive'] else ''}")


# ---------------------------------------------------------------------------
# Boss arena (사냥터3 북쪽 끝): 672x672 clearing ringed by rocks/dead trees,
# road stub from the south, darkest tint. The boss itself spawns at runtime
# (BossArena.gd) — this scene only ships the terrain + exit + structure.
# ---------------------------------------------------------------------------
A_COLS, A_ROWS = 21, 21
A_W, A_H = A_COLS * TILE, A_ROWS * TILE
A_CENTER = (336, 320)
A_RING_R = 210
A_TINT = (0.58, 0.52, 0.62)
A_PLAYER_POS = (320, 540)
A_EXIT_S = (320, 578)

def arena_tile_data() -> str:
    path = set()
    for y in range(14, A_ROWS):
        for x in (9, 10):
            path.add((x, y))
    for x in range(8, 12):       # clearing where the road meets the arena floor
        for y in (12, 13):
            path.add((x, y))

    cells = {}
    for y in range(A_ROWS):
        for x in range(A_COLS):
            if (x, y) in path:
                cells[(x, y)] = (ROAD_SRC, _road_cell(path, x, y))
            else:
                cells[(x, y)] = (GRASS_SRC, GRASS_CELL)

    raw = struct.pack("<H", 0)
    for (x, y), (src, (ax, ay)) in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        raw += struct.pack("<hhHHHH", x, y, src, ax, ay, 0)
    return base64.b64encode(raw).decode()

def gen_arena() -> None:
    import math
    ext = []
    def ext_id(type_: str, path: str) -> str:
        for t, p, i in ext:
            if p == path:
                return i
        i = f"{len(ext) + 1}"
        ext.append((type_, path, i))
        return i

    script_id = ext_id("Script", "res://scenes/world/BossArena.gd")
    tileset_id = ext_id("TileSet", "res://assets/tiles/world.tres")
    inter_id = ext_id("PackedScene", "res://scenes/actors/Interactable.tscn")
    player_id = ext_id("PackedScene", "res://scenes/actors/Player.tscn")

    # Ring of heavy decor around the clearing; the south arc stays open for the
    # road. Alternates autumn trees / rocks / stumps.
    ring_keys = ["tree_a3", "rock1", "tree_b3", "rock3", "stump",
                 "tree_c3", "rock2", "tree_d3", "rock4", "stump"]
    ring = []
    tree_feet = []
    rock_feet = []
    n_pts = 14
    for i in range(n_pts):
        ang = -90.0 + 360.0 * i / n_pts          # degrees, 0 at the top
        if 55.0 < (ang + 360.0) % 360.0 < 125.0:  # leave the south arc open
            continue
        rad = math.radians(ang)
        x = round(A_CENTER[0] + math.cos(rad) * A_RING_R)
        y = round(A_CENTER[1] + math.sin(rad) * A_RING_R)
        key = ring_keys[i % len(ring_keys)]
        ring.append((key, x, y))
        if key.startswith("tree"):
            tree_feet.append((x, y + 38))
        elif key.startswith("rock"):
            rock_feet.append((x, y + 4))
    # Gap-flanking trees by the south road opening.
    for x, y in ((232, 560), (408, 564)):
        ring.append(("tree_a3", x, y))
        tree_feet.append((x, y + 38))

    canopy = [("forest_t", 80, -40), ("forest_t", 560, A_H + 40)]
    canopy += [("forest_o", x, -56) for x in (40, 360, 640)]
    canopy += [("forest_o", x, A_H + 56) for x in (104, 536)]   # south road gap
    canopy += [("forest_o", -100, y) for y in (64, 352, 640)]
    canopy += [("forest_o", A_W + 100, y) for y in (64, 352, 640)]

    used = {k for k, _, _ in ring} | {k for k, _, _ in canopy}
    tex_ids = {k: ext_id("Texture2D", TEX[k]) for k in sorted(used)}

    subs = [
        ("wall_h", f"Vector2({A_W}, 16)"),
        ("wall_v", f"Vector2(16, {A_H})"),
        ("foot", "Vector2(28, 14)"),
        ("rock_foot", "Vector2(20, 12)"),
    ]

    n = []
    n.append(f'[node name="BossArena" type="Node2D"]\nscript = ExtResource("{script_id}")')
    n.append(
        f'[node name="Ground" type="TileMapLayer" parent="."]\n'
        f'z_index = -10\n'
        f'tile_map_data = PackedByteArray("{arena_tile_data()}")\n'
        f'tile_set = ExtResource("{tileset_id}")'
    )

    decor_lines = ['[node name="Decor" type="Node2D" parent="."]\nz_index = -9']
    for i, (key, x, y) in enumerate(ring):
        decor_lines.append(
            f'[node name="Decor{i}" type="Sprite2D" parent="Decor"]\n'
            f'position = Vector2({x}, {y})\n'
            f'texture = ExtResource("{tex_ids[key]}")'
        )
    n.extend(decor_lines)

    canopy_lines = ['[node name="Canopy" type="Node2D" parent="."]\nz_index = -8']
    for i, (key, x, y) in enumerate(canopy):
        canopy_lines.append(
            f'[node name="Patch{i}" type="Sprite2D" parent="Canopy"]\n'
            f'position = Vector2({x}, {y})\n'
            f'texture = ExtResource("{tex_ids[key]}")\n'
            f'region_enabled = true\n'
            f'region_rect = {FOREST_REGION}'
        )
    n.extend(canopy_lines)

    r, g, b = A_TINT
    n.append(f'[node name="Tint" type="CanvasModulate" parent="."]\n'
             f'color = Color({r}, {g}, {b}, 1)')

    wall_lines = ['[node name="Walls" type="StaticBody2D" parent="."]\ncollision_layer = 2\ncollision_mask = 0']
    wi = 0
    arena_walls = [((A_W / 2, 80), "wall_h"), ((A_W / 2, A_H - 80), "wall_h"),
                   ((68, A_H / 2), "wall_v"), ((A_W - 68, A_H / 2), "wall_v")]
    for (x, y), shape in arena_walls:
        wall_lines.append(
            f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
            f'position = Vector2({x}, {y})\nshape = SubResource("{shape}")'
        )
        wi += 1
    for x, y in tree_feet:
        wall_lines.append(
            f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
            f'position = Vector2({x}, {y})\nshape = SubResource("foot")'
        )
        wi += 1
    for x, y in rock_feet:
        wall_lines.append(
            f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
            f'position = Vector2({x}, {y})\nshape = SubResource("rock_foot")'
        )
        wi += 1
    n.extend(wall_lines)

    n.append(f'[node name="ExitSouth" type="Node2D" parent="."]\n'
             f'position = Vector2({A_EXIT_S[0]}, {A_EXIT_S[1]})')
    n.append(f'[node name="Interact" parent="ExitSouth" instance=ExtResource("{inter_id}")]\n'
             f'prompt = "사냥터로"')

    n.append('[node name="Monsters" type="Node2D" parent="."]')

    n.append('[node name="Overlay" type="CanvasLayer" parent="."]')
    n.append('[node name="Banner" type="Label" parent="Overlay"]\n'
             'visible = false\n'
             'anchors_preset = 10\n'
             'anchor_right = 1.0\n'
             'offset_top = 34.0\n'
             'offset_bottom = 54.0\n'
             'text = "보스 처치!"\n'
             'horizontal_alignment = 1')

    n.append(f'[node name="Player" parent="." instance=ExtResource("{player_id}")]\n'
             f'position = Vector2({A_PLAYER_POS[0]}, {A_PLAYER_POS[1]})')
    n.append(f'[node name="from_south" type="Marker2D" parent="."]\n'
             f'position = Vector2({A_PLAYER_POS[0]}, {A_PLAYER_POS[1]})')

    load_steps = len(ext) + len(subs) + 1
    out = [f"[gd_scene load_steps={load_steps} format=3]\n"]
    for t, p, i in ext:
        out.append(f'[ext_resource type="{t}" path="{p}" id="{i}"]')
    out.append("")
    for sid, size in subs:
        out.append(f'[sub_resource type="RectangleShape2D" id="{sid}"]\nsize = {size}\n')
    out.append("\n\n".join(n))
    out.append("")

    with open("scenes/world/BossArena.tscn", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out))
    print(f"scenes/world/BossArena.tscn written: {A_COLS}x{A_ROWS} tiles, "
          f"{len(ring)} ring decor, {len(canopy)} canopy patches, {wi} wall shapes")


def main() -> None:
    ground = tile_map_data()   # identical layout for all three maps
    for n_map, cfg in HUNT_CFG.items():
        gen_hunt(n_map, cfg, ground)
    gen_arena()


if __name__ == "__main__":
    main()
