extends Control
## Fixed-position virtual joystick for mobile. Drives the move_* input actions by
## strength (Input.action_press) so Player.gd's Input.get_axis polling keeps
## working unchanged. Supports multitouch (tracks a touch index) and falls back
## to mouse for desktop/web testing. Lower action deadzones (project.godot) keep
## small pushes from being clipped.

const RADIUS: float = 38.0
const KNOB_RADIUS: float = 20.0
const MOVE_ACTIONS := ["move_left", "move_right", "move_up", "move_down"]

var _active: bool = false
var _touch_index: int = -1   # -1 == mouse pointer
var _value: Vector2 = Vector2.ZERO

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and not _active:
			_begin(event.index, event.position)
		elif not event.pressed and event.index == _touch_index:
			_end()
		accept_event()
	elif event is InputEventScreenDrag and _active and event.index == _touch_index:
		_update(event.position)
		accept_event()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed and not _active:
			_begin(-1, event.position)
		elif not event.pressed and _touch_index == -1:
			_end()
		accept_event()
	elif event is InputEventMouseMotion and _active and _touch_index == -1:
		_update(event.position)
		accept_event()

func _begin(index: int, pos: Vector2) -> void:
	_active = true
	_touch_index = index
	_update(pos)

func _update(pos: Vector2) -> void:
	var center := size / 2.0
	var offset := pos - center
	if offset.length() > RADIUS:
		offset = offset.normalized() * RADIUS
	_value = offset / RADIUS
	_apply(_value)
	queue_redraw()

func _end() -> void:
	_active = false
	_touch_index = -1
	_value = Vector2.ZERO
	_release_all()
	queue_redraw()

func _apply(v: Vector2) -> void:
	_press("move_right", maxf(v.x, 0.0))
	_press("move_left", maxf(-v.x, 0.0))
	_press("move_down", maxf(v.y, 0.0))
	_press("move_up", maxf(-v.y, 0.0))

func _press(action: String, strength: float) -> void:
	if strength > 0.05:
		Input.action_press(action, strength)
	else:
		Input.action_release(action)

func _release_all() -> void:
	for a in MOVE_ACTIONS:
		Input.action_release(a)

func _notification(what: int) -> void:
	# Drop held directions if the joystick gets hidden mid-push (e.g. popup opens).
	if what == NOTIFICATION_VISIBILITY_CHANGED and not is_visible_in_tree():
		_end()

func _draw() -> void:
	var center := size / 2.0
	draw_circle(center, RADIUS, Color(0, 0, 0, 0.28))
	draw_arc(center, RADIUS, 0.0, TAU, 32, Color(1, 1, 1, 0.35), 2.0)
	draw_circle(center + _value * RADIUS, KNOB_RADIUS, Color(1, 1, 1, 0.55))
