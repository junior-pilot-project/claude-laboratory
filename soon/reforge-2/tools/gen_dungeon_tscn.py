"""Generator (dev tool, not shipped at runtime). Builds the dungeon run:
assets/tiles/dungeon.tres (TileSet over dungeon_tileset.png, 28x6 cells @32px,
atlas coords == sheet cells) plus four scenes —

  DungeonRoom1/2/3.tscn  21x33 (672x1056) stone chambers reusing the hunt
                         geometry (ANCHORS / exits / spawn markers) so the
                         inherited HuntingGround._ready works unchanged, with a
                         spiked Gate subtree blocking the north opening.
  DungeonBossRoom.tscn   21x21 (672x672) boss chamber with a hidden ReturnExit.

Tileset cell map (pinned from build/preview_dungeon_tileset.png):
  brick room frame 3x3 at (0..2, 0..2): corners/edges/faces
  full wall faces (3,0)(4,0)(3,1)(4,1); decor faces (7,0) window, (8,0) ring,
  (10,0) emblem; floors: rubble (11..13, 3), plain (14..16, 3).
spiked_gate.png / torch_front.png / chest_*.png are 4-frame 32x32 strips
(gate: frame 0 = spikes raised ... 3 = retracted).

Run from the project root:  python tools/gen_dungeon_tscn.py
"""
import base64
import random
import struct

TILE = 32
COLS, ROWS = 21, 33            # combat rooms: 672 x 1056 portrait (hunt geometry)
W, H = COLS * TILE, ROWS * TILE
B_COLS, B_ROWS = 21, 21        # boss room: 672 x 672
B_W, B_H = B_COLS * TILE, B_ROWS * TILE

# --- dungeon.tres cells (atlas coords == sheet cells) ------------------------
FLOOR_PLAIN = [(14, 3), (15, 3), (16, 3)]
FLOOR_RUBBLE = [(11, 3), (12, 3), (13, 3)]
FR_TL, FR_T, FR_TR = (0, 0), (1, 0), (2, 0)
FR_L, FR_R = (0, 1), (2, 1)
FR_BL, FR_B, FR_BR = (0, 2), (1, 2), (2, 2)
WALL_FACES = [(3, 1), (4, 1), (3, 1), (4, 1), (7, 0), (8, 0), (10, 0)]

ROAD_COLS = (9, 10)            # 64px opening, x 288..352 (matches the hunt road)

TEX = {
    "torch": "res://assets/world/dungeon/torch_front.png",
    "gate": "res://assets/world/dungeon/spiked_gate.png",
    "bones_1": "res://assets/world/dungeon/bones_1.png",
    "bones_2": "res://assets/world/dungeon/bones_2.png",
    "bones_3": "res://assets/world/dungeon/bones_3.png",
    "chains": "res://assets/world/dungeon/chains.png",
    "chest_s": "res://assets/world/dungeon/chest_small.png",
    "chest_l": "res://assets/world/dungeon/chest_large.png",
}
ANIM_SCRIPT = "res://scenes/actors/AnimFrames.gd"

# Same anchors / positions as the hunting grounds (HuntingGround.gd ANCHORS).
ANCHORS = [(150, 220), (480, 200), (140, 420), (500, 440),
           (160, 640), (490, 620), (150, 820), (500, 840)]
PLAYER_POS = (320, 920)
NORTH_POS = (320, 160)
EXIT_S = (320, 962)
EXIT_N = (320, 130)
ROAD_X = (256, 384)            # decor keep-out band around the road
GATE_POS = (320, 76)           # spans the north opening, just below the wall

ROOM_CFG = {
    1: {
        "stage": 3, "mon_id": "skeleton", "monster_speed": 1.0,
        "prev_scene": "res://scenes/world/Town.tscn", "prev_spawn": "from_dungeon",
        "next_scene": "res://scenes/world/DungeonRoom2.tscn",
        "prompt_s": "마을로", "prompt_n": "다음 방으로",
        "tint": (0.78, 0.74, 0.86), "n_bones": 5, "chests": [],
    },
    2: {
        "stage": 4, "mon_id": "bat", "monster_speed": 1.0,
        "prev_scene": "res://scenes/world/DungeonRoom1.tscn", "prev_spawn": "from_north",
        "next_scene": "res://scenes/world/DungeonRoom3.tscn",
        "prompt_s": "이전 방으로", "prompt_n": "다음 방으로",
        "tint": (0.66, 0.62, 0.78), "n_bones": 7, "chests": [("chest_s", 120, 200)],
    },
    3: {
        "stage": 5, "mon_id": "slime_red", "monster_speed": 1.2,
        "prev_scene": "res://scenes/world/DungeonRoom2.tscn", "prev_spawn": "from_north",
        "next_scene": "res://scenes/world/DungeonBossRoom.tscn",
        "prompt_s": "이전 방으로", "prompt_n": "보스의 방으로",
        "tint": (0.56, 0.52, 0.72), "n_bones": 9, "chests": [("chest_l", 552, 210)],
    },
}
BOSS_TINT = (0.48, 0.45, 0.66)


def gen_tileset() -> None:
    lines = [
        '[gd_resource type="TileSet" format=3]',
        "",
        '[ext_resource type="Texture2D" path="res://assets/world/dungeon/dungeon_tileset.png" id="1_dun"]',
        "",
        '[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_dun"]',
        'texture = ExtResource("1_dun")',
        "texture_region_size = Vector2i(32, 32)",
    ]
    for y in range(6):
        for x in range(28):
            lines.append(f"{x}:{y}/0 = 0")
    lines += [
        "",
        "[resource]",
        "tile_size = Vector2i(32, 32)",
        'sources/0 = SubResource("TileSetAtlasSource_dun")',
        "",
    ]
    with open("assets/tiles/dungeon.tres", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print("assets/tiles/dungeon.tres written: 28x6 cells registered")


# ---------------------------------------------------------------------------
# Ground: opaque stone floor everywhere, a brick 9-patch frame around the edge,
# and door openings (road columns) through the north and/or south wall.
# ---------------------------------------------------------------------------
def room_tile_data(rng: random.Random, cols: int, rows: int,
                   open_north: bool, open_south: bool) -> str:
    cells = {}
    for y in range(rows):
        for x in range(cols):
            if rng.random() < 0.12:
                cells[(x, y)] = rng.choice(FLOOR_RUBBLE)
            else:
                cells[(x, y)] = rng.choice(FLOOR_PLAIN)
    # Frame: cap row (y0), face row (y1, full brick + occasional decor face),
    # side edges, bottom edge.
    for x in range(cols):
        cells[(x, 0)] = FR_T
        cells[(x, 1)] = WALL_FACES[(x * 7) % len(WALL_FACES)]
        cells[(x, rows - 1)] = FR_B
    for y in range(rows):
        cells[(0, y)] = FR_L
        cells[(cols - 1, y)] = FR_R
    cells[(0, 0)] = FR_TL
    cells[(cols - 1, 0)] = FR_TR
    cells[(0, rows - 1)] = FR_BL
    cells[(cols - 1, rows - 1)] = FR_BR
    # Openings: knock the road columns out of the wall back to floor.
    if open_north:
        for x in ROAD_COLS:
            cells[(x, 0)] = FLOOR_PLAIN[0]
            cells[(x, 1)] = FLOOR_PLAIN[1]
    if open_south:
        for x in ROAD_COLS:
            cells[(x, rows - 1)] = FLOOR_PLAIN[0]

    raw = struct.pack("<H", 0)
    for (x, y), (ax, ay) in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        raw += struct.pack("<hhHHHH", x, y, 0, ax, ay, 0)
    return base64.b64encode(raw).decode()


# Deterministic bones scatter, clear of the road band, anchors and both ends.
def scatter_bones(rng: random.Random, n: int, h: int, keep: list) -> list:
    pts = []
    tries = 0
    while len(pts) < n and tries < 3000:
        tries += 1
        x = rng.uniform(76, W - 76)
        y = rng.uniform(150, h - 150)
        if ROAD_X[0] - 16 < x < ROAD_X[1] + 16:
            continue
        ok = all(abs(x - ax) > 48 or abs(y - ay) > 48 for ax, ay in ANCHORS)
        if ok:
            ok = all(abs(x - px) > 56 or abs(y - py) > 56 for px, py in keep + pts)
        if ok:
            pts.append((round(x), round(y)))
    return pts


class B:
    """Tiny .tscn builder (mirrors gen_hunt_tscn's inline ext/sub bookkeeping)."""

    def __init__(self):
        self.ext = []   # (type, path, id)
        self.subs = []  # (id, size_str)
        self.nodes = []

    def ext_id(self, type_: str, path: str) -> str:
        for t, p, i in self.ext:
            if p == path:
                return i
        i = f"{len(self.ext) + 1}"
        self.ext.append((type_, path, i))
        return i

    def sub_rect(self, sid: str, w: float, h: float) -> str:
        if not any(s == sid for s, _ in self.subs):
            self.subs.append((sid, f"Vector2({w}, {h})"))
        return sid

    def node(self, block: str) -> None:
        self.nodes.append(block)

    def write(self, path: str, summary: str) -> None:
        load_steps = len(self.ext) + len(self.subs) + 1
        out = [f"[gd_scene load_steps={load_steps} format=3]\n"]
        for t, p, i in self.ext:
            out.append(f'[ext_resource type="{t}" path="{p}" id="{i}"]')
        out.append("")
        for sid, size in self.subs:
            out.append(f'[sub_resource type="RectangleShape2D" id="{sid}"]\nsize = {size}\n')
        out.append("\n\n".join(self.nodes))
        out.append("")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(out))
        print(f"{path} written: {summary}")


def add_torch(b: B, name: str, x: float, y: float) -> None:
    tid = b.ext_id("Texture2D", TEX["torch"])
    sid = b.ext_id("Script", ANIM_SCRIPT)
    b.node(f'[node name="{name}" type="Sprite2D" parent="Props"]\n'
           f'script = ExtResource("{sid}")\n'
           f'position = Vector2({x}, {y})\n'
           f'texture = ExtResource("{tid}")\n'
           f'hframes = 4\n'
           f'fps = 7.0')


def add_props(b: B, rng: random.Random, cfg: dict, map_h: int, keep: list) -> int:
    """Props node: torches on the walls, chains off the north face, bones/chests
    on the floor. Returns the prop count (for the summary line)."""
    b.node('[node name="Props" type="Node2D" parent="."]\nz_index = -8')
    count = 0
    # North-wall torches flanking the opening + side-wall torches at intervals.
    for x in (176, 464):
        add_torch(b, f"TorchN{x}", x, 46)
        count += 1
    ty = 300
    while ty < map_h - 220:
        add_torch(b, f"TorchL{ty}", 26, ty)
        add_torch(b, f"TorchR{ty}", W - 26, ty)
        count += 2
        ty += 290
    # Chains hang off the north wall face.
    cid = b.ext_id("Texture2D", TEX["chains"])
    for i, x in enumerate((96, 560)):
        b.node(f'[node name="Chains{i}" type="Sprite2D" parent="Props"]\n'
               f'position = Vector2({x}, 64)\n'
               f'texture = ExtResource("{cid}")')
        count += 1
    # Bones scatter + optional chests (frame 0 of the 4-frame strips).
    for i, (x, y) in enumerate(scatter_bones(rng, cfg["n_bones"], map_h, keep)):
        tid = b.ext_id("Texture2D", TEX[f"bones_{1 + (i % 3)}"])
        b.node(f'[node name="Bones{i}" type="Sprite2D" parent="Props"]\n'
               f'position = Vector2({x}, {y})\n'
               f'texture = ExtResource("{tid}")')
        count += 1
    for i, (key, x, y) in enumerate(cfg["chests"]):
        tid = b.ext_id("Texture2D", TEX[key])
        b.node(f'[node name="Chest{i}" type="Sprite2D" parent="Props"]\n'
               f'position = Vector2({x}, {y})\n'
               f'texture = ExtResource("{tid}")\n'
               f'hframes = 4')
        count += 1
    return count


def add_walls(b: B, map_w: int, map_h: int, open_north: bool, open_south: bool) -> None:
    """Edge colliders hugging the tile frame, with gaps over the openings and
    thin blockers so the player cannot walk off-map through a doorway."""
    gl, gr = ROAD_X  # opening span in px
    b.node('[node name="Walls" type="StaticBody2D" parent="."]\n'
           'collision_layer = 2\ncollision_mask = 0')
    wi = 0

    def shape(x, y, w, h):
        nonlocal wi
        sid = b.sub_rect(f"w{int(w)}x{int(h)}", w, h)
        b.node(f'[node name="Wall{wi}" type="CollisionShape2D" parent="Walls"]\n'
               f'position = Vector2({x}, {y})\nshape = SubResource("{sid}")')
        wi += 1

    # Top (wall rows y 0..64): split around the opening, else full width.
    if open_north:
        shape(gl / 2, 52, gl, 24)
        shape((gr + map_w) / 2, 52, map_w - gr, 24)
        shape((gl + gr) / 2, 20, gr - gl, 12)   # doorway depth stop
    else:
        shape(map_w / 2, 52, map_w, 24)
    # Bottom (wall row, last 32px).
    by = map_h - 20
    if open_south:
        shape(gl / 2, by, gl, 24)
        shape((gr + map_w) / 2, by, map_w - gr, 24)
        shape((gl + gr) / 2, map_h - 8, gr - gl, 12)
    else:
        shape(map_w / 2, by, map_w, 24)
    # Sides.
    shape(16, map_h / 2, 24, map_h)
    shape(map_w - 16, map_h / 2, 24, map_h)


def add_overlay(b: B) -> None:
    b.node('[node name="Overlay" type="CanvasLayer" parent="."]')
    b.node('[node name="Banner" type="Label" parent="Overlay"]\n'
           'visible = false\n'
           'anchors_preset = 10\n'
           'anchor_right = 1.0\n'
           'offset_top = 34.0\n'
           'offset_bottom = 54.0\n'
           'text = "웨이브 클리어!"\n'
           'horizontal_alignment = 1')


def gen_room(n_room: int, cfg: dict) -> None:
    rng = random.Random(7000 + n_room)
    b = B()
    script_id = b.ext_id("Script", "res://scenes/world/DungeonRoom.gd")
    tileset_id = b.ext_id("TileSet", "res://assets/tiles/dungeon.tres")
    inter_id = b.ext_id("PackedScene", "res://scenes/actors/Interactable.tscn")
    player_id = b.ext_id("PackedScene", "res://scenes/actors/Player.tscn")

    b.node(
        f'[node name="DungeonRoom{n_room}" type="Node2D"]\n'
        f'script = ExtResource("{script_id}")\n'
        f'mon_id = "{cfg["mon_id"]}"\n'
        f'stage = {cfg["stage"]}\n'
        f'aggressive = true\n'
        f'monster_speed = {cfg["monster_speed"]}\n'
        f'prev_scene = "{cfg["prev_scene"]}"\n'
        f'next_scene = "{cfg["next_scene"]}"\n'
        f'prev_spawn = "{cfg["prev_spawn"]}"'
    )
    b.node(
        f'[node name="Ground" type="TileMapLayer" parent="."]\n'
        f'z_index = -10\n'
        f'tile_map_data = PackedByteArray("{room_tile_data(rng, COLS, ROWS, True, True)}")\n'
        f'tile_set = ExtResource("{tileset_id}")'
    )
    keep = [(x, y) for _, x, y in cfg["chests"]]
    n_props = add_props(b, rng, cfg, H, keep)

    r, g, bl = cfg["tint"]
    b.node(f'[node name="Tint" type="CanvasModulate" parent="."]\n'
           f'color = Color({r}, {g}, {bl}, 1)')

    add_walls(b, W, H, True, True)

    # Spiked gate across the north opening: frame 0 = raised (closed); the room
    # script sinks it to frame 3 and disables Body/Col when all waves clear.
    gate_id = b.ext_id("Texture2D", TEX["gate"])
    gate_col = b.sub_rect("gate_col", 72, 14)
    b.node(f'[node name="Gate" type="Node2D" parent="."]\n'
           f'position = Vector2({GATE_POS[0]}, {GATE_POS[1]})\n'
           f'z_index = -5')
    for seg, off in (("SegL", -16), ("SegR", 16)):
        b.node(f'[node name="{seg}" type="Sprite2D" parent="Gate"]\n'
               f'position = Vector2({off}, 0)\n'
               f'texture = ExtResource("{gate_id}")\n'
               f'hframes = 4')
    b.node('[node name="Body" type="StaticBody2D" parent="Gate"]\n'
           'collision_layer = 2\ncollision_mask = 0')
    b.node(f'[node name="Col" type="CollisionShape2D" parent="Gate/Body"]\n'
           f'shape = SubResource("{gate_col}")')

    b.node(f'[node name="ExitSouth" type="Node2D" parent="."]\n'
           f'position = Vector2({EXIT_S[0]}, {EXIT_S[1]})')
    b.node(f'[node name="Interact" parent="ExitSouth" instance=ExtResource("{inter_id}")]\n'
           f'prompt = "{cfg["prompt_s"]}"')
    b.node(f'[node name="ExitNorth" type="Node2D" parent="."]\n'
           f'position = Vector2({EXIT_N[0]}, {EXIT_N[1]})')
    b.node(f'[node name="Interact" parent="ExitNorth" instance=ExtResource("{inter_id}")]\n'
           f'prompt = "{cfg["prompt_n"]}"')

    b.node('[node name="Monsters" type="Node2D" parent="."]')
    add_overlay(b)

    b.node(f'[node name="Player" parent="." instance=ExtResource("{player_id}")]\n'
           f'position = Vector2({PLAYER_POS[0]}, {PLAYER_POS[1]})')
    b.node(f'[node name="from_south" type="Marker2D" parent="."]\n'
           f'position = Vector2({PLAYER_POS[0]}, {PLAYER_POS[1]})')
    b.node(f'[node name="from_north" type="Marker2D" parent="."]\n'
           f'position = Vector2({NORTH_POS[0]}, {NORTH_POS[1]})')

    b.write(f"scenes/world/DungeonRoom{n_room}.tscn",
            f"{COLS}x{ROWS} tiles, {n_props} props, stage {cfg['stage']} "
            f"({cfg['mon_id']})")


def gen_boss_room() -> None:
    rng = random.Random(7999)
    b = B()
    script_id = b.ext_id("Script", "res://scenes/world/DungeonBossRoom.gd")
    tileset_id = b.ext_id("TileSet", "res://assets/tiles/dungeon.tres")
    inter_id = b.ext_id("PackedScene", "res://scenes/actors/Interactable.tscn")
    player_id = b.ext_id("PackedScene", "res://scenes/actors/Player.tscn")

    b.node(f'[node name="DungeonBossRoom" type="Node2D"]\n'
           f'script = ExtResource("{script_id}")')
    b.node(
        f'[node name="Ground" type="TileMapLayer" parent="."]\n'
        f'z_index = -10\n'
        f'tile_map_data = PackedByteArray("{room_tile_data(rng, B_COLS, B_ROWS, False, True)}")\n'
        f'tile_set = ExtResource("{tileset_id}")'
    )
    boss_cfg = {"n_bones": 6, "chests": []}
    n_props = add_props(b, rng, boss_cfg, B_H, [(336, 260)])

    r, g, bl = BOSS_TINT
    b.node(f'[node name="Tint" type="CanvasModulate" parent="."]\n'
           f'color = Color({r}, {g}, {bl}, 1)')

    add_walls(b, B_W, B_H, False, True)

    b.node('[node name="ExitSouth" type="Node2D" parent="."]\n'
           'position = Vector2(320, 600)')
    b.node(f'[node name="Interact" parent="ExitSouth" instance=ExtResource("{inter_id}")]\n'
           f'prompt = "이전 방으로"')
    # Hidden until the boss dies (DungeonBossRoom.gd reveals it).
    b.node('[node name="ReturnExit" type="Node2D" parent="."]\n'
           'position = Vector2(336, 180)')
    b.node(f'[node name="Interact" parent="ReturnExit" instance=ExtResource("{inter_id}")]\n'
           f'prompt = "마을로 귀환"')

    b.node('[node name="Monsters" type="Node2D" parent="."]')
    add_overlay(b)

    b.node(f'[node name="Player" parent="." instance=ExtResource("{player_id}")]\n'
           f'position = Vector2(320, 560)')
    b.node('[node name="from_south" type="Marker2D" parent="."]\n'
           'position = Vector2(320, 560)')

    b.write("scenes/world/DungeonBossRoom.tscn",
            f"{B_COLS}x{B_ROWS} tiles, {n_props} props, boss chamber")


def main() -> None:
    gen_tileset()
    for n_room, cfg in ROOM_CFG.items():
        gen_room(n_room, cfg)
    gen_boss_room()


if __name__ == "__main__":
    main()
