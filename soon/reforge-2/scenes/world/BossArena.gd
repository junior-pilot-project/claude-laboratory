extends Node2D
## 보스의 둥지 (사냥터3 북쪽 끝). 입장할 때마다 보스(사이클롭스)가 살아 있고,
## 처치하면 대량 골드 + 숫돌 확정 보상이 픽업으로 떨어진다. 같은 방문 안에서는
## 다시 살아나지 않으며, 재입장(씬 재로드) 시 리스폰된다.

const BOSS := preload("res://scenes/actors/Boss.tscn")
const COIN_TEX := preload("res://assets/items/coin.png")
const MAT_TEX := preload("res://assets/items/material.png")

const MAP_W: int = 672
const MAP_H: int = 672
const BOSS_POS := Vector2(336, 260)

# Reward: a big gold pile split across several pickups + guaranteed whetstones.
const GOLD_MULT: int = 10        # x monster_gold(5)
const GOLD_PICKUPS: int = 5
const MAT_MIN: int = 2
const MAT_MAX: int = 3

@onready var _monsters: Node2D = $Monsters
@onready var _banner: Label = $Overlay/Banner

func _ready() -> void:
	$ExitSouth/Interact.interacted.connect(_go_back)
	_banner.visible = false
	SceneManager.setup_camera($Player/Camera2D, MAP_W, MAP_H, 0.7)
	var boss := BOSS.instantiate()
	_monsters.add_child(boss)
	boss.position = BOSS_POS
	boss.monsters_parent = _monsters
	boss.died.connect(_on_boss_died.bind(boss))

func _go_back() -> void:
	SceneManager.goto(SceneManager.HUNT3, "from_north")

func _on_boss_died(boss: Node2D) -> void:
	_banner.text = "보스 처치!"
	_banner.visible = true
	var pos: Vector2 = boss.global_position
	var gold_total: int = GameConfig.monster_gold(5) * GOLD_MULT
	var share: int = int(gold_total / float(GOLD_PICKUPS))
	for i in GOLD_PICKUPS:
		_spawn_pickup(COIN_TEX, {"gold": share, "material": false},
			pos + Vector2(randf_range(-20, 20), randf_range(-10, 16)))
	for i in randi_range(MAT_MIN, MAT_MAX):
		_spawn_pickup(MAT_TEX, {"gold": 0, "material": true},
			pos + Vector2(randf_range(-24, 24), randf_range(6, 20)))

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
