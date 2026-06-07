class_name WanderActor
extends Sprite2D
## Ambient wanderer (town animal / pedestrian NPC). Walks to random points
## inside `bounds`, idles a moment, repeats. Both sheets are 4x4 (row = facing
## down/left/right/up, col = frame) like the rest of the pack. The generator
## emits these nodes with textures + bounds set.
##
## A runtime StaticBody2D foot box (wall layer 2) makes them solid to the
## player; to avoid ever trapping the player inside that box, a wanderer stops
## walking while the player is close and waits until they move away.

@export var idle_texture: Texture2D   # defaults to the node's `texture`
@export var walk_texture: Texture2D
@export var bounds: Rect2             # world-space wander area
@export var speed: float = 16.0
@export var fps: float = 5.0

const ARRIVE_DIST := 2.0
const IDLE_MIN := 1.5
const IDLE_MAX := 4.0
const PLAYER_HOLD_DIST := 26.0   # stop walking when the player is this close

var _walking: bool = false
var _target: Vector2 = Vector2.ZERO
var _idle_left: float = 1.0
var _anim_t: float = 0.0
var _row: int = 0   # facing row while walking; idle keeps the last one

func _ready() -> void:
	hframes = 4
	vframes = 4
	visibility_layer = 2   # actor layer: culled from the minimap render
	if idle_texture == null:
		idle_texture = texture
	# Desync the herd so spawns don't move in lockstep.
	_anim_t = randf() * 10.0
	_idle_left = randf_range(0.3, IDLE_MAX)
	_make_foot_body()

## Solid foot box so the player can't walk through villagers/animals. Sized
## from the sheet's frame (texture height / 4 rows), anchored at the feet.
func _make_foot_body() -> void:
	var fh: float = texture.get_height() / 4.0
	var fw: float = texture.get_width() / 4.0
	var body := StaticBody2D.new()
	body.collision_layer = 2
	body.collision_mask = 0
	add_child(body)
	var col := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(fw * 0.45, fh * 0.25)
	col.shape = shape
	col.position = Vector2(0, fh * 0.3)
	body.add_child(col)

func _player_near() -> bool:
	var player: Node2D = get_tree().get_first_node_in_group("player")
	return player != null \
		and player.global_position.distance_to(global_position) < PLAYER_HOLD_DIST

func _process(delta: float) -> void:
	_anim_t += delta
	if not _walking:
		_idle_left -= delta
		frame = _row * 4 + int(_anim_t * fps * 0.6) % 4
		if _idle_left <= 0.0 and not _player_near():
			_walking = true
			texture = walk_texture
			_target = Vector2(
				randf_range(bounds.position.x, bounds.end.x),
				randf_range(bounds.position.y, bounds.end.y))
		return
	# Hold position while the player stands close — the solid foot box must
	# never be pushed into them (a moving StaticBody2D would trap the player).
	if _player_near():
		frame = _row * 4 + int(_anim_t * fps * 0.6) % 4
		return
	var to: Vector2 = _target - global_position
	if to.length() <= ARRIVE_DIST:
		_walking = false
		texture = idle_texture
		_idle_left = randf_range(IDLE_MIN, IDLE_MAX)
		return
	global_position += to.normalized() * speed * delta
	if absf(to.x) > absf(to.y):
		_row = 2 if to.x > 0.0 else 1
	else:
		_row = 0 if to.y > 0.0 else 3
	frame = _row * 4 + int(_anim_t * fps) % 4
