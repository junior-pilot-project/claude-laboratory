extends BottomSheet
## 인벤토리: 하단 시트(화면 아래 60%) + 카테고리 탭(Gear/Use/Mats/Etc). 위쪽에는
## 게임 화면이 그대로 보이고, 그 영역을 탭하면 닫힌다(BottomSheet 베이스 담당).
## Gear 탭 = 장비 16칸 그리드, Use 탭 = 물약, Mats 탭 = 숫돌; Etc는 아직 빈 탭.
## 어떤 셀이든 누르면 상세 팝업(장비: 장착/해제·삭제, 물약: 장착/해제, 숫돌:
## 설명)이 뜬다 — 장착은 이 화면에서만 한다.

const COLS: int = 4
const GRID_SEP: int = 6
const SLOT_TEX: Texture2D = preload("res://assets/ui/pack/slot_empty.png")

@onready var _content: VBoxContainer = %Content
@onready var _result: Label = %Result
@onready var _gold: Label = %Gold

var _tab: String = "gear"
# True while the per-item action overlay is up, so close requests wait for it.
var _overlay_open: bool = false

func _ready() -> void:
	super()
	%Close.pressed.connect(request_close)
	%TabGear.pressed.connect(func(): _switch("gear"))
	%TabUse.pressed.connect(func(): _switch("use"))
	%TabMats.pressed.connect(func(): _switch("mats"))
	%TabEtc.pressed.connect(func(): _switch("etc"))
	# Gold is shown here (header), not on the always-on HUD — keep it live.
	GameState.gold_changed.connect(_on_gold_changed)
	_on_gold_changed(GameState.gold)
	# The whetstone count shows as a slot in the grid, so rebuild when it changes.
	GameState.materials_changed.connect(func(_m): _rebuild())
	GameState.inventory_changed.connect(_rebuild)
	# Potions live in the 소비 tab (counts + equipped tint), so track them too.
	GameState.potions_changed.connect(_rebuild)
	# The square-slot grid sizes its cells from the scroll viewport width, which is
	# only known after the first layout pass — rebuild once it (and rotations) settle.
	%Scroll.resized.connect(_rebuild)
	_switch("gear")

func _can_close() -> bool:
	return not _overlay_open

func _on_gold_changed(gold: int) -> void:
	_gold.text = "%s G" % _comma(gold)

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

func _switch(tab: String) -> void:
	_tab = tab
	%TabGear.button_pressed = tab == "gear"
	%TabUse.button_pressed = tab == "use"
	%TabMats.button_pressed = tab == "mats"
	%TabEtc.button_pressed = tab == "etc"
	_flash("")
	_rebuild()

func _rebuild() -> void:
	_clear(_content)
	match _tab:
		"gear": _build_gear()
		"use": _build_use()
		"mats": _build_mats()
		_: _build_empty_tab()

func _build_gear() -> void:
	var cell: int = _cell_size()
	var grid := _slot_grid()
	for i in GameConfig.INVENTORY_MAX:
		if i < GameState.inventory.size():
			grid.add_child(_gear_cell(GameState.inventory[i], cell))
		else:
			grid.add_child(_empty_cell(cell))

## Use tab: owned potions as slot cells (icon + count badge, gold tint = equipped).
## Tapping a potion equips it for the hunt quick-slot (tap again to unequip).
func _build_use() -> void:
	var cell: int = _cell_size()
	var grid := _slot_grid()
	var shown: int = 0
	for id in GameConfig.POTION_ORDER:
		if GameState.potion_count(id) > 0:
			grid.add_child(_potion_cell(id, cell))
			shown += 1
	for i in range(shown, GameConfig.INVENTORY_MAX):
		grid.add_child(_empty_cell(cell))

## Materials tab: same slot grid as gear; the whetstone (a stackable consumable
## that never takes an equipment slot) sits in the first slot, the rest stay empty.
func _build_mats() -> void:
	var cell: int = _cell_size()
	var grid := _slot_grid()
	if GameState.craft_mats > 0:
		grid.add_child(_material_cell(cell))
	for i in range(1 if GameState.craft_mats > 0 else 0, GameConfig.INVENTORY_MAX):
		grid.add_child(_empty_cell(cell))

## Use/Etc: no such items exist in the game yet — an all-empty slot grid, so every
## tab reads as the same inventory panel.
func _build_empty_tab() -> void:
	var cell: int = _cell_size()
	var grid := _slot_grid()
	for i in GameConfig.INVENTORY_MAX:
		grid.add_child(_empty_cell(cell))

## The shared slot grid: fills the scroll width exactly (cells share it equally, so
## it can never overflow the panel); each cell's min-height is set to that shared
## width so the slots come out square — a filled equipment-panel grid.
func _slot_grid() -> GridContainer:
	var grid := GridContainer.new()
	grid.columns = COLS
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", GRID_SEP)
	grid.add_theme_constant_override("v_separation", GRID_SEP)
	_content.add_child(grid)
	return grid

## A potion slot: tappable cell with the potion icon (gold-tinted while equipped)
## and the owned count along the bottom edge. Tap = detail overlay with the
## equip/unequip button (same UX as gear cells).
func _potion_cell(id: String, cell: int) -> Button:
	var btn := _slot_button(cell)
	var cfg: Dictionary = GameConfig.POTIONS[id]
	btn.tooltip_text = "%s\n%d%% 회복" % [cfg["label"], int(round(float(cfg["heal_pct"]) * 100.0))]

	var icon := TextureRect.new()
	icon.texture = load(GameConfig.potion_icon_path(id))
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.set_anchors_preset(Control.PRESET_FULL_RECT)
	icon.offset_left = 5; icon.offset_top = 4; icon.offset_right = -5; icon.offset_bottom = -8
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if GameState.equipped_potion == id:
		icon.modulate = Color(1.0, 0.95, 0.6)  # gold tint marks the equipped potion
	btn.add_child(icon)

	var badge := Label.new()
	badge.text = "%d%s" % [GameState.potion_count(id), ("E" if GameState.equipped_potion == id else "")]
	badge.add_theme_font_size_override("font_size", 10)
	badge.add_theme_color_override("font_color", Color(0.98, 0.94, 0.86))
	badge.add_theme_color_override("font_outline_color", Color(0.18, 0.09, 0.05))
	badge.add_theme_constant_override("outline_size", 3)
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	badge.set_anchors_preset(Control.PRESET_FULL_RECT)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	btn.add_child(badge)

	btn.pressed.connect(_on_potion_cell.bind(id))
	return btn

## The whetstone slot: slot frame + centered icon + a count badge along the
## bottom edge. Tap = detail overlay (info only — it is consumed by the craft
## tab over in the shop, not from here).
func _material_cell(cell: int) -> Control:
	var root := _slot_button(cell)
	root.tooltip_text = "%s\n장비 제작 재료." % GameConfig.MATERIAL_LABEL
	root.pressed.connect(_on_material_cell)

	var icon := TextureRect.new()
	icon.texture = load(GameConfig.material_icon_path())
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.set_anchors_preset(Control.PRESET_FULL_RECT)
	icon.offset_left = 5; icon.offset_top = 3; icon.offset_right = -5; icon.offset_bottom = -9
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(icon)

	var badge := Label.new()
	# Count only — the latin "x" renders like π in the Korean fallback font.
	badge.text = "%d" % GameState.craft_mats
	badge.add_theme_font_size_override("font_size", 10)
	badge.add_theme_color_override("font_color", Color(0.98, 0.94, 0.86))
	badge.add_theme_color_override("font_outline_color", Color(0.18, 0.09, 0.05))
	badge.add_theme_constant_override("outline_size", 3)
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	badge.set_anchors_preset(Control.PRESET_FULL_RECT)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(badge)
	return root

## Square cell edge = the per-column share of the scroll viewport width. Falls back
## to a viewport-based estimate on the very first build (before layout).
func _cell_size() -> int:
	var avail: float = %Scroll.size.x
	if avail < 1.0:
		avail = get_viewport_rect().size.x - 40.0
	var cell := int((avail - GRID_SEP * (COLS - 1)) / COLS)
	return clampi(cell, 28, 80)

# ---------------------------------------------------------------------------
# Cells
# ---------------------------------------------------------------------------
## A square slot button: slot.png background + centered item icon + a +level badge.
func _gear_cell(eq: Equipment, cell: int) -> Button:
	var btn := _slot_button(cell)
	btn.tooltip_text = "%s\n%s" % [eq.display_name(), GameConfig.stat_text(eq.type, eq.grade, eq.level)]

	var icon := TextureRect.new()
	icon.texture = load(GameConfig.type_grade_icon_path(eq.type, eq.grade))
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.set_anchors_preset(Control.PRESET_FULL_RECT)
	icon.offset_left = 5; icon.offset_top = 4; icon.offset_right = -5; icon.offset_bottom = -8
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if GameState.is_equipped(eq):
		icon.modulate = Color(1.0, 0.95, 0.6)  # gold tint marks the worn piece
	btn.add_child(icon)

	# level (+E) badge pinned to the bottom edge; ignores mouse so the cell stays tappable.
	var badge := Label.new()
	badge.text = "+%d%s" % [eq.level, ("E" if GameState.is_equipped(eq) else "")]
	badge.add_theme_font_size_override("font_size", 10)
	badge.add_theme_color_override("font_color", Color(0.98, 0.94, 0.86))
	badge.add_theme_color_override("font_outline_color", Color(0.18, 0.09, 0.05))
	badge.add_theme_constant_override("outline_size", 3)
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	badge.set_anchors_preset(Control.PRESET_FULL_RECT)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	btn.add_child(badge)

	btn.pressed.connect(_on_cell.bind(eq))
	return btn

func _empty_cell(cell: int) -> Button:
	var btn := _slot_button(cell)
	btn.disabled = true
	return btn

## Square button skinned with the slot texture on every state (so it reads as a
## static slot frame, with the press feedback coming from the button modulate).
func _slot_button(cell: int) -> Button:
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(0, cell)
	btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn.add_theme_stylebox_override("normal", _slot_sb())
	btn.add_theme_stylebox_override("hover", _slot_sb())
	btn.add_theme_stylebox_override("pressed", _slot_sb())
	btn.add_theme_stylebox_override("disabled", _slot_sb())
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	return btn

func _slot_sb() -> StyleBoxTexture:
	var sb := StyleBoxTexture.new()
	sb.texture = SLOT_TEX
	for m in ["left", "top", "right", "bottom"]:
		sb.set("texture_margin_" + m, 8.0)
	return sb

# ---------------------------------------------------------------------------
# Per-item detail overlay (shared by gear / potions / the whetstone)
# ---------------------------------------------------------------------------
## Builds the dim + centered card shell. Returns [overlay, content_col]; the
## caller fills the column and closes via _close_overlay(overlay).
func _open_overlay() -> Array:
	_overlay_open = true
	Audio.play("click")

	var overlay := Control.new()
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(overlay)

	var dim := ColorRect.new()
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0, 0, 0, 0.6)
	overlay.add_child(dim)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(center)

	var card := PanelContainer.new()
	center.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	card.add_child(col)
	return [overlay, col]

func _on_cell(eq: Equipment) -> void:
	if _overlay_open or not GameState.inventory.has(eq):
		return
	var parts := _open_overlay()
	_fill_action_menu(parts[1], parts[0], eq)

## Potion detail: name / heal% / owned count + equip-or-unequip toggle.
func _on_potion_cell(id: String) -> void:
	if _overlay_open:
		return
	var parts := _open_overlay()
	var overlay: Control = parts[0]
	var col: VBoxContainer = parts[1]
	var cfg: Dictionary = GameConfig.POTIONS[id]

	col.add_child(_center_label(String(cfg["label"])))
	col.add_child(_center_label("최대 체력의 %d%% 회복" % int(round(float(cfg["heal_pct"]) * 100.0))))
	col.add_child(_center_label("보유  %d개" % GameState.potion_count(id)))

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 4)
	col.add_child(row)

	var eqp := Button.new()
	eqp.text = "해제" if GameState.equipped_potion == id else "장착"
	eqp.pressed.connect(func() -> void:
		var now := GameState.toggle_equip_potion(id)
		Audio.play("click")
		_flash("장착했습니다" if now else "해제했습니다", Color(0.8, 0.9, 1))
		_close_overlay(overlay))
	row.add_child(eqp)

	var cancel := Button.new()
	cancel.text = "취소"
	cancel.pressed.connect(func() -> void: _close_overlay(overlay))
	row.add_child(cancel)

## Whetstone detail: name / role / owned count — info only.
func _on_material_cell() -> void:
	if _overlay_open:
		return
	var parts := _open_overlay()
	var overlay: Control = parts[0]
	var col: VBoxContainer = parts[1]

	col.add_child(_center_label(GameConfig.MATERIAL_LABEL))
	col.add_child(_center_label("장비 제작 재료 (대장간 제작 탭에서 사용)"))
	col.add_child(_center_label("보유  %d개" % GameState.craft_mats))

	var ok := Button.new()
	ok.text = "확인"
	ok.pressed.connect(func() -> void: _close_overlay(overlay))
	col.add_child(ok)

func _close_overlay(overlay: Control) -> void:
	overlay.queue_free()
	_overlay_open = false

func _fill_action_menu(col: VBoxContainer, overlay: Control, eq: Equipment) -> void:
	_clear(col)
	col.add_child(_center_label(eq.display_name()))
	col.add_child(_center_label(GameConfig.stat_text(eq.type, eq.grade, eq.level)))

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 4)
	col.add_child(row)

	var eqp := Button.new()
	eqp.text = "해제" if GameState.is_equipped(eq) else "장착"
	eqp.pressed.connect(func() -> void:
		var now := GameState.toggle_equip(eq)
		Audio.play("click")
		_flash("장착했습니다" if now else "해제했습니다", Color(0.8, 0.9, 1))
		_close_overlay(overlay))
	row.add_child(eqp)

	# Worn gear can't be deleted (unequip first) — hide Delete entirely while equipped.
	if not GameState.is_equipped(eq):
		var del := Button.new()
		del.text = "삭제"
		del.pressed.connect(func() -> void: _fill_confirm(col, overlay, eq))
		row.add_child(del)

	var cancel := Button.new()
	cancel.text = "취소"
	cancel.pressed.connect(func() -> void: _close_overlay(overlay))
	col.add_child(cancel)

func _fill_confirm(col: VBoxContainer, overlay: Control, eq: Equipment) -> void:
	_clear(col)
	col.add_child(_center_label("이 아이템을 삭제할까요?"))
	col.add_child(_center_label(eq.display_name()))

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 4)
	col.add_child(row)

	var yes := Button.new()
	yes.text = "삭제"
	yes.add_theme_color_override("font_color", Color(0.6, 0.2, 0.15))
	yes.pressed.connect(func() -> void:
		var name := eq.display_name()
		GameState.delete_equipment(eq)
		Audio.play("lose")
		_flash("삭제됨: %s" % name, Color(1, 0.7, 0.7))
		_close_overlay(overlay))
	row.add_child(yes)

	var no := Button.new()
	no.text = "취소"
	no.pressed.connect(func() -> void: _fill_action_menu(col, overlay, eq))
	row.add_child(no)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
func _clear(node: Node) -> void:
	for c in node.get_children():
		node.remove_child(c)
		c.queue_free()

func _center_label(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l

func _flash(text: String, color: Color = Color.WHITE) -> void:
	_result.text = text
	_result.add_theme_color_override("font_color", color)
