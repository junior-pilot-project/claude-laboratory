extends Control
## Gambling den: four random boxes. Opening a box deducts its price, rolls a
## reward (floor(rand^2 * max)), and credits gold immediately. Each box is
## limited to a max purchase count. The free box is the seed-money path.

signal closed

@onready var _rows: VBoxContainer = %Rows
@onready var _result: Label = %Result

var _drawing: bool = false  # true while the anticipation popup is on screen

func _ready() -> void:
	%Close.pressed.connect(_close)
	GameState.gold_changed.connect(func(_g): _rebuild())
	_rebuild()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		if not _drawing:
			_close()

func _close() -> void:
	closed.emit()

func _rebuild() -> void:
	_rows.add_theme_constant_override("separation", 10)
	for c in _rows.get_children():
		c.queue_free()
	for box_id in GameConfig.BOX_ORDER:
		_rows.add_child(_build_row(box_id))

func _build_row(box_id: String) -> Control:
	var cfg: Dictionary = GameConfig.BOXES[box_id]
	var price: int = int(cfg["price"])

	# Frameless row: chest icon + info on the top line, two wide draw buttons below.
	# Heavy per-row card frames read as visual noise on the narrow portrait modal,
	# so rows are divided by thin separators instead.
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 6)
	col.add_child(top)

	var icon := TextureRect.new()
	icon.texture = load(GameConfig.box_icon_path(box_id))
	icon.custom_minimum_size = Vector2(24, 24)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(icon)

	# The box label already states the price ("1천G 상자"...), so the name plus the
	# max payout fit on one info line: name on the left, payout right-aligned.
	# One line per box keeps all four boxes visible without scrolling.
	var title := Label.new()
	title.clip_text = true
	title.add_theme_font_size_override("font_size", 11)
	title.text = str(cfg["label"])
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if box_id == "free":
		title.add_theme_color_override("font_color", Color(0.7, 1, 0.7))
	top.add_child(title)
	# No clip_text here: clipping zeroes a Label's min width, letting the expanding
	# title squeeze the payout into nothing. The payout keeps its natural width and
	# the (clipped) title absorbs any shortfall instead.
	var detail := Label.new()
	detail.add_theme_font_size_override("font_size", 10)
	detail.add_theme_color_override("font_color", Color(0.5, 0.38, 0.3))
	detail.text = "최대 %sG" % _g_short(int(cfg["max_reward"]))
	detail.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(detail)

	# The pixel-font fallback renders a hair wider than the Label measures, which
	# shaved the trailing "G" at the panel edge — a fixed end pad absorbs that.
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(6, 0)
	top.add_child(pad)

	var btns := HBoxContainer.new()
	btns.add_theme_constant_override("separation", 6)
	var b1 := _draw_button("1회", box_id, 1, price)
	var b10 := _draw_button("10회", box_id, GameConfig.MAX_DRAW, price * GameConfig.MAX_DRAW)
	b1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b10.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btns.add_child(b1)
	btns.add_child(b10)
	col.add_child(btns)
	return col

func _draw_button(label: String, box_id: String, count: int, total_cost: int) -> Button:
	var btn := Button.new()
	btn.text = label
	btn.custom_minimum_size = Vector2(56, 0)
	btn.tooltip_text = "비용 %sG" % _comma(total_cost)
	btn.disabled = not GameState.can_afford(total_cost)
	btn.pressed.connect(_on_draw.bind(box_id, count))
	return btn

func _on_draw(box_id: String, count: int) -> void:
	if _drawing:
		return
	var cfg: Dictionary = GameConfig.BOXES[box_id]
	var total_cost: int = int(cfg["price"]) * count
	# Pre-check affordability so the suspense (and gold spend) only runs on a valid
	# draw. The actual open_boxes happens at the reveal, to avoid spoiling the
	# outcome via an early HUD gold bump.
	if not GameState.can_afford(total_cost):
		Audio.play("lose")
		_flash("골드가 부족합니다", Color(1, 0.6, 0.6))
		return
	_drawing = true
	await _play_draw(box_id, count, cfg)
	_drawing = false

## Full-screen anticipation popup: ~2s of rolling-number suspense, then reveal.
func _play_draw(box_id: String, count: int, cfg: Dictionary) -> void:
	var overlay := Control.new()
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP  # block the board underneath
	add_child(overlay)

	var dim := ColorRect.new()
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0, 0, 0, 0.72)
	overlay.add_child(dim)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(center)

	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(168, 0)
	center.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	card.add_child(col)

	var chest := TextureRect.new()
	chest.texture = load(GameConfig.box_icon_path(box_id))
	chest.custom_minimum_size = Vector2(40, 40)
	chest.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	chest.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	chest.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	col.add_child(chest)

	var head := Label.new()
	head.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.text = ("%s  %d개" % [cfg["label"], count]) if count > 1 else str(cfg["label"])
	col.add_child(head)

	var big := Label.new()
	big.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	big.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	big.add_theme_font_size_override("font_size", 18)
	big.custom_minimum_size = Vector2(144, 44)
	col.add_child(big)

	# Phase 1: roll random numbers for ~2s as suspense. Use wall-clock so the
	# duration is exact regardless of per-frame timer drift.
	Audio.play("gamble")
	var roll_max: int = int(cfg["max_reward"]) * count
	var start_ms: int = Time.get_ticks_msec()
	while Time.get_ticks_msec() - start_ms < 2000:
		big.text = "%sG ?" % _comma(randi() % (roll_max + 1))
		await get_tree().create_timer(0.07).timeout

	# Phase 2: reveal the real outcome (this is where gold actually changes).
	var res: Dictionary = GameState.open_boxes(box_id, count)
	if not res["ok"]:
		overlay.queue_free()
		return
	var reward: int = int(res["reward"])
	var net: int = reward - int(res["spent"])
	var msg := ""
	var color := Color.WHITE
	if int(res["count"]) > 1:
		color = Color(1, 0.95, 0.5) if net >= 0 else Color(1, 0.75, 0.5)
		msg = "%d회  %sG\n(순익 %s%sG)" % [
			res["count"], _comma(reward), "+" if net >= 0 else "-", _comma(abs(net))]
		Audio.play("reward" if reward > 0 else "lose")
	elif reward <= 0:
		color = Color(1, 0.75, 0.5)
		msg = "꽝!  0G"
		Audio.play("lose")
	else:
		color = Color(1, 0.95, 0.5)
		msg = "당첨!  %sG" % _comma(reward)
		Audio.play("reward")
	big.text = msg
	big.add_theme_color_override("font_color", color)

	var ok := Button.new()
	ok.text = "확인"
	col.add_child(ok)
	ok.grab_focus()
	await ok.pressed
	overlay.queue_free()
	_flash(msg.replace("\n", "  "), color)

func _flash(text: String, color: Color = Color.WHITE) -> void:
	_result.text = text
	_result.add_theme_color_override("font_color", color)

## Short Korean gold figure for tight row labels: clean 만 multiples collapse
## ("100000" -> "10만"), anything else falls back to the comma format.
static func _g_short(n: int) -> String:
	if n >= 10_000 and n % 10_000 == 0:
		return "%d만" % (n / 10_000)
	return _comma(n)

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
