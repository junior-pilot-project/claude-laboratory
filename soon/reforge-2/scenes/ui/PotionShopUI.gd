extends Control
## Potion shop: three HP potions (small/medium/large). Buying deducts gold and
## adds to the persisted potion counts (cap POTION_MAX each); bought potions go
## to the inventory's 소비 tab, where equipping one puts it on the hunt
## quick-slot. Mirrors GamblingUI's row layout.

signal closed

@onready var _rows: VBoxContainer = %Rows
@onready var _result: Label = %Result

func _ready() -> void:
	%Close.pressed.connect(_close)
	GameState.gold_changed.connect(func(_g): _rebuild())
	GameState.potions_changed.connect(_rebuild)
	_rebuild()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_close()

func _close() -> void:
	closed.emit()

func _rebuild() -> void:
	_rows.add_theme_constant_override("separation", 10)
	for c in _rows.get_children():
		c.queue_free()
	for id in GameConfig.POTION_ORDER:
		_rows.add_child(_build_row(id))

func _build_row(id: String) -> Control:
	var cfg: Dictionary = GameConfig.POTIONS[id]
	var price: int = int(cfg["price"])

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 6)
	col.add_child(top)

	var icon := TextureRect.new()
	icon.texture = load(GameConfig.potion_icon_path(id))
	icon.custom_minimum_size = Vector2(24, 24)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(icon)

	# Title expands+clips; the owned count keeps its natural width in its own
	# label so it can never be squeezed away (clip_text zeroes a Label's min).
	var title := Label.new()
	title.clip_text = true
	title.add_theme_font_size_override("font_size", 11)
	title.text = str(cfg["label"])
	# Reserve the full label width: with clip_text a Label's min is 0, so the
	# detail/count would squeeze the name to nothing on the narrow modal.
	title.custom_minimum_size = Vector2(60, 0)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(title)

	var detail := Label.new()
	detail.add_theme_font_size_override("font_size", 10)
	detail.add_theme_color_override("font_color", Color(0.5, 0.38, 0.3))
	detail.text = "%d%% 회복" % int(round(float(cfg["heal_pct"]) * 100.0))
	detail.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(detail)

	var pad := Control.new()
	pad.custom_minimum_size = Vector2(6, 0)
	top.add_child(pad)

	var btns := HBoxContainer.new()
	btns.add_theme_constant_override("separation", 6)
	var b1 := _buy_button("%sG" % _comma(price), id, 1, price)
	var b10 := _buy_button("10개  %sG" % _comma(price * 10), id, 10, price * 10)
	b1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b10.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btns.add_child(b1)
	btns.add_child(b10)
	col.add_child(btns)
	return col

func _buy_button(label: String, id: String, count: int, total_cost: int) -> Button:
	var btn := Button.new()
	btn.text = label
	btn.custom_minimum_size = Vector2(56, 0)
	btn.add_theme_font_size_override("font_size", 11)
	var over_cap: bool = GameState.potion_count(id) + count > GameConfig.POTION_MAX
	btn.disabled = over_cap or not GameState.can_afford(total_cost)
	btn.pressed.connect(_on_buy.bind(id, count))
	return btn

func _on_buy(id: String, count: int) -> void:
	if GameState.buy_potion(id, count):
		Audio.play("buy")
		_flash("%s %d개 구매!" % [GameConfig.POTIONS[id]["label"], count], Color(0.6, 1, 0.6))
	elif GameState.potion_count(id) + count > GameConfig.POTION_MAX:
		Audio.play("lose")
		_flash("최대 %d개까지 보유 가능" % GameConfig.POTION_MAX, Color(1, 0.6, 0.6))
	else:
		Audio.play("lose")
		_flash("골드가 부족합니다", Color(1, 0.6, 0.6))

func _flash(text: String, color: Color = Color.WHITE) -> void:
	_result.text = text
	_result.add_theme_color_override("font_color", color)

static func _comma(n: int) -> String:
	var s := str(abs(n))
	var out := ""
	var c := 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		c += 1
		if c % 3 == 0 and i > 0:
			out = "," + out
	return ("-" if n < 0 else "") + out
