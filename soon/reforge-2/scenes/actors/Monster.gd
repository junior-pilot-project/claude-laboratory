extends CharacterBody2D
## A hunting-ground monster (Fantasy RPG monster-pack battler). Wanders slowly
## around its spawn point, plays a hit reaction when struck, and a death
## animation (or a fade for monsters without a die sheet) when its HP runs out.
## Damage = the player's equipped weapon power.
##
## The body (CharacterBody2D, layer 2) blocks the player and other monsters; a
## child Hurtbox Area2D (layer 4) is what the player's AttackHitbox detects.
## The pack ships no walk animation, so wandering plays "idle" with flip_h
## tracking the move direction.
##
## The pack lays each animation out on a 16x16-multiple grid: idle = 4x4 (16
## frames), hit = 2x4 (8), die = 1x4 (4). Per-monster frame size = idle_dims / 4.
## SpriteFrames are built at runtime so no giant .tres files are needed.

signal died(stage: int)

const HP_BAR_MIN: float = 22.0

# HP bar fill shifts green -> yellow -> red as health drops.
const HP_COLOR_FULL := Color(0.35, 0.85, 0.3)
const HP_COLOR_HALF := Color(0.95, 0.8, 0.2)
const HP_COLOR_LOW := Color(0.9, 0.2, 0.15)

# --- Wander tuning ---
const WANDER_SPEED: float = 35.0
const WANDER_RADIUS: float = 70.0    # max distance of a wander target from home
const IDLE_TIME_MIN: float = 1.0
const IDLE_TIME_MAX: float = 2.5
const ARRIVE_DIST: float = 4.0

# --- Aggro tuning ---
# Every monster retaliates when struck; `aggressive` ones (deepest hunt) charge
# as soon as the player comes near. Chase is faster than wandering but slower
# than the player (120), so running away always works.
const CHASE_SPEED: float = 55.0
const AGGRO_RADIUS: float = 90.0     # proximity trigger (aggressive only)
const LEASH_DIST: float = 240.0      # max chase distance from home before reset

const SHEETS := {
	"slime": {
		"idle": preload("res://assets/monsters/slime_idle.png"),
		"hit": preload("res://assets/monsters/slime_hit.png"),
		"die": preload("res://assets/monsters/slime_die.png"),
		"fw": 32, "fh": 32, "scale": 1.1,
	},
	"goblin": {
		"idle": preload("res://assets/monsters/goblin_idle.png"),
		"hit": preload("res://assets/monsters/goblin_hit.png"),
		"die": preload("res://assets/monsters/goblin_die.png"),
		"fw": 32, "fh": 32, "scale": 1.0,
	},
	"orc": {
		"idle": preload("res://assets/monsters/orc_idle.png"),
		"hit": preload("res://assets/monsters/orc_hit.png"),
		"die": preload("res://assets/monsters/orc_die.png"),
		"fw": 32, "fh": 48, "scale": 1.0,
	},
	"ogre": {
		"idle": preload("res://assets/monsters/ogre_idle.png"),
		"hit": preload("res://assets/monsters/ogre_hit.png"),
		"die": null,   # huge bespoke death sheet — fade instead
		"fw": 64, "fh": 64, "scale": 1.0,
	},
	"cyclops": {
		"idle": preload("res://assets/monsters/cyclops_idle.png"),
		"hit": preload("res://assets/monsters/cyclops_hit.png"),
		"die": preload("res://assets/monsters/cyclops_die.png"),
		"fw": 32, "fh": 64, "scale": 1.0,
	},
	# Dungeon-pack dwellers: single-row 4-frame idle sheets only (grid_idle
	# overrides the default 4x4) — no hit/die sheets, so the hit reaction is the
	# flash and death is the fade (ogre precedent).
	"skeleton": {
		"idle": preload("res://assets/monsters/skeleton_idle.png"),
		"hit": null, "die": null,
		"fw": 32, "fh": 32, "scale": 1.2, "grid_idle": [4, 1],
	},
	"bat": {
		"idle": preload("res://assets/monsters/bat_idle.png"),
		"hit": null, "die": null,
		"fw": 32, "fh": 32, "scale": 1.1, "grid_idle": [4, 1],
	},
	"slime_red": {
		"idle": preload("res://assets/monsters/slime_red_idle.png"),
		"hit": null, "die": null,
		"fw": 32, "fh": 32, "scale": 1.3, "grid_idle": [4, 1],
	},
}

var aggressive: bool = false   # set by the hunting ground (proximity aggro)
var speed_mult: float = 1.0    # per-map pace (deepest hunt runs hotter for tension)

var _stage: int = 1
var _hp: int = 1
var _max_hp: int = 1
var _dead: bool = false
var _aggro: bool = false       # currently chasing the player
var _fh: int = 32
var _has_die: bool = false
var _has_hit: bool = false
var _bar_left: float = -14.0
var _bar_w: float = 28.0

# Wander state
var _home: Vector2 = Vector2.ZERO
var _wandering: bool = false        # false = idling, true = walking to _target
var _target: Vector2 = Vector2.ZERO
var _idle_left: float = 1.0

@onready var _anim: AnimatedSprite2D = $Anim
@onready var _col: CollisionShape2D = $CollisionShape2D
@onready var _hurtbox: Area2D = $Hurtbox
@onready var _hurt_col: CollisionShape2D = $Hurtbox/CollisionShape2D
@onready var _contact: Area2D = $ContactArea
@onready var _contact_col: CollisionShape2D = $ContactArea/CollisionShape2D
@onready var _hp_bar: Node2D = $HPBar
@onready var _hp_bg: ColorRect = $HPBar/Bg
@onready var _hp_fill: ColorRect = $HPBar/Fill

func setup(stage: int, mon_id: String) -> void:
	_stage = stage
	_hp = GameConfig.monster_hp(stage)
	_max_hp = _hp
	var d: Dictionary = SHEETS.get(mon_id, SHEETS["slime"])
	var fw: int = int(d["fw"])
	_fh = int(d["fh"])
	_has_die = d["die"] != null
	_has_hit = d.get("hit") != null

	var sf := SpriteFrames.new()
	sf.remove_animation("default")
	var gi: Array = d.get("grid_idle", [4, 4])  # [cols, rows] of the idle sheet
	_add_anim(sf, "idle", d["idle"], fw, _fh, int(gi[0]), int(gi[1]), 8.0, true)
	if _has_hit:
		_add_anim(sf, "hit", d["hit"], fw, _fh, 2, 4, 16.0, false)
	if _has_die:
		_add_anim(sf, "die", d["die"], fw, _fh, 1, 4, 12.0, false)
	_anim.sprite_frames = sf
	_anim.scale = Vector2(d["scale"], d["scale"])
	_anim.play("idle")
	if not _anim.animation_finished.is_connected(_on_anim_finished):
		_anim.animation_finished.connect(_on_anim_finished)

	# Per-instance shapes sized to the monster. The hurtbox covers the sprite;
	# the solid body is a smaller foot box so the player can get close enough
	# for the short attack reach to land.
	var hurt := RectangleShape2D.new()
	hurt.size = Vector2(fw * 0.6, _fh * 0.5) * float(d["scale"])
	_hurt_col.shape = hurt
	var body := RectangleShape2D.new()
	body.size = Vector2(fw * 0.5, _fh * 0.3) * float(d["scale"])
	_col.shape = body
	# Contact-damage zone: slightly larger than the foot box so brushing the
	# monster hurts (the player's i-frames keep it from melting them).
	var contact := RectangleShape2D.new()
	contact.size = Vector2(fw * 0.65, _fh * 0.45) * float(d["scale"])
	_contact_col.shape = contact

	# Wander home = where the wave spawner placed us.
	_home = position
	_idle_left = randf_range(IDLE_TIME_MIN, IDLE_TIME_MAX)

	# HP bar sized + lifted above the sprite. The Bg doubles as a 1px dark
	# border around the fill (and shows through as the empty track).
	_bar_w = clampf(fw * 0.9 * float(d["scale"]), HP_BAR_MIN, 44.0)
	_bar_left = -_bar_w * 0.5
	_hp_bg.offset_left = _bar_left - 1.0
	_hp_bg.offset_right = _bar_left + _bar_w + 1.0
	_hp_bg.offset_top = -3.0
	_hp_bg.offset_bottom = 3.0
	_hp_fill.offset_left = _bar_left
	_hp_fill.offset_right = _bar_left + _bar_w
	_hp_fill.offset_top = -2.0
	_hp_fill.offset_bottom = 2.0
	_hp_fill.color = HP_COLOR_FULL
	_hp_bar.position.y = -(_fh * 0.5 * float(d["scale"])) - 7.0

func _add_anim(sf: SpriteFrames, name: String, tex: Texture2D, fw: int, fh: int,
		cols: int, rows: int, fps: float, loop: bool) -> void:
	sf.add_animation(name)
	sf.set_animation_speed(name, fps)
	sf.set_animation_loop(name, loop)
	for r in rows:
		for c in cols:
			var at := AtlasTexture.new()
			at.atlas = tex
			at.region = Rect2(c * fw, r * fh, fw, fh)
			sf.add_frame(name, at)

# ---------------------------------------------------------------------------
# AI: wander near home; chase the player while aggroed (struck, or proximity
# for `aggressive` monsters). Contact damage *is* the monster's attack.
# ---------------------------------------------------------------------------
func _physics_process(delta: float) -> void:
	if _dead:
		velocity = Vector2.ZERO
		return

	# Contact damage: polling (instead of body_entered) also catches a monster
	# wandering into a stationary player; the player's i-frames rate-limit it.
	for body in _contact.get_overlapping_bodies():
		if body.is_in_group("player") and body.has_method("take_contact_damage"):
			body.take_contact_damage(GameConfig.monster_damage(_stage))

	if _anim.animation == "hit":
		velocity = Vector2.ZERO
		return

	var player: Node2D = get_tree().get_first_node_in_group("player")
	if not _aggro and aggressive and player != null \
			and position.distance_to(player.position) <= AGGRO_RADIUS:
		_aggro = true
	if _aggro:
		# Drop the chase when there is nothing to chase (dead player, popup
		# open) or it strayed too far from home — then stroll back home.
		if player == null or GameState.hp <= 0 or bool(player.get("input_locked")) \
				or _home.distance_to(position) > LEASH_DIST:
			_aggro = false
			_wandering = true
			_target = _home
		else:
			velocity = (player.position - position).normalized() * CHASE_SPEED * speed_mult
			if absf(velocity.x) > 1.0:
				_anim.flip_h = velocity.x < 0.0
			move_and_slide()
			return

	if not _wandering:
		_idle_left -= delta
		if _idle_left <= 0.0:
			_wandering = true
			var ang := randf() * TAU
			_target = _home + Vector2.from_angle(ang) * (randf() * WANDER_RADIUS)
		return

	var to_target := _target - position
	if to_target.length() <= ARRIVE_DIST:
		_stop_wandering()
		return
	velocity = to_target.normalized() * WANDER_SPEED * speed_mult
	if absf(velocity.x) > 1.0:
		_anim.flip_h = velocity.x < 0.0
	move_and_slide()
	if get_slide_collision_count() > 0:
		_stop_wandering()   # bumped a wall / player / monster — give up, idle

func _stop_wandering() -> void:
	_wandering = false
	velocity = Vector2.ZERO
	_idle_left = randf_range(IDLE_TIME_MIN, IDLE_TIME_MAX)

# ---------------------------------------------------------------------------
# Damage / death
# ---------------------------------------------------------------------------
## Called by the player's attack swing (via the Hurtbox child's parent).
## A 0 (no weapon) still flashes a "0".
## False once death starts (the fade/die-anim corpse is still in the tree for a
## moment) — wave logic must not count corpses as alive.
func is_alive() -> bool:
	return not _dead

func take_damage(dmg: int) -> void:
	if _dead:
		return
	_aggro = true   # retaliate: being struck always provokes a chase
	_spawn_damage_number(dmg)
	if dmg > 0:
		_hp -= dmg
		_update_bar()
	if _hp <= 0:
		_die()
		return
	_flash()
	if _has_hit and _anim.animation != "hit":
		_anim.play("hit")

func _on_anim_finished() -> void:
	if _dead:
		if _has_die:
			queue_free()
		return
	if _anim.animation == "hit":
		_anim.play("idle")

func _update_bar() -> void:
	if _hp_fill == null:
		return
	var frac: float = clampf(float(_hp) / float(_max_hp), 0.0, 1.0)
	_hp_fill.offset_right = _bar_left + _bar_w * frac
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
	Audio.play("slash")
	died.emit(_stage)
	_hp_bar.visible = false
	_col.set_deferred("disabled", true)
	_hurt_col.set_deferred("disabled", true)
	_hurtbox.monitorable = false
	_contact.set_deferred("monitoring", false)
	_contact_col.set_deferred("disabled", true)
	if _has_die:
		_anim.play("die")   # queue_free on animation_finished
	else:
		var tw := create_tween()
		tw.tween_property(_anim, "modulate:a", 0.0, 0.35)
		tw.tween_callback(queue_free)

## Brief floating damage number rising from the monster.
func _spawn_damage_number(dmg: int) -> void:
	var l := Label.new()
	l.text = str(dmg)
	l.position = Vector2(-12, -(_fh * 0.5) - 22.0)
	l.add_theme_font_size_override("font_size", 16)
	l.add_theme_color_override("font_color", Color(1, 0.95, 0.6))
	l.visibility_layer = 2  # actor layer: culled from the minimap render
	add_child(l)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "position:y", l.position.y - 22.0, 0.5)
	tw.tween_property(l, "modulate:a", 0.0, 0.5)
	tw.chain().tween_callback(l.queue_free)
