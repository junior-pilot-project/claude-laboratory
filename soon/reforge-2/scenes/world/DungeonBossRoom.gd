extends Node2D
## 던전 보스방 (던전 3 너머의 석실). Sibling of BossArena.gd: the boss respawns
## per visit, but here the kill SETTLES THE RUN — the satchel banks with the
## clear bonus the moment the boss dies, and the post-kill gold/whetstone
## pickups land after run_active is already false, so they grant straight to
## the real wallet (no loss risk). A hidden return exit then leads to town.

const BOSS := preload("res://scenes/actors/Boss.tscn")
const COIN_TEX := preload("res://assets/items/coin.png")
const MAT_TEX := preload("res://assets/items/material.png")

const MAP_W: int = 672
const MAP_H: int = 672
const BOSS_POS := Vector2(336, 260)
# Pale-blue palette shift so the dungeon boss reads distinct from the forest one.
const BOSS_TINT := Color(0.75, 0.8, 1.0)

const GOLD_PICKUPS: int = 5
const MAT_MIN: int = 2
const MAT_MAX: int = 3

@onready var _monsters: Node2D = $Monsters
@onready var _banner: Label = $Overlay/Banner

func _ready() -> void:
	$ExitSouth/Interact.interacted.connect(_go_back)
	$ReturnExit/Interact.interacted.connect(_go_town)
	$ReturnExit/Interact.set_active(false)  # revealed on boss kill
	_banner.visible = false
	SceneManager.setup_camera($Player/Camera2D, MAP_W, MAP_H, 0.7)
	var boss := BOSS.instantiate()
	_monsters.add_child(boss)
	boss.position = BOSS_POS
	boss.modulate = BOSS_TINT
	boss.monsters_parent = _monsters
	boss.died.connect(_on_boss_died.bind(boss))

func _go_back() -> void:
	SceneManager.goto(SceneManager.DUNGEON3, "from_north")

func _go_town() -> void:
	SceneManager.goto(SceneManager.TOWN, "from_dungeon")

func _on_boss_died(boss: Node2D) -> void:
	_banner.text = "던전 정복!"
	_banner.visible = true
	var pos: Vector2 = boss.global_position
	var gold_total: int = GameConfig.monster_gold(5) * GameConfig.DUNGEON_BOSS_GOLD_MULT
	var share: int = int(gold_total / float(GOLD_PICKUPS))
	for i in GOLD_PICKUPS:
		_spawn_pickup(COIN_TEX, {"gold": share, "material": false},
			pos + Vector2(randf_range(-20, 20), randf_range(-10, 16)))
	for i in randi_range(MAT_MIN, MAT_MAX):
		_spawn_pickup(MAT_TEX, {"gold": 0, "material": true},
			pos + Vector2(randf_range(-24, 24), randf_range(6, 20)))
	# Settle the run NOW (satchel + clear bonus), before any pickup is collected.
	GameState.end_dungeon_run("boss")
	$ReturnExit/Interact.set_active(true)

# ---------------------------------------------------------------------------
# Drop pickups (same flow as the hunting grounds)
# ---------------------------------------------------------------------------
func _spawn_pickup(icon: Texture2D, payload: Dictionary, pos: Vector2) -> void:
	var p := DropPickup.new()
	add_child(p)
	p.global_position = pos
	p.setup(icon, payload, $Player)
	p.collected.connect(_on_drop_collected)

func _on_drop_collected(drop: Dictionary) -> void:
	GameState.grant_monster_drop(drop)
	var player: Node2D = $Player
	if int(drop["gold"]) > 0:
		_floating_text(player.global_position + Vector2(0, -30),
			"+%s G" % _comma(int(drop["gold"])), Color(1, 0.95, 0.5))
	if drop["material"]:
		_floating_text(player.global_position + Vector2(0, -42),
			"+%s!" % GameConfig.MATERIAL_LABEL, Color(0.8, 0.6, 1))

func _floating_text(world_pos: Vector2, text: String, color: Color) -> void:
	var l := Label.new()
	l.text = text
	l.global_position = world_pos + Vector2(-12, 0)
	l.add_theme_font_size_override("font_size", 9)
	l.add_theme_color_override("font_color", color)
	l.z_index = 50
	l.visibility_layer = 2  # actor layer: culled from the minimap render
	add_child(l)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position:y", world_pos.y - 22.0, 0.7)
	tw.tween_property(l, "modulate:a", 0.0, 0.7)
	tw.chain().tween_callback(l.queue_free)

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
