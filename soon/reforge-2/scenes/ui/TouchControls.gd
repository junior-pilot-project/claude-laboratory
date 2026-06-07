extends Control
## On-screen touch input overlay: a virtual joystick (drives move_*) plus a
## context button that swaps between 공격(attack) and an interact button. The
## interact button only appears when the player stands next to an interactable
## (NPC/door/sign), otherwise the attack button is shown — they share one slot to
## save space. Buttons inject their action through the input pipeline so the
## world's _unhandled_input handlers fire unchanged. Visibility is owned by Main.

@onready var _attack: Button = %Attack
@onready var _dash: Button = %Dash
@onready var _interact: Button = %Interact
@onready var _potion_bar: HBoxContainer = %PotionBar

# Quick-bar slot 0 (the equipped potion); the other two slots are reserved blanks.
var _quick_btn: Button = null
var _quick_count: Label = null
var _quick_cool: Label = null   # centred countdown during the potion cooldown
var _in_hunt: bool = false

func _ready() -> void:
	_interact.button_down.connect(_send.bind("interact", true))
	_interact.button_up.connect(_send.bind("interact", false))
	_attack.button_down.connect(_send.bind("attack", true))
	_attack.button_up.connect(_send.bind("attack", false))
	_dash.button_down.connect(_send.bind("dash", true))
	_dash.button_up.connect(_send.bind("dash", false))
	_build_potion_slots()
	GameState.potions_changed.connect(_refresh_potions)
	_refresh_potions()
	# Potions only matter where HP can drop (hunting grounds and the dungeon).
	SceneManager.map_changed.connect(func(p): _in_hunt = SceneManager.is_combat(p))

## Bottom action bar: slot 0 shows the potion equipped from the inventory's 소비
## tab (icon + count badge; tap to drink); the other two slots are reserved
## blanks for future quick items. Hidden outside the hunt.
func _build_potion_slots() -> void:
	for i in 3:
		var btn := Button.new()
		btn.custom_minimum_size = Vector2(34, 34)
		btn.expand_icon = true
		btn.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		btn.vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
		btn.disabled = true
		_potion_bar.add_child(btn)
		if i > 0:
			# Reserved future slots: ghosted so they read as placeholders, not bugs.
			btn.modulate = Color(1, 1, 1, 0.35)
			continue
		btn.pressed.connect(_on_potion_pressed)
		var count := Label.new()
		count.add_theme_font_size_override("font_size", 10)
		count.add_theme_color_override("font_color", Color(0.98, 0.94, 0.86))
		count.add_theme_color_override("font_outline_color", Color(0.18, 0.09, 0.05))
		count.add_theme_constant_override("outline_size", 3)
		count.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		count.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
		count.mouse_filter = Control.MOUSE_FILTER_IGNORE
		count.set_anchors_preset(Control.PRESET_FULL_RECT)
		# Inset so the badge sits inside the slot frame instead of on its edge.
		count.offset_right = -3
		count.offset_bottom = -2
		btn.add_child(count)
		var cool := Label.new()
		cool.add_theme_font_size_override("font_size", 14)
		cool.add_theme_color_override("font_color", Color(1, 1, 1))
		cool.add_theme_color_override("font_outline_color", Color(0.1, 0.05, 0.03))
		cool.add_theme_constant_override("outline_size", 4)
		cool.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cool.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		cool.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cool.set_anchors_preset(Control.PRESET_FULL_RECT)
		btn.add_child(cool)
		_quick_btn = btn
		_quick_count = count
		_quick_cool = cool

func _on_potion_pressed() -> void:
	if GameState.use_equipped_potion():
		Audio.play("buy")

func _refresh_potions() -> void:
	var id: String = GameState.equipped_potion
	if id == "":
		_quick_btn.icon = null
		_quick_btn.tooltip_text = ""
		_quick_count.text = ""
		_quick_btn.disabled = true
		return
	var n: int = GameState.potion_count(id)
	_quick_btn.icon = load(GameConfig.potion_icon_path(id))
	_quick_btn.tooltip_text = GameConfig.POTIONS[id]["label"]
	# Count only — the latin "x" renders like π in the Korean fallback font.
	_quick_count.text = "%d" % n
	_quick_btn.disabled = n <= 0

func _process(_delta: float) -> void:
	# Swap to the interact button while next to an interactable, labelled with its
	# prompt (e.g. "Equip Shop", "Sign", "Back to Town").
	var near: Node = _nearest_interactable()
	var show_interact: bool = near != null
	_interact.visible = show_interact
	_attack.visible = not show_interact
	_potion_bar.visible = _in_hunt
	if _in_hunt:
		_tick_potion_cooldown()
	if show_interact:
		_interact.text = String(near.get("prompt"))

## Per-frame cooldown overlay: a centred seconds countdown on the quick-slot and
## the button held disabled until the potion is ready again.
func _tick_potion_cooldown() -> void:
	if _quick_btn == null:
		return
	var cd: float = GameState.potion_cooldown_left()
	_quick_cool.text = ("%d" % ceili(cd)) if cd > 0.0 else ""
	var id: String = GameState.equipped_potion
	_quick_btn.disabled = id == "" or GameState.potion_count(id) <= 0 or cd > 0.0

func _nearest_interactable() -> Node:
	for node in get_tree().get_nodes_in_group("interactable"):
		if node.has_method("has_player_near") and node.has_player_near():
			return node
	return null

func _send(action: String, pressed: bool) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = pressed
	Input.parse_input_event(ev)
