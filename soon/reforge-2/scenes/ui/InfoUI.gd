extends Control
## 내 정보(캐릭터) 화면: 상단에 착용한 장비 목록(부위별), 하단에 종합 능력치
## (체력/공격력/방어력/이동속도/대시거리)를 보여준다. 읽기 전용 — 장착/강화는
## 다른 화면에서 한다.

signal closed

# Shown top-to-bottom; weapon first, then defensive pieces.
const PARTS: Array[String] = ["sword", "helmet", "armor", "shield", "boots"]

# Player movement constants (read off the Player script for the derived stats).
const PLAYER := preload("res://scenes/actors/Player.gd")

@onready var _equip: VBoxContainer = %Equip
@onready var _stats: VBoxContainer = %StatsCol

func _ready() -> void:
	%Close.pressed.connect(_close)
	GameState.inventory_changed.connect(_rebuild)  # equipping changes the readout
	_rebuild()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_close()

func _close() -> void:
	closed.emit()

func _rebuild() -> void:
	_clear(_equip)
	_clear(_stats)
	for part in PARTS:
		_equip.add_child(_equip_row(part))
	_stats.add_child(_stat_line("체력", GameState.max_hp()))
	_stats.add_child(_stat_line("공격력", GameState.weapon_power()))
	_stats.add_child(_stat_line("방어력", GameState.defense_power()))
	# Derived movement stats: boots enhancement raises speed; dash range is the
	# helmet's future stat (multiplier 1.0 until raids land).
	var mult: float = GameState.move_speed_mult()
	var spd: int = int(round(PLAYER.SPEED * mult))
	var pct: int = int(round((mult - 1.0) * 100.0))
	_stats.add_child(_stat_line_text("이동속도",
		("%d (+%d%%)" % [spd, pct]) if pct > 0 else str(spd)))
	_stats.add_child(_stat_line_text("대시거리",
		str(int(round(PLAYER.DASH_SPEED * PLAYER.DASH_DURATION * GameState.dash_mult())))))

## One equipped-slot row: part icon + the worn item's name (with stat in parentheses),
## or the part silhouette + "None" when empty. Single compact line; the label clips
## rather than grows so it can never widen the modal past the screen.
func _equip_row(part: String) -> HBoxContainer:
	var eq: Equipment = GameState.equipped.get(part)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)

	var ic := TextureRect.new()
	ic.custom_minimum_size = Vector2(18, 18)
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE  # honor the 18px min (textures are 32px)
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if eq != null:
		ic.texture = load(GameConfig.type_grade_icon_path(eq.type, eq.grade))
	else:
		ic.texture = load("res://assets/ui/slots/slot_%s.png" % part)
		ic.modulate = Color(1, 1, 1, 0.55)
	row.add_child(ic)

	var name_lbl := Label.new()
	name_lbl.clip_text = true
	name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	if eq != null:
		name_lbl.text = eq.display_name()
	else:
		name_lbl.text = "%s: 없음" % GameConfig.type_label(part)
		name_lbl.add_theme_color_override("font_color", Color(0.5, 0.42, 0.36))
	row.add_child(name_lbl)
	return row

## One centered stat line: right-aligned name + left-aligned gold value, forming a
## neat aligned column that stays narrow and centered — clear of the panel's corner
## studs no matter the value's length.
func _stat_line(name: String, value: int) -> HBoxContainer:
	return _stat_line_text(name, _comma(value))

## Text-valued variant for derived stats like "126 (+5%)".
func _stat_line_text(name: String, value: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)

	var l := Label.new()
	l.text = name
	l.custom_minimum_size = Vector2(40, 0)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	l.add_theme_color_override("font_color", Color(0.45, 0.34, 0.28))
	row.add_child(l)

	var v := Label.new()
	v.text = value
	v.custom_minimum_size = Vector2(60, 0)
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	v.add_theme_color_override("font_color", Color(0.85, 0.62, 0.25))
	row.add_child(v)
	return row

func _clear(node: Node) -> void:
	for c in node.get_children():
		node.remove_child(c)
		c.queue_free()

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
