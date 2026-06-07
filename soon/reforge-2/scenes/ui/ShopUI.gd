extends Control
## Equipment shop: a 구매(Buy) tab and a 강화(Enhance) tab. Buys deduct gold and
## add to inventory; enhancement rolls against the chance table, burns gold, and
## (on success) raises the item level. Equipping a slot feeds the HUD 강화합.

signal closed

# Paper-doll EQUIPMENT layout: a 3-wide cross of body-part slots (helmet on top,
# sword/armor/shield across the middle, boots at the bottom); "" = blank corner.
const EQUIP_LAYOUT: Array[String] = ["", "helmet", "", "sword", "armor", "shield", "", "boots", ""]

# Which tabs this shop instance exposes. Set by Main.open_shop(mode) BEFORE the
# node enters the tree: "merchant" = Buy+Craft, "blacksmith" = Enhance only,
# "full" = all three (default; the test harness relies on it).
var mode: String = "full"

var _tab: String = "buy"
var _selected_index: int = -1
var _enhancing: bool = false  # true while the enhance anticipation popup is up

@onready var _tab_buy: Button = %TabBuy
@onready var _tab_enh: Button = %TabEnhance
@onready var _tab_craft: Button = %TabCraft
@onready var _content: Control = %Content
@onready var _result: Label = %Result

func _ready() -> void:
	%Close.pressed.connect(_close)
	_tab_buy.pressed.connect(func(): _switch("buy"))
	_tab_enh.pressed.connect(func(): _switch("enhance"))
	_tab_craft.pressed.connect(func(): _switch("craft"))
	GameState.gold_changed.connect(func(_g): _rebuild())
	GameState.inventory_changed.connect(_rebuild)
	GameState.materials_changed.connect(func(_m): _rebuild())
	match mode:
		"merchant":
			_tab_enh.visible = false
			_switch("buy")
		"blacksmith":
			_tab_buy.visible = false
			_tab_craft.visible = false
			_switch("enhance")
		_:
			_switch("buy")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		if not _enhancing:
			_close()

func _close() -> void:
	closed.emit()

func _switch(tab: String) -> void:
	_tab = tab
	_tab_buy.button_pressed = tab == "buy"
	_tab_enh.button_pressed = tab == "enhance"
	_tab_craft.button_pressed = tab == "craft"
	if tab == "enhance":
		_selected_index = -1  # enter Enhance with nothing picked -> Upgrade disabled
	_flash("")
	_rebuild()

func _rebuild() -> void:
	for c in _content.get_children():
		c.queue_free()
	match _tab:
		"buy": _build_buy()
		"enhance": _build_enhance()
		"craft": _build_craft()

# ---------------------------------------------------------------------------
# Buy tab
# ---------------------------------------------------------------------------
func _build_buy() -> void:
	# Single-grade shop: only High gear is sold (gold comes easily, so nobody bought
	# the cheaper tiers). One row per type — icon + name on the left, a full-price Buy
	# button on the right — instead of the old grade-column grid.
	const ICON_W := 28
	var grade: String = GameConfig.SHOP_GRADES[0]
	var price: int = int(GameConfig.SHOP_PRICE[grade])

	var rows := VBoxContainer.new()
	rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rows.add_theme_constant_override("separation", 4)
	_content.add_child(rows)

	for type in GameConfig.SHOP_TYPES:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		rows.add_child(row)

		var cell := _type_cell(type)
		cell.custom_minimum_size = Vector2(ICON_W, ICON_W)
		row.add_child(cell)

		# Name column is fixed-width (not expand-fill) so the price button sits right
		# next to the names instead of being pushed to the far edge; the trailing
		# spacer absorbs the leftover row width.
		var name_lbl := Label.new()
		name_lbl.text = GameConfig.type_grade_name(type, grade)
		name_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		name_lbl.custom_minimum_size = Vector2(64, 0)
		name_lbl.size_flags_vertical = Control.SIZE_EXPAND_FILL
		row.add_child(name_lbl)

		var btn := Button.new()
		btn.text = "%sG" % _comma(price)
		btn.add_theme_font_size_override("font_size", 11)
		btn.tooltip_text = GameConfig.stat_text(type, grade, 0)
		btn.disabled = not GameState.can_afford(price)
		btn.size_flags_vertical = Control.SIZE_EXPAND_FILL
		btn.pressed.connect(_on_buy.bind(type, grade))
		row.add_child(btn)

		var tail := Control.new()
		tail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(tail)

func _on_buy(type: String, grade: String) -> void:
	if GameState.inventory_full():
		Audio.play("lose")
		_flash("인벤토리가 가득 찼습니다", Color(1, 0.6, 0.6))
		return
	var eq := GameState.buy_equipment(type, grade)
	if eq != null:
		Audio.play("buy")
		_flash("%s 구매!" % eq.display_name(), Color(0.6, 1, 0.6))
	else:
		Audio.play("lose")
		_flash("골드가 부족합니다", Color(1, 0.6, 0.6))

# ---------------------------------------------------------------------------
# Enhance tab
# ---------------------------------------------------------------------------
func _build_enhance() -> void:
	# Paper-doll EQUIPMENT panel (mirrors the reference screen): fixed body-part slots
	# — helmet on top, sword/armor/shield across the middle, boots at the bottom —
	# each showing the worn piece for that part (or the part silhouette when empty).
	# Tap a worn slot to select it; UPGRADE enhances that piece.
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	v.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_child(v)

	var cell: int = _equip_cell_size()
	var grid := GridContainer.new()
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	v.add_child(grid)

	for part in EQUIP_LAYOUT:
		if part == "":
			grid.add_child(_blank_cell(cell))
		else:
			grid.add_child(_equip_slot_cell(part, cell))

	# A flexible spacer absorbs the leftover height so the detail + UPGRADE pin to the
	# bottom and the grid stays compact — keeping the modal the same size on every tab
	# (the grid no longer stretches to fill, which used to grow the panel).
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(spacer)

	var detail := VBoxContainer.new()
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail.add_theme_constant_override("separation", 3)
	v.add_child(detail)
	_fill_detail(detail)

## Cell edge for the 3-wide equipment grid — kept small so all three rows plus the
## detail/UPGRADE fit within the fixed modal height (no per-tab resizing).
func _equip_cell_size() -> int:
	var avail: float = _content.size.x
	if avail < 1.0:
		avail = get_viewport_rect().size.x - 40.0
	return clampi(int((avail - 2 * 6) / 3.0), 30, 40)

## A transparent spacer occupying a slot's footprint (the corners of the cross).
func _blank_cell(cell: int) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(cell, cell)
	return c

## One body-part slot: the part's silhouette frame as background, overlaid with the
## worn item's icon + level when something is equipped there (gold-tinted while it is
## the picked slot). Empty parts show only the silhouette and are not selectable.
func _equip_slot_cell(part: String, cell: int) -> Button:
	var eq: Equipment = GameState.equipped.get(part)
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(cell, cell)
	btn.flat = true
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())

	var bg := TextureRect.new()
	bg.texture = load("res://assets/ui/slots/slot_%s.png" % part)
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	btn.add_child(bg)

	if eq == null:
		btn.disabled = true  # nothing worn here -> just the silhouette, not pickable
		return btn

	var idx: int = GameState.inventory.find(eq)
	if idx == _selected_index:
		btn.modulate = Color(1.3, 1.2, 0.6)  # highlight the picked slot
	btn.tooltip_text = "%s\n%s" % [eq.display_name(), GameConfig.stat_text(eq.type, eq.grade, eq.level)]

	var icon := TextureRect.new()
	icon.texture = load(GameConfig.type_grade_icon_path(eq.type, eq.grade))
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.set_anchors_preset(Control.PRESET_FULL_RECT)
	icon.offset_left = 6; icon.offset_top = 5; icon.offset_right = -6; icon.offset_bottom = -9
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	btn.add_child(icon)

	var badge := Label.new()
	badge.text = "+%d" % eq.level
	badge.add_theme_font_size_override("font_size", 10)
	badge.add_theme_color_override("font_color", Color(0.98, 0.94, 0.86))
	badge.add_theme_color_override("font_outline_color", Color(0.18, 0.09, 0.05))
	badge.add_theme_constant_override("outline_size", 3)
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	badge.set_anchors_preset(Control.PRESET_FULL_RECT)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	btn.add_child(badge)

	btn.pressed.connect(_on_item_selected.bind(idx))
	return btn

func _fill_detail(detail: VBoxContainer) -> void:
	if _selected_index < 0 or _selected_index >= GameState.inventory.size():
		var msg := "강화할 장비를 선택하세요" if not GameState.equipped.is_empty() \
			else "가방에서 장비를 장착한 뒤 강화하세요"
		detail.add_child(_cell_label(msg))
		detail.add_child(_upgrade_button(true))
		return

	var eq: Equipment = GameState.inventory[_selected_index]
	var chance: int = GameConfig.enhance_chance(eq.grade, eq.level)
	var cost: int = GameConfig.enhance_cost(eq.grade, eq.level)

	detail.add_child(_cell_label("%s  →  +%d" % [eq.display_name(), eq.level + 1]))
	detail.add_child(_cell_label("%s     %d%%     %sG" % [
		GameConfig.stat_text(eq.type, eq.grade, eq.level), chance, _comma(cost)]))

	var enh := _upgrade_button(not GameState.can_afford(cost))
	enh.pressed.connect(_on_enhance)
	detail.add_child(enh)
	# Equipping lives in the Inventory screen now — the shop only enhances.

## Full-width emphasised UPGRADE button (matches the reference equipment panel): a
## single wide call-to-action pinned under the gear grid, disabled when unusable.
func _upgrade_button(disabled: bool) -> Button:
	var b := Button.new()
	b.text = "강화하기"
	b.disabled = disabled
	b.custom_minimum_size = Vector2(0, 30)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_font_size_override("font_size", 13)
	return b

func _on_item_selected(idx: int) -> void:
	_selected_index = idx
	_rebuild()

func _on_enhance() -> void:
	if _enhancing:
		return
	var eq: Equipment = GameState.inventory[_selected_index]
	var cost: int = GameConfig.enhance_cost(eq.grade, eq.level)
	# Pre-check affordability so the suspense (and the actual gold spend) only runs
	# on a valid attempt; try_enhance itself happens at the reveal.
	if not GameState.can_afford(cost):
		Audio.play("lose")
		_flash("골드가 부족합니다", Color(1, 0.6, 0.6))
		return
	_enhancing = true
	await _play_enhance(eq)
	_enhancing = false

## Full-screen anticipation popup: ~2s of charging suspense, then 성공/실패 reveal.
func _play_enhance(eq: Equipment) -> void:
	var before: int = eq.level
	var chance: int = GameConfig.enhance_chance(eq.grade, eq.level)

	var overlay := Control.new()
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP  # block the panel underneath
	add_child(overlay)

	var dim := ColorRect.new()
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0, 0, 0, 0.72)
	overlay.add_child(dim)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(center)

	var card := PanelContainer.new()
	center.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	card.add_child(col)

	var head := Label.new()
	head.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.text = "%s  (%d%%)" % [eq.display_name(), chance]
	col.add_child(head)

	var big := Label.new()
	big.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	big.add_theme_font_size_override("font_size", 20)
	big.custom_minimum_size = Vector2(140, 44)
	big.text = "+%d  →  +%d" % [before, before + 1]
	col.add_child(big)

	# Phase 1: pulse the target level for ~2s (wall-clock, exact regardless of
	# per-frame timer drift).
	var start_ms: int = Time.get_ticks_msec()
	var phase: float = 0.0
	while Time.get_ticks_msec() - start_ms < 2000:
		phase += 0.16
		big.modulate.a = 0.4 + 0.6 * (0.5 + 0.5 * sin(phase * PI))
		await get_tree().create_timer(0.04).timeout
	big.modulate.a = 1.0

	# Phase 2: reveal the real outcome (this is where gold actually changes).
	var res: Dictionary = GameState.try_enhance(eq)
	if not res["ok"]:
		overlay.queue_free()
		return
	var msg := ""
	var color := Color.WHITE
	if res["success"]:
		color = Color(0.6, 1, 0.6)
		msg = "성공!\n+%d → +%d" % [before, eq.level]
		Audio.play("enhance_success")
	else:
		color = Color(1, 0.6, 0.6)
		msg = "실패...\n-%sG" % _comma(int(res["cost"]))
		Audio.play("enhance_fail")
	big.text = msg
	big.add_theme_color_override("font_color", color)

	var ok := Button.new()
	ok.text = "확인"
	col.add_child(ok)
	ok.grab_focus()
	await ok.pressed
	overlay.queue_free()
	_flash(msg.replace("\n", "  "), color)

# ---------------------------------------------------------------------------
# Craft tab: per-type rows — a +11 (or higher) shop piece + Whetstone crafts the
# 중급 (internally supreme) version of the same part. Helmet excluded (raid drop).
# ---------------------------------------------------------------------------
func _build_craft() -> void:
	# Frameless column like the Enhance detail (the ornate card texture is thicker
	# than its declared margins and collides with text).
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 5)
	col.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_child(col)

	var title := Label.new()
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.text = "장비 제작"
	col.add_child(title)

	var mats := _cell_label("%s  %d개" % [GameConfig.MATERIAL_LABEL, GameState.craft_mats])
	mats.add_theme_font_size_override("font_size", 11)
	mats.add_theme_color_override("font_color", Color(0.5, 0.38, 0.3))
	col.add_child(mats)

	for type in GameConfig.SHOP_TYPES:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		col.add_child(row)

		var icon := TextureRect.new()
		icon.texture = load(GameConfig.type_grade_icon_path(type, GameConfig.GRADE_SUPREME))
		icon.custom_minimum_size = Vector2(24, 24)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(icon)

		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.add_theme_constant_override("separation", 0)
		row.add_child(info)
		var name_lbl := Label.new()
		name_lbl.text = GameConfig.type_grade_name(type, GameConfig.GRADE_SUPREME)
		name_lbl.add_theme_font_size_override("font_size", 11)
		info.add_child(name_lbl)
		# Recipe stays at the Galmuri-native 11px (10px scales the Korean bitmap
		# font non-integer and smears it); the type is implied by the row icon.
		var recipe := Label.new()
		recipe.text = "+%d 이상 + %s %d개" % [
			GameConfig.CRAFT_REQ_LEVEL, GameConfig.MATERIAL_LABEL, GameConfig.CRAFT_MAT_COST]
		recipe.add_theme_color_override("font_color", Color(0.5, 0.38, 0.3))
		info.add_child(recipe)

		var btn := Button.new()
		btn.text = "제작"
		btn.add_theme_font_size_override("font_size", 11)
		btn.disabled = not GameState.can_craft(type)
		btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		btn.pressed.connect(_on_craft.bind(type))
		row.add_child(btn)

func _on_craft(type: String) -> void:
	var res: Dictionary = GameState.craft_supreme(type)
	if res["ok"]:
		Audio.play("enhance_success")
		_flash("%s 제작 완료!" % GameConfig.type_grade_name(type, GameConfig.GRADE_SUPREME),
			Color(1, 0.85, 0.4))
	else:
		Audio.play("lose")
		var msg := "%s이 부족합니다" % GameConfig.MATERIAL_LABEL if res["reason"] == "no_material" \
			else "%s +%d 이상이 필요합니다" % [GameConfig.type_label(type), GameConfig.CRAFT_REQ_LEVEL]
		_flash(msg, Color(1, 0.6, 0.6))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
func _cell_label(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l

## Buy row header: just the equipment type icon (mid-grade representative). The
## sprites are distinct enough to glance-read each row, and dropping the text
## label keeps the fixed column narrow on the portrait modal. Tooltip names it.
func _type_cell(type: String) -> Control:
	var icon := TextureRect.new()
	icon.texture = load(GameConfig.type_icon_path(type))
	icon.tooltip_text = GameConfig.type_label(type)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return icon

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
