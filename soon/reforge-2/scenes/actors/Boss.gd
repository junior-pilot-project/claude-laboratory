extends CharacterBody2D
## 보스: 사이클롭스 (보스 아레나 전용). Monster.gd의 시트/HP바/피격 패턴을
## 따르되 전용 상태기계로 움직인다:
##   CHASE      플레이어를 천천히 추격 (접촉 데미지)
##   TG_CHARGE  돌진 예고 — 빨간 돌진 경로 표시 (0.6s)
##   CHARGING   예고 방향으로 고속 돌진 (접촉 데미지 2배, 벽에 부딪히면 정지)
##   TG_SLAM    장판 예고 — 플레이어 위치에 빨간 원 (0.8s)
##              -> 원 안에 있으면 큰 피해 (대시 무적으로 회피 가능)
##   RECOVER    기믹 후 잠깐 휴식
## 체력 50% 이하부터는 주기적으로 슬라임을 소환한다 (동시 4마리 캡).
## 보스는 피격 모션으로 멈추지 않는다(스턴락 방지) — 플래시만 받는다.

signal died

const SHEET_IDLE: Texture2D = preload("res://assets/monsters/cyclops_idle.png")
const SHEET_HIT: Texture2D = preload("res://assets/monsters/cyclops_hit.png")
const SHEET_DIE: Texture2D = preload("res://assets/monsters/cyclops_die.png")
const MONSTER := preload("res://scenes/actors/Monster.tscn")

const FW := 32
const FH := 64
const BOSS_SCALE := 2.2
const STAGE := 5                  # damage/gold tier the boss is balanced around
const HP_MULT := 8                # HP = monster_hp(STAGE) * this

const WALK_SPEED := 45.0
const CHARGE_SPEED := 300.0
const CHARGE_RANGE := 400.0       # telegraph line length
const CHARGE_TIME_MAX := 1.5      # failsafe stop if no wall is hit
const CHARGE_TELEGRAPH := 0.6
const SLAM_TELEGRAPH := 0.8
const SLAM_RADIUS := 52.0
const SLAM_DMG_MULT := 1.5
const RECOVER_TIME := 1.0
const GIMMICK_CD := 3.5           # seconds of CHASE between gimmicks
const SUMMON_INTERVAL := 8.0
const MAX_ADDS := 4

const HP_BAR_W := 64.0
const HP_COLOR_FULL := Color(0.35, 0.85, 0.3)
const HP_COLOR_HALF := Color(0.95, 0.8, 0.2)
const HP_COLOR_LOW := Color(0.9, 0.2, 0.15)

enum S { CHASE, TG_CHARGE, CHARGING, TG_SLAM, RECOVER }

# Where summoned slimes go (the arena's $Monsters, so minimap masking applies).
var monsters_parent: Node2D = null

var _hp: int = 1
var _max_hp: int = 1
var _dead: bool = false
var _state: int = S.CHASE
var _t: float = 0.0               # time spent in the current state
var _gimmick_cd: float = GIMMICK_CD
var _next_is_charge: bool = true  # alternate 돌진/장판
var _dir: Vector2 = Vector2.DOWN
var _slam_pos: Vector2 = Vector2.ZERO
var _summon_cd: float = SUMMON_INTERVAL
var _telegraph: Node2D = null

@onready var _anim: AnimatedSprite2D = $Anim
@onready var _col: CollisionShape2D = $CollisionShape2D
@onready var _hurtbox: Area2D = $Hurtbox
@onready var _hurt_col: CollisionShape2D = $Hurtbox/CollisionShape2D
@onready var _contact: Area2D = $ContactArea
@onready var _contact_col: CollisionShape2D = $ContactArea/CollisionShape2D
@onready var _hp_bar: Node2D = $HPBar
@onready var _hp_fill: ColorRect = $HPBar/Fill
@onready var _hp_bg: ColorRect = $HPBar/Bg

func _ready() -> void:
	_hp = GameConfig.monster_hp(STAGE) * HP_MULT
	_max_hp = _hp

	var sf := SpriteFrames.new()
	sf.remove_animation("default")
	_add_anim(sf, "idle", SHEET_IDLE, 4, 4, 8.0, true)
	_add_anim(sf, "hit", SHEET_HIT, 2, 4, 16.0, false)
	_add_anim(sf, "die", SHEET_DIE, 1, 4, 10.0, false)
	_anim.sprite_frames = sf
	_anim.scale = Vector2(BOSS_SCALE, BOSS_SCALE)
	_anim.play("idle")
	_anim.animation_finished.connect(_on_anim_finished)

	var hurt := RectangleShape2D.new()
	hurt.size = Vector2(FW * 0.6, FH * 0.5) * BOSS_SCALE
	_hurt_col.shape = hurt
	var body := RectangleShape2D.new()
	body.size = Vector2(FW * 0.5, FH * 0.3) * BOSS_SCALE
	_col.shape = body
	var contact := RectangleShape2D.new()
	contact.size = Vector2(FW * 0.65, FH * 0.45) * BOSS_SCALE
	_contact_col.shape = contact

	var half := HP_BAR_W * 0.5
	_hp_bg.offset_left = -half - 1.0
	_hp_bg.offset_right = half + 1.0
	_hp_fill.offset_left = -half
	_hp_fill.offset_right = half
	_hp_fill.color = HP_COLOR_FULL
	_hp_bar.position.y = -(FH * 0.5 * BOSS_SCALE) - 9.0

func _add_anim(sf: SpriteFrames, name: String, tex: Texture2D,
		cols: int, rows: int, fps: float, loop: bool) -> void:
	sf.add_animation(name)
	sf.set_animation_speed(name, fps)
	sf.set_animation_loop(name, loop)
	for r in rows:
		for c in cols:
			var at := AtlasTexture.new()
			at.atlas = tex
			at.region = Rect2(c * FW, r * FH, FW, FH)
			sf.add_frame(name, at)

func _player() -> Node2D:
	return get_tree().get_first_node_in_group("player")

# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------
func _physics_process(delta: float) -> void:
	if _dead:
		velocity = Vector2.ZERO
		return

	# Contact damage is the boss's basic attack (doubled mid-charge); the
	# player's i-frames rate-limit it.
	var contact_raw: int = GameConfig.monster_damage(STAGE) * (2 if _state == S.CHARGING else 1)
	for body in _contact.get_overlapping_bodies():
		if body.is_in_group("player") and body.has_method("take_contact_damage"):
			body.take_contact_damage(contact_raw)

	_tick_summons(delta)
	_t += delta
	var player := _player()

	match _state:
		S.CHASE:
			if player == null or GameState.hp <= 0 or bool(player.get("input_locked")):
				velocity = Vector2.ZERO
				return
			velocity = (player.position - position).normalized() * WALK_SPEED
			if absf(velocity.x) > 1.0:
				_anim.flip_h = velocity.x < 0.0
			move_and_slide()
			_gimmick_cd -= delta
			if _gimmick_cd <= 0.0:
				if _next_is_charge:
					_enter_tg_charge(player)
				else:
					_enter_tg_slam(player)
				_next_is_charge = not _next_is_charge
		S.TG_CHARGE:
			velocity = Vector2.ZERO
			if _t >= CHARGE_TELEGRAPH:
				_clear_telegraph()
				_enter(S.CHARGING)
		S.CHARGING:
			velocity = _dir * CHARGE_SPEED
			move_and_slide()
			if get_slide_collision_count() > 0 or _t >= CHARGE_TIME_MAX:
				_enter(S.RECOVER)
		S.TG_SLAM:
			velocity = Vector2.ZERO
			if _t >= SLAM_TELEGRAPH:
				_clear_telegraph()
				_resolve_slam(player)
				_enter(S.RECOVER)
		S.RECOVER:
			velocity = Vector2.ZERO
			if _t >= RECOVER_TIME:
				_gimmick_cd = GIMMICK_CD
				_enter(S.CHASE)

func _enter(state: int) -> void:
	_state = state
	_t = 0.0

# --- 돌진 ---------------------------------------------------------------------
func _enter_tg_charge(player: Node2D) -> void:
	_dir = (player.position - position).normalized()
	_anim.flip_h = _dir.x < 0.0
	var line := Line2D.new()
	line.points = PackedVector2Array([Vector2.ZERO, _dir * CHARGE_RANGE])
	line.width = 30.0
	line.default_color = Color(0.95, 0.2, 0.15, 0.3)
	line.z_index = -5                 # under actors, over the ground
	line.visibility_layer = 2         # actor layer: not on the minimap/preview
	add_child(line)
	_telegraph = line
	_pulse(line)
	_enter(S.TG_CHARGE)

# --- 장판 ---------------------------------------------------------------------
func _enter_tg_slam(player: Node2D) -> void:
	_slam_pos = player.global_position
	var circle := Polygon2D.new()
	var pts := PackedVector2Array()
	for i in 24:
		pts.append(Vector2.from_angle(TAU * i / 24.0) * SLAM_RADIUS)
	circle.polygon = pts
	circle.color = Color(0.95, 0.2, 0.15, 0.3)
	circle.z_index = -5
	circle.visibility_layer = 2
	get_parent().add_child(circle)    # world-anchored, not boss-anchored
	circle.global_position = _slam_pos
	_telegraph = circle
	_pulse(circle)
	_enter(S.TG_SLAM)

func _resolve_slam(player: Node2D) -> void:
	if player == null:
		return
	if player.global_position.distance_to(_slam_pos) <= SLAM_RADIUS \
			and player.has_method("take_contact_damage"):
		player.take_contact_damage(int(GameConfig.monster_damage(STAGE) * SLAM_DMG_MULT))

func _pulse(node: CanvasItem) -> void:
	var tw := node.create_tween().set_loops()
	tw.tween_property(node, "modulate:a", 0.45, 0.18)
	tw.tween_property(node, "modulate:a", 1.0, 0.18)

func _clear_telegraph() -> void:
	if _telegraph != null and is_instance_valid(_telegraph):
		_telegraph.queue_free()
	_telegraph = null

# --- 소환 (체력 50% 이하) -------------------------------------------------------
func _tick_summons(delta: float) -> void:
	if _hp > _max_hp / 2 or monsters_parent == null:
		return
	_summon_cd -= delta
	if _summon_cd > 0.0:
		return
	_summon_cd = SUMMON_INTERVAL
	var adds: int = 0
	for c in monsters_parent.get_children():
		# Count living summons only (the slam telegraph circle also lives here).
		if c != self and c is CharacterBody2D and not c.is_queued_for_deletion():
			adds += 1
	for i in mini(2, MAX_ADDS - adds):
		var m := MONSTER.instantiate()
		monsters_parent.add_child(m)
		m.position = position + Vector2.from_angle(randf() * TAU) * 56.0
		m.setup(1, "slime")
		m.aggressive = true

# ---------------------------------------------------------------------------
# Damage / death (no hit-anim stun: the boss only flashes, so charges and
# telegraphs can never be interrupted by attack spam)
# ---------------------------------------------------------------------------
func take_damage(dmg: int) -> void:
	if _dead:
		return
	_spawn_damage_number(dmg)
	if dmg > 0:
		_hp -= dmg
		_update_bar()
	if _hp <= 0:
		_die()
		return
	_flash()

func _update_bar() -> void:
	var frac: float = clampf(float(_hp) / float(_max_hp), 0.0, 1.0)
	_hp_fill.offset_right = -HP_BAR_W * 0.5 + HP_BAR_W * frac
	if frac >= 0.5:
		_hp_fill.color = HP_COLOR_HALF.lerp(HP_COLOR_FULL, (frac - 0.5) * 2.0)
	else:
		_hp_fill.color = HP_COLOR_LOW.lerp(HP_COLOR_HALF, frac * 2.0)

func _flash() -> void:
	_anim.modulate = Color(1, 0.5, 0.5)
	var tw := create_tween()
	tw.tween_property(_anim, "modulate", Color.WHITE, 0.15)

func _die() -> void:
	_dead = true
	velocity = Vector2.ZERO
	_clear_telegraph()
	Audio.play("slash")
	died.emit()
	_hp_bar.visible = false
	_col.set_deferred("disabled", true)
	_hurt_col.set_deferred("disabled", true)
	_hurtbox.monitorable = false
	_contact.set_deferred("monitoring", false)
	_contact_col.set_deferred("disabled", true)
	_anim.play("die")   # queue_free on animation_finished

func _on_anim_finished() -> void:
	if _dead and _anim.animation == "die":
		queue_free()

## Brief floating damage number rising from the boss.
func _spawn_damage_number(dmg: int) -> void:
	var l := Label.new()
	l.text = str(dmg)
	l.position = Vector2(-12, -(FH * 0.5 * BOSS_SCALE) - 24.0)
	l.add_theme_font_size_override("font_size", 16)
	l.add_theme_color_override("font_color", Color(1, 0.95, 0.6))
	l.visibility_layer = 2  # actor layer: culled from the minimap render
	add_child(l)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "position:y", l.position.y - 22.0, 0.5)
	tw.tween_property(l, "modulate:a", 0.0, 0.5)
	tw.chain().tween_callback(l.queue_free)
