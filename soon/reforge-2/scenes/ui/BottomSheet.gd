class_name BottomSheet
extends Control
## Reusable bottom-sheet popup base. The subclass scene keeps the game world
## visible above a panel child named "Sheet" that is anchored to the bottom of
## the screen. On open the sheet slides up; tapping the world area above it (or
## ui_cancel / the subclass calling request_close) slides it back down, and
## `closed` is emitted only after that tween so Main can free us safely.
##
## Subclasses: name the panel node "Sheet", call super() first in _ready(), and
## override _can_close() to veto closing (e.g. while an inner overlay is up).

signal closed

const SLIDE_TIME: float = 0.2

var _sheet: Control
var _catcher: Control
var _open_y: float = 0.0
var _open_tween: Tween
var _closing: bool = false

func _ready() -> void:
	_sheet = get_node("Sheet")
	# Invisible tap catcher covering exactly the world strip above the sheet.
	# First child so anything the subclass overlays later draws/inputs above it.
	_catcher = Control.new()
	_catcher.name = "TapCatcher"
	_catcher.anchor_left = 0.0
	_catcher.anchor_top = 0.0
	_catcher.anchor_right = 1.0
	_catcher.anchor_bottom = _sheet.anchor_top
	_catcher.mouse_filter = Control.MOUSE_FILTER_STOP
	_catcher.gui_input.connect(_on_catcher_input)
	add_child(_catcher)
	move_child(_catcher, 0)
	# Hide before the first frame so the sheet never flashes at its final spot;
	# the deferred open runs after the first layout pass has set its position.
	_sheet.visible = false
	_slide_open.call_deferred()

func _slide_open() -> void:
	await get_tree().process_frame
	_open_y = _sheet.position.y
	_sheet.position.y = get_viewport_rect().size.y
	_sheet.visible = true
	# Animate position only: touching offsets would relayout the sheet's
	# children every tween frame (and re-fire any resized-driven rebuilds).
	_open_tween = create_tween()
	_open_tween.tween_property(_sheet, "position:y", _open_y, SLIDE_TIME) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		request_close()

func _on_catcher_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb != null and mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed:
		request_close()
		return
	var touch := event as InputEventScreenTouch
	if touch != null and touch.pressed:
		request_close()

## Slide down, then tell the owner we are done (Main frees us on `closed`).
func request_close() -> void:
	if _closing or not _can_close():
		return
	_closing = true
	if _open_tween and _open_tween.is_running():
		_open_tween.kill()
	_catcher.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tw := create_tween()
	tw.tween_property(_sheet, "position:y", _open_y + _sheet.size.y + 8.0, SLIDE_TIME) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	await tw.finished
	closed.emit()

## Subclass hook: return false to ignore close requests for now.
func _can_close() -> bool:
	return true
