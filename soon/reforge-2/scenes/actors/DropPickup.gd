class_name DropPickup
extends Node2D
## A kill reward lying on the ground: pops out of the corpse in a small arc,
## rests for ~2s (gently bobbing), then vacuums into the player with
## acceleration. The payload is granted on contact (`collected` — the hunt
## listens and shows the +text); if the map unloads mid-drop the exit failsafe
## grants it silently so a reward can never be lost.

signal collected(drop: Dictionary)

const IDLE_TIME := 2.0       # seconds the pickup rests before flying to the player
const START_SPEED := 80.0    # vacuum start speed (px/s)
const ACCEL := 1400.0        # vacuum acceleration (px/s^2)
const COLLECT_DIST := 14.0   # arrival radius around the player's chest
const ICON_SIZE := 12.0      # on-ground sprite size (longest edge, px)

var _drop: Dictionary = {}
var _player: Node2D = null
var _sprite: Sprite2D = null
var _state: int = 0          # 0 = pop-out, 1 = idle on ground, 2 = flying
var _idle: float = 0.0
var _bob: float = 0.0
var _speed: float = START_SPEED
var _granted: bool = false

## Call right after add_child + positioning. `icon` is the item texture shown on
## the ground; `drop` is the payload for GameState.grant_monster_drop.
func setup(icon: Texture2D, drop: Dictionary, player: Node2D) -> void:
	_drop = drop
	_player = player
	z_index = 40                # above ground/props, below the floating +text (50)
	visibility_layer = 2        # actor layer: culled from the minimap render
	_sprite = Sprite2D.new()
	_sprite.texture = icon
	_sprite.scale = Vector2.ONE * (ICON_SIZE / maxf(icon.get_width(), icon.get_height()))
	_sprite.visibility_layer = 2
	add_child(_sprite)
	# Pop: scatter to a spot next to the corpse with a small hop.
	var target: Vector2 = position + Vector2(randf_range(-18, 18), randf_range(4, 14))
	var tw := create_tween()
	tw.tween_property(self, "position", target, 0.28) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(_sprite, "position:y", -12.0, 0.14) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(_sprite, "position:y", 0.0, 0.14) \
		.set_delay(0.14).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void: _state = 1)

func _process(delta: float) -> void:
	match _state:
		1:
			_idle += delta
			_bob += delta
			_sprite.position.y = sin(_bob * 4.0) * 1.5
			if _idle >= IDLE_TIME:
				_state = 2
		2:
			if _player == null or not is_instance_valid(_player):
				_finish()
				return
			var to: Vector2 = _player.global_position + Vector2(0, -10) - global_position
			var dist: float = to.length()
			if dist <= COLLECT_DIST:
				_finish()
				return
			_speed += ACCEL * delta
			global_position += to / dist * minf(_speed * delta, dist)

func _finish() -> void:
	if _granted:
		return
	_granted = true
	collected.emit(_drop)
	queue_free()

func _exit_tree() -> void:
	# Failsafe: freed before collection (map change, wave wipe) — grant silently.
	if not _granted:
		_granted = true
		GameState.grant_monster_drop(_drop)
