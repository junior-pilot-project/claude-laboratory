extends Control
## Always-on HUD. Top-left: player HP bar. Top-right: a hamburger button that
## toggles a small menu holding the Inventory button. Gold is shown in the
## inventory, not here. Subscribes to GameState signals and shows a clear banner
## when the goal is reached.

@onready var _hp_bar: TextureProgressBar = $Bar/Rows/Row1/HPBar
@onready var _hp_text: Label = $Bar/Rows/Row1/HPBar/HPText
@onready var _burger: Button = %Burger
@onready var _menu: PanelContainer = %Menu
@onready var _inv_button: Button = %InvButton
@onready var _info_button: Button = %InfoButton
@onready var _settings_button: Button = %SettingsButton
@onready var _banner: Label = $ClearBanner

# Dungeon-run satchel chip (built programmatically under the HP rows): shows the
# loot riding on the current run; hidden outside a run.
var _satchel: Label = null

func _ready() -> void:
	GameState.hp_changed.connect(_on_hp_changed)
	GameState.goal_reached.connect(_on_goal_reached)
	_burger.pressed.connect(_toggle_menu)
	_inv_button.pressed.connect(_on_inventory)
	_info_button.pressed.connect(_on_info)
	_settings_button.pressed.connect(_on_settings)
	_on_hp_changed(GameState.hp, GameState.max_hp())
	_menu.visible = false
	_banner.visible = false
	_build_satchel()
	GameState.run_changed.connect(_on_run_changed)
	GameState.run_ended.connect(func(_g, _m, _r): _satchel.visible = false)

func _build_satchel() -> void:
	_satchel = Label.new()
	_satchel.visible = false
	_satchel.add_theme_font_size_override("font_size", 11)
	_satchel.add_theme_color_override("font_color", Color(1, 0.92, 0.55))
	_satchel.add_theme_color_override("font_outline_color", Color(0.2, 0.1, 0.05))
	_satchel.add_theme_constant_override("outline_size", 3)
	$Bar/Rows.add_child(_satchel)

func _on_run_changed(run_gold: int, run_mats: int) -> void:
	_satchel.visible = GameState.run_active
	_satchel.text = "가방 %s G · %s %d" % [
		_comma(run_gold), GameConfig.MATERIAL_LABEL, run_mats]

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

## Live HP: monsters deal contact damage in the hunting ground; potions and
## leaving the hunt restore it.
func _on_hp_changed(hp: int, max_hp: int) -> void:
	_hp_bar.max_value = max_hp
	_hp_bar.value = hp
	_hp_text.text = str(hp)

func _on_goal_reached() -> void:
	_banner.visible = true

# ---------------------------------------------------------------------------
# Hamburger menu
# ---------------------------------------------------------------------------
func _toggle_menu() -> void:
	_menu.visible = not _menu.visible
	Audio.play("click")

func _on_inventory() -> void:
	_menu.visible = false
	var root: Node = get_tree().get_first_node_in_group("ui_root")
	if root and root.has_method("open_inventory"):
		root.open_inventory()

func _on_info() -> void:
	_menu.visible = false
	var root: Node = get_tree().get_first_node_in_group("ui_root")
	if root and root.has_method("open_info"):
		root.open_info()

func _on_settings() -> void:
	_menu.visible = false
	var root: Node = get_tree().get_first_node_in_group("ui_root")
	if root and root.has_method("open_settings"):
		root.open_settings()

## Called by Main: hide the hamburger + menu while a popup is open (and restore
## them afterwards). Collapses the menu so it never lingers open behind a popup.
func set_menu_visible(v: bool) -> void:
	_burger.visible = v
	if not v:
		_menu.visible = false
