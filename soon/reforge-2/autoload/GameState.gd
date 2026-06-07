extends Node
## Persistent player state: gold, inventory, equipped slots, gambling-box
## purchase counts, and the enhance-sum goal. Auto-saves to user://save.json
## (IndexedDB-backed and persistent on the Web export). Autoload singleton.

signal gold_changed(gold: int)
signal inventory_changed
signal enhance_sum_changed(sum: int, goal: int)
signal goal_reached
signal box_counts_changed
signal materials_changed(count: int)
signal hp_changed(hp: int, max_hp: int)
signal potions_changed
signal player_died
signal run_started
signal run_changed(run_gold: int, run_mats: int)
signal run_ended(banked_gold: int, banked_mats: int, reason: String)

const SAVE_PATH := "user://save.json"

var gold: int = 0
var inventory: Array[Equipment] = []
# slot type -> Equipment (or absent if empty)
var equipped: Dictionary = {}
# box id -> int purchased count (session/persistent; reset rule TBD upstream)
var box_counts: Dictionary = {}
# 제작연마제 (crafting material) count, dropped by monsters.
var craft_mats: int = 0
# Current HP. Runtime-only (never persisted): every boot starts at full health.
var hp: int = 0
# Dungeon run satchel (런 정산형 전리품 주머니). Runtime-only, NEVER persisted:
# drops inside the dungeon accumulate here and only bank to the real wallet via
# end_dungeon_run (force-quitting mid-run forfeits the satchel by design).
var run_active: bool = false
var run_gold: int = 0
var run_mats: int = 0
# potion id -> owned count (persisted).
var potions: Dictionary = {"small": 0, "medium": 0, "large": 0}
# Potion equipped from the inventory's 소비 tab ("" = none). Only the equipped
# potion shows in the hunt quick-slot / drinks on the potion key. Persisted.
var equipped_potion: String = ""
# Next tick (ms) a potion may be drunk — POTION_COOLDOWN gate, runtime only.
var _potion_ready_at_ms: int = 0

var _goal_already_reached: bool = false
var _suppress_save: bool = false

func _ready() -> void:
	load_game()
	hp = max_hp()
	hp_changed.emit(hp, max_hp())

# ---------------------------------------------------------------------------
# Gold
# ---------------------------------------------------------------------------
func add_gold(amount: int) -> void:
	if amount == 0:
		return
	gold = min(gold + amount, GameConfig.GOLD_CAP)
	gold_changed.emit(gold)
	save_game()

func can_afford(amount: int) -> bool:
	return gold >= amount

func spend_gold(amount: int) -> bool:
	if amount > gold:
		return false
	gold -= amount
	gold_changed.emit(gold)
	save_game()
	return true

# ---------------------------------------------------------------------------
# Shop: buy
# ---------------------------------------------------------------------------
## Buys a fresh piece of equipment of (type, grade). Returns the new Equipment
## or null if unaffordable / not purchasable.
func buy_equipment(type: String, grade: String) -> Equipment:
	# Validate against any priced grade rather than the shop's display list:
	# SHOP_GRADES governs only what the Buy tab shows (High only), but lower grades
	# remain valid purchases (e.g. tests / box rewards) as long as they have a price.
	if not GameConfig.SHOP_PRICE.has(grade):
		return null
	if inventory_full():
		return null
	var price: int = int(GameConfig.SHOP_PRICE.get(grade, 0))
	if not spend_gold(price):
		return null
	var eq := Equipment.new(type, grade)
	inventory.append(eq)
	inventory_changed.emit()
	save_game()
	return eq

## True when the equipment inventory is at capacity (blocks further purchases).
## The whetstone is tracked separately (craft_mats) and never counts here.
func inventory_full() -> bool:
	return inventory.size() >= GameConfig.INVENTORY_MAX

## Permanently discards a piece of equipment (no refund). Auto-unequips it first
## if it was worn. Returns false if the item is not in the inventory.
func delete_equipment(eq: Equipment) -> bool:
	if eq == null or not inventory.has(eq):
		return false
	_suppress_save = true
	if is_equipped(eq):
		equipped.erase(eq.type)
	inventory.erase(eq)
	_suppress_save = false
	inventory_changed.emit()
	_recompute_enhance_sum()
	save_game()
	return true

# ---------------------------------------------------------------------------
# Shop: enhance
# ---------------------------------------------------------------------------
## Attempts one enhancement on `eq`. Returns a result dict:
##   {ok:bool, success:bool, cost:int, chance:int, reason:String}
## ok=false means it could not even be attempted (e.g. not enough gold).
func try_enhance(eq: Equipment) -> Dictionary:
	if eq == null or not inventory.has(eq):
		return {"ok": false, "success": false, "cost": 0, "chance": 0, "reason": "no_item"}
	var chance: int = GameConfig.enhance_chance(eq.grade, eq.level)
	var cost: int = GameConfig.enhance_cost(eq.grade, eq.level)
	if not can_afford(cost):
		return {"ok": false, "success": false, "cost": cost, "chance": chance, "reason": "no_gold"}
	spend_gold(cost)
	var roll: float = randf() * 100.0
	var success: bool = roll < float(chance)
	if success:
		var old_max: int = max_hp()
		eq.level += 1
		# Enhancing a worn non-weapon piece raises max HP — mirror the equip-change
		# rule: shift current HP by the delta and tell the HUD.
		if max_hp() != old_max:
			if hp > 0:
				hp = clampi(hp + (max_hp() - old_max), 1, max_hp())
			hp_changed.emit(hp, max_hp())
		inventory_changed.emit()
		_recompute_enhance_sum()
	save_game()
	return {"ok": true, "success": success, "cost": cost, "chance": chance, "reason": ""}

# ---------------------------------------------------------------------------
# Equip
# ---------------------------------------------------------------------------
func is_equipped(eq: Equipment) -> bool:
	return equipped.get(eq.type, null) == eq

## Toggles equip/unequip for the item's slot. Returns true if now equipped.
func toggle_equip(eq: Equipment) -> bool:
	var old_max: int = max_hp()
	if is_equipped(eq):
		equipped.erase(eq.type)
		_after_equip_change(old_max)
		return false
	equipped[eq.type] = eq
	_after_equip_change(old_max)
	return true

func equip(eq: Equipment) -> void:
	var old_max: int = max_hp()
	equipped[eq.type] = eq
	_after_equip_change(old_max)

func _after_equip_change(old_max: int) -> void:
	# Shift current HP by the max-HP delta so a gear swap keeps the *missing* HP
	# constant: +HP gear fills its own headroom (the HP number grows live) and
	# removing it takes that bonus back. The dead stay at 0; never drops below 1.
	if hp > 0:
		hp = clampi(hp + (max_hp() - old_max), 1, max_hp())
	inventory_changed.emit()
	_recompute_enhance_sum()
	hp_changed.emit(hp, max_hp())
	save_game()

## 강화합 = sum of equipped slot enhancement levels.
func get_enhance_sum() -> int:
	var s: int = 0
	for slot in equipped:
		var eq: Equipment = equipped[slot]
		if eq != null:
			s += eq.level
	return s

func _recompute_enhance_sum() -> void:
	var s: int = get_enhance_sum()
	enhance_sum_changed.emit(s, GameConfig.GOAL)
	if s >= GameConfig.GOAL and not _goal_already_reached:
		_goal_already_reached = true
		goal_reached.emit()

func check_goal() -> bool:
	return get_enhance_sum() >= GameConfig.GOAL

# ---------------------------------------------------------------------------
# Gambling
# ---------------------------------------------------------------------------
## Lifetime number of times this box has been opened (informational stat only —
## there is no purchase cap).
func box_count(box_id: String) -> int:
	return int(box_counts.get(box_id, 0))

## Opens one box (= open_boxes(box_id, 1)).
func open_box(box_id: String) -> Dictionary:
	return open_boxes(box_id, 1)

## Opens `count` boxes at once (clamped to 1..MAX_DRAW). Charges the full batch
## price up front, rolls each reward, and credits the total.
## Returns {ok:bool, count:int, spent:int, reward:int, rewards:Array, reason:String}.
func open_boxes(box_id: String, count: int) -> Dictionary:
	if not GameConfig.BOXES.has(box_id):
		return {"ok": false, "count": 0, "spent": 0, "reward": 0, "rewards": [], "reason": "bad_box"}
	count = clampi(count, 1, GameConfig.MAX_DRAW)
	var cfg: Dictionary = GameConfig.BOXES[box_id]
	var price: int = int(cfg["price"])
	var total_price: int = price * count
	if not can_afford(total_price):
		return {"ok": false, "count": 0, "spent": 0, "reward": 0, "rewards": [], "reason": "no_gold"}

	_suppress_save = true  # batch the rolls; persist once at the end
	if total_price > 0:
		spend_gold(total_price)
	var rewards: Array[int] = []
	var total_reward: int = 0
	for _i in count:
		var r: int = GameConfig.box_reward(int(cfg["max_reward"]))
		rewards.append(r)
		total_reward += r
	if total_reward > 0:
		gold = min(gold + total_reward, GameConfig.GOLD_CAP)
	box_counts[box_id] = box_count(box_id) + count
	_suppress_save = false

	gold_changed.emit(gold)
	box_counts_changed.emit()
	save_game()
	return {"ok": true, "count": count, "spent": total_price, "reward": total_reward,
		"rewards": rewards, "reason": ""}

# ---------------------------------------------------------------------------
# Combat / hunting
# ---------------------------------------------------------------------------
## Attack power of the currently equipped sword (0 if none equipped). Used as the
## per-hit damage dealt to monsters, so enhancing the sword speeds up kills.
func weapon_power() -> int:
	var eq: Equipment = equipped.get("sword")
	if eq == null:
		return 0
	return GameConfig.equip_power(eq.grade, eq.level)

## Player max HP = base + the HP bonus from each equipped non-weapon piece
## (mirrors GameConfig.stat_text's "HP +N" = equip_power*2). Display-only for now
## (HP does not drain in the hunting ground); reserved for future dungeons.
func max_hp() -> int:
	var hp: int = GameConfig.BASE_HP
	for slot in equipped:
		var eq: Equipment = equipped[slot]
		if eq != null and eq.type != GameConfig.TYPE_SWORD:
			hp += GameConfig.equip_power(eq.grade, eq.level) * 2
	return hp

## Move-speed multiplier from the equipped boots' enhancement level (1.0 = base;
## +1%/level capped — see GameConfig.boots_speed_bonus).
func move_speed_mult() -> float:
	var eq: Equipment = equipped.get(GameConfig.TYPE_BOOTS)
	if eq == null:
		return 1.0
	return 1.0 + GameConfig.boots_speed_bonus(eq.level)

## Dash-distance multiplier — the helmet's future stat (raid drop). Hook only.
func dash_mult() -> float:
	return 1.0

## Total defense from equipped non-weapon gear (sum of each piece's equip_power),
## mirroring stat_text's "DEF +N". Used by the character Info screen.
func defense_power() -> int:
	var d: int = 0
	for slot in equipped:
		var eq: Equipment = equipped[slot]
		if eq != null and eq.type != GameConfig.TYPE_SWORD:
			d += GameConfig.equip_power(eq.grade, eq.level)
	return d

# ---------------------------------------------------------------------------
# HP / damage / potions
# ---------------------------------------------------------------------------
## Applies raw monster damage through the defense curve. Returns true when the
## hit was lethal (hp reached 0); the Player node owns the death presentation.
func take_player_damage(raw: int) -> bool:
	if hp <= 0:
		return false
	var dmg: int = GameConfig.mitigated_damage(raw, defense_power())
	hp = maxi(hp - dmg, 0)
	hp_changed.emit(hp, max_hp())
	if hp == 0:
		# Settle the dungeon satchel (half is lost) BEFORE anyone reacts to the
		# death — Player._die() scene-switches to the bedroom on this signal.
		if run_active:
			end_dungeon_run("death")
		player_died.emit()
		return true
	return false

func heal_player(amount: int) -> void:
	if amount <= 0:
		return
	hp = mini(hp + amount, max_hp())
	hp_changed.emit(hp, max_hp())

## Full heal — applied whenever the player is anywhere but the hunting ground
## (leaving the hunt, death respawn, shopping trips).
func restore_hp() -> void:
	hp = max_hp()
	hp_changed.emit(hp, max_hp())

func potion_count(potion_id: String) -> int:
	return int(potions.get(potion_id, 0))

## Buys `count` potions of one kind (single gold spend). Returns false when
## unaffordable, the id is unknown, or the purchase would exceed POTION_MAX.
func buy_potion(potion_id: String, count: int = 1) -> bool:
	if not GameConfig.POTIONS.has(potion_id) or count < 1:
		return false
	if potion_count(potion_id) + count > GameConfig.POTION_MAX:
		return false
	var price: int = int(GameConfig.POTIONS[potion_id]["price"]) * count
	if not spend_gold(price):
		return false
	potions[potion_id] = potion_count(potion_id) + count
	potions_changed.emit()
	save_game()
	return true

## Equip/unequip a potion for the hunt quick-slot (toggle; equipping another kind
## replaces the current one). Unknown ids are ignored.
func toggle_equip_potion(potion_id: String) -> bool:
	if not GameConfig.POTIONS.has(potion_id):
		return false
	equipped_potion = "" if equipped_potion == potion_id else potion_id
	potions_changed.emit()
	save_game()
	return equipped_potion == potion_id

## Drinks the equipped potion (quick-slot / potion key). Returns false when
## nothing is equipped or use_potion refuses (none owned / full HP / dead).
func use_equipped_potion() -> bool:
	return equipped_potion != "" and use_potion(equipped_potion)

## Drinks one potion (if owned), healing heal_pct of max HP. Returns false when
## none owned, already at full health, dead, or still on cooldown.
func use_potion(potion_id: String) -> bool:
	if potion_cooldown_left() > 0.0:
		return false
	if potion_count(potion_id) <= 0 or hp <= 0 or hp >= max_hp():
		return false
	potions[potion_id] = potion_count(potion_id) - 1
	_potion_ready_at_ms = Time.get_ticks_msec() + int(GameConfig.POTION_COOLDOWN * 1000.0)
	heal_player(int(ceil(float(GameConfig.POTIONS[potion_id]["heal_pct"]) * float(max_hp()))))
	potions_changed.emit()
	save_game()
	return true

## Seconds until the next potion may be drunk (0 when ready). UI polls this for
## the quick-slot countdown.
func potion_cooldown_left() -> float:
	return maxf(0.0, float(_potion_ready_at_ms - Time.get_ticks_msec()) / 1000.0)

## Quick-use: consumes the smallest available potion (small -> medium -> large).
## Returns the id used, or "" when nothing was consumed.
func use_best_potion() -> String:
	for id in GameConfig.POTION_ORDER:
		if use_potion(id):
			return id
	return ""

func add_material(n: int = 1) -> void:
	if n == 0:
		return
	craft_mats = max(0, craft_mats + n)
	materials_changed.emit(craft_mats)
	save_game()

## Applies the drops for killing a stage-N monster: gold (always) + a chance at a
## crafting material. Returns {gold:int, material:bool} for on-screen feedback.
## Rolls a kill reward without applying it — the hunt spawns ground pickups that
## grant it on collection. {gold:int, material:bool}
func roll_monster_drop(stage: int) -> Dictionary:
	# Dungeon kills pay better on both axes (the run satchel carries the risk).
	if run_active:
		return {
			"gold": int(GameConfig.monster_gold(stage) * GameConfig.DUNGEON_GOLD_MULT),
			"material": randf() < GameConfig.DUNGEON_MAT_DROP_CHANCE,
		}
	return {
		"gold": GameConfig.monster_gold(stage),
		"material": randf() < GameConfig.MAT_DROP_CHANCE,
	}

## Applies a rolled drop (pickup reached the player — or the despawn failsafe).
func grant_monster_drop(drop: Dictionary) -> void:
	# Mid-run drops fill the satchel instead of the wallet (banked at run end).
	# This also covers DropPickup's _exit_tree failsafe for uncollected pickups.
	if run_active:
		run_gold += int(drop["gold"])
		if drop["material"]:
			run_mats += 1
		run_changed.emit(run_gold, run_mats)
		return
	_suppress_save = true
	add_gold(int(drop["gold"]))
	if drop["material"]:
		craft_mats += 1
	_suppress_save = false
	if drop["material"]:
		materials_changed.emit(craft_mats)
	save_game()

# ---------------------------------------------------------------------------
# Dungeon run (런 정산형 주머니)
# ---------------------------------------------------------------------------
func start_dungeon_run() -> void:
	if run_active:
		return
	run_active = true
	run_gold = 0
	run_mats = 0
	run_started.emit()
	run_changed.emit(0, 0)

## Banks the satchel and closes the run. reason: "retreat" (walked back out,
## keep 100%), "boss" (cleared — 100% + clear bonus), "death" (keep
## DUNGEON_DEATH_KEEP_PCT, rest is lost).
func end_dungeon_run(reason: String = "retreat") -> void:
	if not run_active:
		return
	var banked_gold: int = run_gold
	var banked_mats: int = run_mats
	match reason:
		"death":
			banked_gold = int(run_gold * GameConfig.DUNGEON_DEATH_KEEP_PCT)
			banked_mats = run_mats / 2
		"boss":
			banked_gold += GameConfig.DUNGEON_CLEAR_BONUS_GOLD
			banked_mats += GameConfig.DUNGEON_CLEAR_BONUS_MATS
	run_active = false
	run_gold = 0
	run_mats = 0
	_suppress_save = true
	add_gold(banked_gold)
	if banked_mats > 0:
		craft_mats += banked_mats
	_suppress_save = false
	if banked_mats > 0:
		materials_changed.emit(craft_mats)
	save_game()
	run_ended.emit(banked_gold, banked_mats, reason)
	run_changed.emit(0, 0)

## Roll + grant in one step (kept for tests / logic without pickup visuals).
func on_monster_killed(stage: int) -> Dictionary:
	var drop: Dictionary = roll_monster_drop(stage)
	grant_monster_drop(drop)
	return drop

# ---------------------------------------------------------------------------
# Crafting: 부위별 — 상점 장비 +11 (이상) + 제작연마제 → 중급(내부 supreme) 장비
# ---------------------------------------------------------------------------
## Finds an eligible same-type piece to consume (highest level first), or null.
func _craft_source(type: String) -> Equipment:
	var best: Equipment = null
	for eq in inventory:
		if eq.type == type and eq.grade == GameConfig.CRAFT_REQ_GRADE \
				and eq.level >= GameConfig.CRAFT_REQ_LEVEL:
			if best == null or eq.level > best.level:
				best = eq
	return best

func can_craft(type: String) -> bool:
	return type in GameConfig.SHOP_TYPES \
		and craft_mats >= GameConfig.CRAFT_MAT_COST and _craft_source(type) != null

## Consumes the source piece + materials and produces the crafted (internally
## supreme) item of the same type (starts at +12). Returns {ok:bool, reason:String}.
func craft_supreme(type: String) -> Dictionary:
	if type not in GameConfig.SHOP_TYPES:
		return {"ok": false, "reason": "bad_type"}
	if craft_mats < GameConfig.CRAFT_MAT_COST:
		return {"ok": false, "reason": "no_material"}
	var src: Equipment = _craft_source(type)
	if src == null:
		return {"ok": false, "reason": "no_source"}
	var old_max: int = max_hp()
	_suppress_save = true
	if is_equipped(src):
		equipped.erase(src.type)
	inventory.erase(src)
	craft_mats -= GameConfig.CRAFT_MAT_COST
	var made := Equipment.new(type, GameConfig.GRADE_SUPREME)
	inventory.append(made)
	_suppress_save = false
	# Consuming a worn armor piece changes max HP — mirror the equip-change rule.
	if max_hp() != old_max:
		if hp > 0:
			hp = clampi(hp + (max_hp() - old_max), 1, max_hp())
		hp_changed.emit(hp, max_hp())
	materials_changed.emit(craft_mats)
	inventory_changed.emit()
	_recompute_enhance_sum()
	save_game()
	return {"ok": true, "reason": ""}

## Sword wrappers (legacy callers / tests).
func can_craft_supreme() -> bool:
	return can_craft(GameConfig.TYPE_SWORD)

func craft_supreme_sword() -> Dictionary:
	return craft_supreme(GameConfig.TYPE_SWORD)

# ---------------------------------------------------------------------------
# Save / load
# ---------------------------------------------------------------------------
func to_dict() -> Dictionary:
	var inv: Array = []
	for eq in inventory:
		inv.append(eq.to_dict())
	# equipped stored as list of inventory indices for stable references.
	var eq_idx: Dictionary = {}
	for slot in equipped:
		eq_idx[slot] = inventory.find(equipped[slot])
	return {
		"gold": gold,
		"inventory": inv,
		"equipped": eq_idx,
		"box_counts": box_counts,
		"craft_mats": craft_mats,
		"potions": potions,
		"equipped_potion": equipped_potion,
		"goal_reached": _goal_already_reached,
	}

func save_game() -> void:
	if _suppress_save:
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f == null:
		push_warning("GameState: could not open save file for writing")
		return
	f.store_string(JSON.stringify(to_dict(), "\t"))
	f.close()

func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		_reset_defaults()
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		_reset_defaults()
		return
	var text: String = f.get_as_text()
	f.close()
	var data: Variant = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY:
		_reset_defaults()
		return
	_suppress_save = true
	gold = int(data.get("gold", GameConfig.INITIAL_GOLD))
	inventory = []
	for d in data.get("inventory", []):
		inventory.append(Equipment.from_dict(d))
	equipped = {}
	var eq_idx: Dictionary = data.get("equipped", {})
	for slot in eq_idx:
		var i: int = int(eq_idx[slot])
		if i >= 0 and i < inventory.size():
			equipped[slot] = inventory[i]
	box_counts = {}
	for k in data.get("box_counts", {}):
		box_counts[k] = int(data["box_counts"][k])
	craft_mats = int(data.get("craft_mats", 0))
	potions = {"small": 0, "medium": 0, "large": 0}
	var pot: Dictionary = data.get("potions", {})
	for k in potions:
		potions[k] = mini(maxi(int(pot.get(k, 0)), 0), GameConfig.POTION_MAX)
	equipped_potion = str(data.get("equipped_potion", ""))
	if not GameConfig.POTIONS.has(equipped_potion):
		equipped_potion = ""
	_goal_already_reached = bool(data.get("goal_reached", false))
	_suppress_save = false
	_emit_all()

func _reset_defaults() -> void:
	_suppress_save = true
	gold = GameConfig.INITIAL_GOLD
	inventory = []
	equipped = {}
	box_counts = {}
	craft_mats = 0
	potions = {"small": 0, "medium": 0, "large": 0}
	equipped_potion = ""
	hp = max_hp()
	_goal_already_reached = false
	_suppress_save = false
	_emit_all()

func _emit_all() -> void:
	gold_changed.emit(gold)
	inventory_changed.emit()
	box_counts_changed.emit()
	materials_changed.emit(craft_mats)
	potions_changed.emit()
	hp_changed.emit(hp, max_hp())
	enhance_sum_changed.emit(get_enhance_sum(), GameConfig.GOAL)

## Wipes the save (used by tests / a debug reset).
func reset_progress() -> void:
	_reset_defaults()
	save_game()
