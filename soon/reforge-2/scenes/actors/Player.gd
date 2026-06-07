extends CharacterBody2D
## 4-direction top-down player, composited from layered 32x48 sprites (Fantasy RPG
## Character Base body + HeavyArmor + hair), all sharing one frame index. The base
## pack lays each sheet out as ROW = facing direction, COLUMN = animation frame
## (idle and walk are separate sheets). The base pack ships no attack animation, so
## attacks play a baked melee sheet (player_melee.png): a 4x4 sheet (ROW = facing,
## COLUMN = swing frame) with the body + a small sword + the Swashbuckler slash arc
## drawn in. During an attack the layered sprites are hidden and the Melee sprite
## plays its 4 frames; outside attacks no weapon is shown (a held inventory icon
## read as an awkward floating blob, so the sword only appears mid-swing).
## Movement is disabled while a UI popup is open (input_locked).

const SPEED: float = 120.0
const ANIM_FPS: float = 8.0
const IDLE_FPS: float = 4.0
const STEP_INTERVAL: float = 0.32
const ATTACK_DURATION: float = 0.30
const MELEE_FRAMES: int = 4   # columns in player_melee.png per facing row

# Dash: a short burst in the move/facing direction. Grants brief i-frames so it
# doubles as a dodge, then a cooldown before it can fire again.
const DASH_SPEED: float = 360.0
const DASH_DURATION: float = 0.16
const DASH_COOLDOWN: float = 0.55

# Base-pack sheet layout: row = facing, column = frame. The Fantasy RPG Character
# Base pack orders its rows down / left / right / up (NOT down/up/left/right).
const DIR_ROW := {"down": 0, "left": 1, "right": 2, "up": 3}
const DIR_VEC := {
	"down": Vector2(0, 1), "up": Vector2(0, -1),
	"left": Vector2(-1, 0), "right": Vector2(1, 0),
}

# Layered character sheets (idle + walk per layer).
const BODY_IDLE: Texture2D = preload("res://assets/characters/player_body_idle.png")
const BODY_WALK: Texture2D = preload("res://assets/characters/player_body_walk.png")
const ARMOR_IDLE: Texture2D = preload("res://assets/characters/player_armor_idle.png")
const ARMOR_WALK: Texture2D = preload("res://assets/characters/player_armor_walk.png")
const HAIR_IDLE: Texture2D = preload("res://assets/characters/player_hair_idle.png")
const HAIR_WALK: Texture2D = preload("res://assets/characters/player_hair_walk.png")

# Attack hitbox offset per facing — short reach so the swing only hits an adjacent
# target (scaled for the 2x art).
const HIT_OFFSET := {
	"down": Vector2(0, 26), "up": Vector2(0, -16),
	"left": Vector2(-24, 12), "right": Vector2(24, 12),
}

const DEATH_FRAMES: int = 8        # columns in player_death.png per facing row
const DEATH_DURATION: float = 0.8

var input_locked: bool = false
var _facing: String = "down"
var _anim_time: float = 0.0
var _idle_time: float = 0.0
var _step_time: float = 0.0
var _attacking: bool = false
var _attack_time: float = 0.0
var _dashing: bool = false
var _dash_time: float = 0.0
var _dash_cd: float = 0.0           # remaining cooldown before the next dash
var _dash_dir: Vector2 = Vector2.ZERO
var _walking: bool = false
var _iframes: float = 0.0          # remaining invincibility after a hit
var _dying: bool = false
var _flash_tw: Tween = null

@onready var _visual: Node2D = $Visual
@onready var _body: Sprite2D = $Visual/Body
@onready var _armor: Sprite2D = $Visual/Armor
@onready var _hair: Sprite2D = $Visual/Hair
@onready var _weapon: Sprite2D = $Visual/Weapon
@onready var _melee: Sprite2D = $Visual/Melee
@onready var _death: Sprite2D = $Visual/Death
@onready var _hitbox: Area2D = $AttackHitbox

func _ready() -> void:
	add_to_group("player")
	_weapon.visible = false  # weapon only shows during the attack swing (melee sheet)
	_melee.visible = false
	_apply_layer_textures(false)
	_update_frame(true)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("attack"):
		_try_attack()
	elif event.is_action_pressed("dash"):
		_try_dash()
	elif event.is_action_pressed("potion"):
		if not input_locked and not _dying:
			if GameState.use_equipped_potion():
				Audio.play("buy")

func _physics_process(delta: float) -> void:
	if _dash_cd > 0.0:
		_dash_cd -= delta
	if _iframes > 0.0:
		_iframes -= delta
		if _iframes <= 0.0:
			_visual.modulate.a = 1.0
	if _dying:
		velocity = Vector2.ZERO
		return
	if _dashing:
		_dash_time += delta
		velocity = _dash_dir * DASH_SPEED * GameState.dash_mult()
		move_and_slide()
		_anim_time += delta
		_update_frame(false)
		if _dash_time >= DASH_DURATION:
			_dashing = false
		return
	if _attacking:
		_attack_time += delta
		velocity = Vector2.ZERO
		move_and_slide()
		_update_melee_frame()
		if _attack_time >= ATTACK_DURATION:
			_end_attack()
		return

	var dir := Vector2.ZERO
	if not input_locked:
		dir.x = Input.get_axis("move_left", "move_right")
		dir.y = Input.get_axis("move_up", "move_down")
	if dir.length() > 1.0:
		dir = dir.normalized()
	velocity = dir * SPEED * GameState.move_speed_mult()
	move_and_slide()

	if dir != Vector2.ZERO:
		if abs(dir.x) > abs(dir.y):
			_facing = "right" if dir.x > 0 else "left"
		else:
			_facing = "down" if dir.y > 0 else "up"
		_anim_time += delta
		if not _walking:
			_walking = true
			_apply_layer_textures(true)
		_update_frame(false)
		_tick_footsteps(delta)
	else:
		_idle_time += delta
		_step_time = 0.0
		if _walking:
			_walking = false
			_apply_layer_textures(false)
		_update_frame(true)

## Swaps each layer's texture between the idle and walk sheets (only on state flip).
func _apply_layer_textures(walking: bool) -> void:
	_body.texture = BODY_WALK if walking else BODY_IDLE
	_armor.texture = ARMOR_WALK if walking else ARMOR_IDLE
	_hair.texture = HAIR_WALK if walking else HAIR_IDLE

func _update_frame(idle: bool) -> void:
	var row: int = int(DIR_ROW.get(_facing, 0))
	var col: int = (int(_idle_time * IDLE_FPS) % 4) if idle else (int(_anim_time * ANIM_FPS) % 4)
	var f: int = row * 4 + col
	_body.frame = f
	_armor.frame = f
	_hair.frame = f

func _tick_footsteps(delta: float) -> void:
	_step_time += delta
	if _step_time >= STEP_INTERVAL:
		_step_time -= STEP_INTERVAL
		# (no footstep sfx asset shipped; kept as a hook)

# ---------------------------------------------------------------------------
# Attack: play the baked melee sheet (body + sword + slash) for the facing,
# hiding the layered sprites + held weapon while it runs.
# ---------------------------------------------------------------------------
func _try_attack() -> void:
	if input_locked or _attacking or _dashing or _dying:
		return
	_attacking = true
	_attack_time = 0.0
	velocity = Vector2.ZERO
	_set_layers_visible(false)
	_melee.visible = true
	_update_melee_frame()
	Audio.play("slash")
	_hitbox.position = HIT_OFFSET.get(_facing, Vector2(0, 26))
	_hitbox.monitoring = true
	_resolve_hits()

## Dash in the current move direction (or the facing direction when standing
## still). Sets i-frames for the dash window so it works as a dodge, and starts
## the cooldown. Ignored mid-attack/dash, while dying, or on cooldown.
func _try_dash() -> void:
	if input_locked or _attacking or _dashing or _dying or _dash_cd > 0.0:
		return
	var dir := Vector2(
		Input.get_axis("move_left", "move_right"),
		Input.get_axis("move_up", "move_down"))
	if dir == Vector2.ZERO:
		dir = DIR_VEC[_facing]
	dir = dir.normalized()
	_dashing = true
	_dash_time = 0.0
	_dash_dir = dir
	_dash_cd = DASH_COOLDOWN
	_iframes = maxf(_iframes, DASH_DURATION)
	# Face the dash direction and play the walk sheet for the burst.
	if abs(dir.x) > abs(dir.y):
		_facing = "right" if dir.x > 0.0 else "left"
	else:
		_facing = "down" if dir.y > 0.0 else "up"
	if not _walking:
		_walking = true
		_apply_layer_textures(true)
	Audio.play("whoosh")

## Selects the melee sheet cell for the current facing + elapsed time.
func _update_melee_frame() -> void:
	var row: int = int(DIR_ROW.get(_facing, 0))
	var col: int = clampi(int(_attack_time / ATTACK_DURATION * MELEE_FRAMES), 0, MELEE_FRAMES - 1)
	_melee.frame = row * 4 + col

## Damages every monster hurtbox inside the swing once, after the moved hitbox has
## registered with the physics server.
func _resolve_hits() -> void:
	await get_tree().physics_frame
	await get_tree().physics_frame
	if not _attacking or not is_instance_valid(self):
		return
	var dmg: int = maxi(GameState.weapon_power(), GameConfig.UNARMED_POWER)
	for area in _hitbox.get_overlapping_areas():
		# Mask 4 only sees monster hurtboxes; the damageable body is their parent.
		var target := area.get_parent()
		if target and target.has_method("take_damage"):
			target.take_damage(dmg)

func _end_attack() -> void:
	_attacking = false
	_hitbox.monitoring = false
	_melee.visible = false
	_set_layers_visible(true)
	_visual.position = Vector2.ZERO
	_update_frame(not _walking)

func _set_layers_visible(v: bool) -> void:
	_body.visible = v
	_armor.visible = v
	_hair.visible = v

func set_input_locked(locked: bool) -> void:
	input_locked = locked
	if locked:
		_dashing = false
		velocity = Vector2.ZERO

# ---------------------------------------------------------------------------
# Damage intake / death (monsters poll this via their ContactArea)
# ---------------------------------------------------------------------------
func take_contact_damage(raw: int) -> void:
	# input_locked = a popup is open; the world is paused for the player.
	if _iframes > 0.0 or _dying or input_locked:
		return
	_iframes = GameConfig.PLAYER_IFRAME_TIME
	Audio.play("slash")
	# Hold a strong red tint, then fade to a translucent blink for the rest of
	# the i-frame window (a short red-to-white tween read as a white flash).
	_visual.modulate = Color(1, 0.2, 0.2)
	if _flash_tw != null and _flash_tw.is_valid():
		_flash_tw.kill()
	_flash_tw = create_tween()
	_flash_tw.tween_interval(0.22)
	_flash_tw.tween_property(_visual, "modulate", Color(1, 1, 1, 0.55), 0.12)
	if GameState.take_player_damage(raw):
		_die()

## Death: play the baked death sheet, then respawn at the Room's bed (the
## SceneManager fade + non-hunt heal restore everything else).
func _die() -> void:
	if _dying:
		return
	_dying = true
	_attacking = false
	_hitbox.monitoring = false
	velocity = Vector2.ZERO
	if _flash_tw != null and _flash_tw.is_valid():
		_flash_tw.kill()
	_visual.modulate = Color.WHITE
	_set_layers_visible(false)
	_melee.visible = false
	_death.visible = true
	Audio.play("lose")
	var row: int = int(DIR_ROW.get(_facing, 0))
	for col in DEATH_FRAMES:
		_death.frame = row * DEATH_FRAMES + col
		await get_tree().create_timer(DEATH_DURATION / DEATH_FRAMES).timeout
		if not is_instance_valid(self) or not is_inside_tree():
			return
	await get_tree().create_timer(0.3).timeout
	if is_inside_tree():
		SceneManager.goto(SceneManager.ROOM, "bed")
