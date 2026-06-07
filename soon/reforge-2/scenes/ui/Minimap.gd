extends Control
## Minimap (top-right), shown on every map. A SubViewport shares the main World2D
## and follows the player with its own camera, so it renders the *real*
## tilemap/decor in miniature as a scrolling window around the player (clamped to
## the map edges). On top of that render we overlay highlight dots for the player
## (yellow), monsters (red) and doors/exits (blue). The label above shows the
## map's name.

# scene path -> minimap label (also gates visibility: maps not here stay hidden).
const NAMES := {
	"res://scenes/world/HuntingGround1.tscn": "사냥터 1",
	"res://scenes/world/HuntingGround2.tscn": "사냥터 2",
	"res://scenes/world/HuntingGround3.tscn": "사냥터 3",
	"res://scenes/world/BossArena.tscn": "보스의 둥지",
	"res://scenes/world/DungeonRoom1.tscn": "던전 1",
	"res://scenes/world/DungeonRoom2.tscn": "던전 2",
	"res://scenes/world/DungeonRoom3.tscn": "던전 3",
	"res://scenes/world/DungeonBossRoom.tscn": "던전 보스방",
	"res://scenes/world/Town.tscn": "마을",
	"res://scenes/world/Room.tscn": "방",
	"res://scenes/world/EquipShopInterior.tscn": "장비 상점",
	"res://scenes/world/PotionShopInterior.tscn": "물약 상점",
	"res://scenes/world/GambleInterior.tscn": "도박장",
}

# World width (px) shown across the minimap; smaller = more zoomed in on player.
const VIEW_WORLD_W := 300.0

const COL_PLAYER := Color(1.0, 0.95, 0.5)
const COL_MONSTER := Color(0.92, 0.28, 0.24)
const COL_DOOR := Color(0.45, 0.7, 1.0)

@onready var _name: Label = $NameFrame/NameLabel
@onready var _view: SubViewport = $Frame/ViewportContainer/View
@onready var _cam: Camera2D = $Frame/ViewportContainer/View/Cam
@onready var _canvas: Control = $Frame/Canvas

var _show_for_map: bool = false   # current map has a minimap
var _suppressed: bool = false     # hidden while a popup is open

# Actors (player/monsters) are moved onto visibility layer 2, which the minimap
# viewport culls — the mini render shows terrain only; actors appear as the dot
# overlay instead (a sprite's walk/attack frames are unreadable at this scale).
const ACTOR_LAYER := 2

func _ready() -> void:
	# Render the same 2D world the player sees, just from our own follow camera.
	_view.world_2d = get_viewport().world_2d
	_view.canvas_cull_mask = 1  # hide ACTOR_LAYER items from the mini render
	_cam.make_current()
	_canvas.draw.connect(_on_canvas_draw)
	SceneManager.map_changed.connect(_on_map_changed)
	# Tapping the minimap opens the full-map preview popup.
	gui_input.connect(_on_gui_input)
	visible = false

func _on_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed \
			and event.button_index == MOUSE_BUTTON_LEFT:
		var root: Node = get_tree().get_first_node_in_group("ui_root")
		if root and root.has_method("open_map_preview"):
			root.open_map_preview()

func _on_map_changed(map_path: String) -> void:
	_show_for_map = NAMES.has(map_path)
	if _show_for_map:
		_name.text = String(NAMES[map_path])
	_apply_visible()
	# The new map's nodes finish entering the tree after this signal.
	_mask_actors.call_deferred()

## Pushes the player and monsters onto ACTOR_LAYER so the mini render culls
## them. Monsters spawn during play, so keep masking new arrivals.
func _mask_actors() -> void:
	var map: Node = SceneManager.current_map()
	if map == null:
		return
	_set_actor_layer(map.get_node_or_null("Player"))
	var monsters: Node = map.get_node_or_null("Monsters")
	if monsters:
		_set_actor_layer(monsters)
		if not monsters.child_entered_tree.is_connected(_on_actor_spawned):
			monsters.child_entered_tree.connect(_on_actor_spawned)

func _on_actor_spawned(node: Node) -> void:
	_set_actor_layer(node)

func _set_actor_layer(node: Node) -> void:
	if node == null:
		return
	if node is CanvasItem:
		# Layer 2 only: the main viewport's cull mask (default = all bits) still
		# draws them, while the minimap viewport (mask = 1) culls them.
		(node as CanvasItem).visibility_layer = 1 << (ACTOR_LAYER - 1)
	for child in node.get_children():
		_set_actor_layer(child)

## Called by Main: hide the minimap while a popup is open (restore on close).
func set_active(active: bool) -> void:
	_suppressed = not active
	_apply_visible()

func _apply_visible() -> void:
	visible = _show_for_map and not _suppressed

func _process(_delta: float) -> void:
	if visible:
		_follow_player()
		_canvas.queue_redraw()

## Track the player at a fixed zoom and clamp to the map edges. Bounds come from
## the player camera limits (set by SceneManager.setup_camera); read every frame
## so we're robust to map-load ordering.
func _follow_player() -> void:
	var player: Node2D = _player()
	if player == null:
		return
	var pcam: Camera2D = player.get_node_or_null("Camera2D")
	if pcam:
		_cam.limit_left = pcam.limit_left
		_cam.limit_top = pcam.limit_top
		_cam.limit_right = pcam.limit_right
		_cam.limit_bottom = pcam.limit_bottom
	var vw: float = float(_view.size.x)
	var z: float = vw / VIEW_WORLD_W
	_cam.zoom = Vector2(z, z)
	# Snap to whole minimap-pixel steps so the heavily-downscaled pixel-art tiles
	# scroll rigidly instead of shimmering (pixel crawl) as the player moves.
	var step: float = VIEW_WORLD_W / vw
	var pos: Vector2 = player.global_position
	pos.x = roundf(pos.x / step) * step
	pos.y = roundf(pos.y / step) * step
	_cam.global_position = pos

func _player() -> Node2D:
	var map: Node = SceneManager.current_map()
	return map.get_node_or_null("Player") if map else null

func _on_canvas_draw() -> void:
	var map: Node = SceneManager.current_map()
	if map == null:
		return
	var player: Node2D = map.get_node_or_null("Player")
	if player == null:
		return

	# Map world -> canvas pixels using the follow camera's clamped view, so the
	# dots line up exactly with the SubViewport render underneath them.
	var center: Vector2 = _cam.get_screen_center_position()
	var z: float = _cam.zoom.x

	# Doors / exits (any interactable in this map) — drawn under the actors.
	for node in get_tree().get_nodes_in_group("interactable"):
		if node is Node2D and map.is_ancestor_of(node):
			_dot((node as Node2D).global_position, center, z, 2.6, COL_DOOR)

	# Monsters (hunting ground only).
	var monsters: Node = map.get_node_or_null("Monsters")
	if monsters:
		for m in monsters.get_children():
			if m is Node2D and not m.is_queued_for_deletion():
				_dot((m as Node2D).global_position, center, z, 2.6, COL_MONSTER)

	# Player — drawn last (on top), slightly larger.
	_dot(player.global_position, center, z, 3.6, COL_PLAYER)

func _dot(world_pos: Vector2, center: Vector2, z: float, r: float, c: Color) -> void:
	var p: Vector2 = (world_pos - center) * z + _canvas.size * 0.5
	# Skip anything scrolled outside the minimap window.
	if p.x < -r or p.y < -r or p.x > _canvas.size.x + r or p.y > _canvas.size.y + r:
		return
	_canvas.draw_circle(p, r, c)
