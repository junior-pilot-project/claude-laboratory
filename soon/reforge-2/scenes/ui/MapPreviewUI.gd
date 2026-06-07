extends Control
## Full-map preview popup (opened by tapping the minimap). A SubViewport shares
## the main World2D and frames the WHOLE current map with its own camera —
## terrain only (actors live on visibility layer 2, which this viewport culls);
## the player shows as a yellow dot on the overlay canvas. Letterboxing falls on
## the dark panel behind the viewport, so non-matching aspect ratios look fine.

signal closed

const NAMES_SOURCE := preload("res://scenes/ui/Minimap.gd")

const COL_PLAYER := Color(1.0, 0.95, 0.5)

@onready var _title: Label = %Title
@onready var _view: SubViewport = $Window/VBox/Frame/ViewportContainer/View
@onready var _cam: Camera2D = $Window/VBox/Frame/ViewportContainer/View/Cam
@onready var _canvas: Control = %Canvas

func _ready() -> void:
	%Close.pressed.connect(func() -> void: closed.emit())
	_view.world_2d = get_viewport().world_2d
	_view.canvas_cull_mask = 1   # actor layer (2) stays hidden, like the minimap
	_cam.make_current()
	_canvas.draw.connect(_on_canvas_draw)
	_title.text = String(NAMES_SOURCE.NAMES.get(SceneManager.current_map_path, "지도"))

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		closed.emit()

func _process(_delta: float) -> void:
	_frame_camera()
	_canvas.queue_redraw()

## Centre on the map and zoom so the whole map fits the viewport (uniform zoom —
## the map keeps its aspect; leftover space letterboxes onto the panel).
func _frame_camera() -> void:
	var bounds: Vector2 = _map_bounds()
	if bounds == Vector2.ZERO:
		return
	var vp: Vector2 = Vector2(_view.size)
	if vp.x < 1.0 or vp.y < 1.0:
		return
	var z: float = minf(vp.x / bounds.x, vp.y / bounds.y)
	_cam.zoom = Vector2(z, z)
	_cam.global_position = bounds * 0.5

## Map size from the player camera limits (set by SceneManager.setup_camera).
func _map_bounds() -> Vector2:
	var map: Node = SceneManager.current_map()
	if map == null:
		return Vector2.ZERO
	var player: Node2D = map.get_node_or_null("Player")
	if player == null:
		return Vector2.ZERO
	var cam: Camera2D = player.get_node_or_null("Camera2D")
	if cam == null:
		return Vector2.ZERO
	return Vector2(float(cam.limit_right), float(cam.limit_bottom))

func _on_canvas_draw() -> void:
	var bounds: Vector2 = _map_bounds()
	if bounds == Vector2.ZERO:
		return
	var map: Node = SceneManager.current_map()
	var player: Node2D = map.get_node_or_null("Player")
	if player == null:
		return
	# Same world->screen transform as the framing camera (uniform zoom, centred).
	var z: float = _cam.zoom.x
	var p: Vector2 = (player.global_position - _cam.global_position) * z + _canvas.size * 0.5
	_canvas.draw_circle(p, 4.0, COL_PLAYER)
	_canvas.draw_arc(p, 5.5, 0.0, TAU, 24, Color(0.18, 0.09, 0.05), 1.5)
