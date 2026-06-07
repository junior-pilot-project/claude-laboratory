@tool
extends Area2D
class_name Interactable
## Proximity interaction zone. Shows a floating "[E] <prompt>" label when the
## player is in range and emits `interacted` when the interact action fires.
## Attach to NPCs / doors; connect `interacted` in the map script.

signal interacted

@export var prompt: String = "조사"

var _player_in_range: bool = false

@onready var _label: Label = $Prompt

func _ready() -> void:
	if Engine.is_editor_hint():
		return
	add_to_group("interactable")
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	_refresh_label()

func _refresh_label() -> void:
	if _label:
		_label.text = "[E] %s" % prompt
		_label.visible = _player_in_range

func _on_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		_player_in_range = true
		_refresh_label()

func _on_body_exited(body: Node) -> void:
	if body.is_in_group("player"):
		_player_in_range = false
		_refresh_label()

func _unhandled_input(event: InputEvent) -> void:
	if Engine.is_editor_hint():
		return
	if _player_in_range and event.is_action_pressed("interact"):
		get_viewport().set_input_as_handled()
		Audio.play("click")
		interacted.emit()

func set_active(active: bool) -> void:
	# Used to suppress prompts while a popup is open.
	monitoring = active
	if not active:
		_player_in_range = false
		_refresh_label()

## True while the player is standing in this zone (and it's active). Used by the
## touch controls to swap the attack button for an interact button.
func has_player_near() -> bool:
	return _player_in_range and monitoring
