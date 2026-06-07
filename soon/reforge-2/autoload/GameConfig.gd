extends Node
## Static game-economy constants and helper math, ported from docs/BUSINESS.md
## and the original Reforge JS prototype. Registered as an autoload singleton.

# --- Goal / economy ---------------------------------------------------------
const GOAL: int = 80          # 강화합(enhance sum) target to clear
const INITIAL_GOLD: int = 10_000_000   # 테스트용 초기자본 (1000만 골드)
const GOLD_CAP: int = 99_999_999   # max gold the player can ever hold

# --- Inventory / player ------------------------------------------------------
const INVENTORY_MAX: int = 16      # equipment slots (whetstone is tracked separately)
const BASE_HP: int = 1000          # player base HP before equipped-gear bonuses

# --- Equipment types --------------------------------------------------------
const TYPE_SWORD := "sword"
const TYPE_SHIELD := "shield"
const TYPE_ARMOR := "armor"
const TYPE_BOOTS := "boots"
const TYPE_HELMET := "helmet"
const SHOP_TYPES: Array[String] = [TYPE_SWORD, TYPE_SHIELD, TYPE_ARMOR, TYPE_BOOTS]
# helmet is raid-drop only (out of scope this milestone) -> not in shop.

# --- Grades -----------------------------------------------------------------
const GRADE_LOW := "low"
const GRADE_MID := "mid"
const GRADE_HIGH := "high"
const GRADE_SUPREME := "supreme"
# Only High-grade gear is sold: gold comes easily, so nobody bought the cheaper
# Low/Mid tiers. Prices for all grades stay defined (used elsewhere / box rewards).
const SHOP_GRADES: Array[String] = [GRADE_HIGH]

const SHOP_PRICE := {
	GRADE_LOW: 50_000,
	GRADE_MID: 500_000,
	GRADE_HIGH: 5_000_000,
}

# --- Enhancement ------------------------------------------------------------
# Success-chance table for +0->+1, +1->+2, ... (percent). Beyond the table the
# chance stays at 1%.
const ENHANCE_TABLE: Array[int] = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 1]
# Higher grades start further left in the table (easier early enhancement).
const GRADE_START_INDEX := {
	GRADE_HIGH: 0,
	GRADE_SUPREME: 0,
	GRADE_MID: 4,
	GRADE_LOW: 9,
}
# Last table index whose chance is still > 30% (Easy Zone). chance there = 40%.
const EASY_END_INDEX: int = 6
const EASY_STEP_COST: int = 5_000      # (globalIndex+1) * this, in Easy Zone
const HARD_STEP_COST: int = 100_000    # relativeLevel * this, in Hard Zone

# --- Supreme (separate table) ----------------------------------------------
const SUPREME_START_LEVEL: int = 12
const SUPREME_TABLE: Array[int] = [10, 7, 5, 3, 1]
const SUPREME_STEP_COST: int = 1_000_000  # level * this

# --- Gambling boxes ---------------------------------------------------------
# id -> {label, price, max_reward}. Boxes can be drawn any number of times;
# MAX_DRAW is how many can be pulled in a single batch (the x10 button).
const BOXES := {
	"free":  {"label": "무료 상자",  "price": 0,      "max_reward": 100},
	"cheap": {"label": "1천G 상자",  "price": 1_000,  "max_reward": 10_000},
	"mid":   {"label": "1만G 상자",  "price": 10_000, "max_reward": 100_000},
	"big":   {"label": "5만G 상자",  "price": 50_000, "max_reward": 500_000},
}
const BOX_ORDER: Array[String] = ["free", "cheap", "mid", "big"]
const MAX_DRAW: int = 10  # boxes pullable at once (x10)

# --- Hunting ground / monsters ----------------------------------------------
# Balance anchor: a high-grade sword at +10 deals equip_power(high,10)=420, and a
# stage-1 monster should take ~3 such hits -> base HP 1260. HP scales linearly by
# stage; higher stages need a stronger (more enhanced) weapon for the same speed.
const MONSTER_MAX_STAGE: int = 5
const MONSTERS_PER_WAVE: int = 8
const MONSTER_HP_BASE: int = 1260        # = 3 * equip_power("high", 10)
const MONSTER_GOLD_BASE: int = 20_000    # gold per kill, scaled by stage (tunable)
const MAT_DROP_CHANCE: float = 0.20      # 제작연마제 drop probability per kill
# Bare-hand damage when no sword is equipped, so attacks always do *something*
# (a stage-1 monster still takes ~42 hits — a real weapon is far faster).
const UNARMED_POWER: int = 30

# --- Dungeon (던전: 고위험 고수익 런) -----------------------------------------
# Finite-wave rooms behind locked gates; drops accumulate in a run satchel that
# banks on boss clear (+bonus) or walking back out, and halves on death. The
# satchel is runtime-only — force-quitting mid-run forfeits it (matches HP's
# never-persisted rule and keeps quitting from ever beating dying).
const DUNGEON_ROOM_STAGES: Array[int] = [3, 4, 5]  # room 1/2/3 monster stage
const DUNGEON_WAVES_PER_ROOM: int = 2
const DUNGEON_MONSTERS_PER_WAVE: int = 6
const DUNGEON_GOLD_MULT: float = 2.0           # kill gold vs same-stage hunt kill
const DUNGEON_MAT_DROP_CHANCE: float = 0.35    # vs hunt MAT_DROP_CHANCE 0.20
const DUNGEON_DEATH_KEEP_PCT: float = 0.5      # satchel fraction banked on death
const DUNGEON_CLEAR_BONUS_GOLD: int = 2_000_000
const DUNGEON_CLEAR_BONUS_MATS: int = 3        # guaranteed 숫돌 on boss clear
const DUNGEON_BOSS_GOLD_MULT: int = 15         # x monster_gold(5), as pickups

# --- Potions ------------------------------------------------------------------
# id -> {label, heal_pct (fraction of max HP restored), price}. Sold at the potion
# shop; usable in the hunting ground (quick-use key consumes smallest first).
const POTIONS := {
	"small":  {"label": "소형 물약", "heal_pct": 0.30, "price": 5_000},
	"medium": {"label": "중형 물약", "heal_pct": 0.60, "price": 20_000},
	"large":  {"label": "대형 물약", "heal_pct": 1.00, "price": 50_000},
}
const POTION_ORDER: Array[String] = ["small", "medium", "large"]
const POTION_MAX: int = 99         # per-kind ownership cap (the shop blocks past it)
const POTION_COOLDOWN: float = 3.0 # seconds between drinks (shared across kinds)

func potion_icon_path(potion_id: String) -> String:
	return "res://assets/items/potion_%s.png" % potion_id

# --- Player damage / death ----------------------------------------------------
# Contact damage scales linearly with monster stage and is mitigated by defense
# with a 100/(100+def) curve. End-game defense gets huge (3+ pieces x equip_power),
# which used to crush hits to ~1 — DAMAGE_FLOOR_PCT guarantees every touch still
# lands a visible chunk, so gear helps but never trivialises contact.
const MONSTER_DAMAGE_BASE: int = 150
const DAMAGE_FLOOR_PCT: float = 0.25     # min fraction of raw damage that lands
const PLAYER_IFRAME_TIME: float = 0.5    # invincibility window after a hit (s)

## Raw contact damage of a stage-N monster.
func monster_damage(stage: int) -> int:
	return MONSTER_DAMAGE_BASE * clampi(stage, 1, MONSTER_MAX_STAGE)

## Applies the defense curve to raw damage (floored at DAMAGE_FLOOR_PCT of raw,
## and never below 1).
func mitigated_damage(raw: int, defense: int) -> int:
	var curved: int = int(round(float(raw) * 100.0 / (100.0 + float(maxi(defense, 0)))))
	return maxi(maxi(curved, int(ceil(float(raw) * DAMAGE_FLOOR_PCT))), 1)

# --- Crafting ---------------------------------------------------------------
const MATERIAL_LABEL := "숫돌"
const CRAFT_REQ_GRADE := GRADE_HIGH      # consumed sword grade for supreme craft
const CRAFT_REQ_LEVEL: int = 11          # required enhancement level (>=) to craft
const CRAFT_MAT_COST: int = 1            # materials consumed per craft

# --- Equipment stat model (cosmetic display) --------------------------------
const GRADE_BASE_POWER := {GRADE_LOW: 5, GRADE_MID: 25, GRADE_HIGH: 120, GRADE_SUPREME: 400}
const PER_LEVEL_POWER := {GRADE_LOW: 2, GRADE_MID: 8, GRADE_HIGH: 30, GRADE_SUPREME: 80}

# --- Movement stats -----------------------------------------------------------
# Boots enhancement grants move speed: +1% per level, capped so it stays a nice
# perk rather than a balance problem. Dash range is the helmet's future stat
# (raid drop) — only the hook exists for now.
const BOOTS_SPEED_PER_LEVEL: float = 0.01
const BOOTS_SPEED_MAX_BONUS: float = 0.15

## Move-speed bonus fraction for a boots enhancement level (0.0 ~ MAX).
func boots_speed_bonus(level: int) -> float:
	return minf(maxi(level, 0) * BOOTS_SPEED_PER_LEVEL, BOOTS_SPEED_MAX_BONUS)

# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------
# Display remap (stats/economy/saves untouched): the first town only releases
# the bottom of the naming ladder — shop gear ("high" internally) shows with NO
# grade word, crafted gear ("supreme") shows as 중급. 상급/최상급 names are
# reserved for future content.
func grade_label(grade: String) -> String:
	match grade:
		GRADE_LOW: return "하급"
		GRADE_MID: return "중급"
		GRADE_HIGH: return ""
		GRADE_SUPREME: return "중급"
	return grade

## "{grade} {type}" with no leading space when the grade label is empty
## (shop-tier gear reads as just "검", crafted as "중급 검").
func type_grade_name(type: String, grade: String) -> String:
	var g: String = grade_label(grade)
	return ("%s %s" % [g, type_label(type)]) if g != "" else type_label(type)

func type_label(type: String) -> String:
	match type:
		TYPE_SWORD: return "검"
		TYPE_SHIELD: return "방패"
		TYPE_ARMOR: return "갑옷"
		TYPE_BOOTS: return "부츠"
		TYPE_HELMET: return "투구"
	return type

# Grade -> filename suffix for the tiered item/weapon icons (Fantasy RPG icon
# pack tiers: low=구리, mid=강철, high=황금, supreme=속성/엘프). Display remap:
# shop gear (high) uses the copper art, crafted gear (supreme) the steel art —
# the gold/elemental icons are reserved alongside the 상급/최상급 names.
const GRADE_ICON_SUFFIX := {
	GRADE_LOW: "low", GRADE_MID: "mid", GRADE_HIGH: "low", GRADE_SUPREME: "mid",
}

## Icon for a piece of equipment of (type, grade) — e.g. res://assets/items/sword_high.png.
func type_grade_icon_path(type: String, grade: String) -> String:
	var g: String = String(GRADE_ICON_SUFFIX.get(grade, "low"))
	return "res://assets/items/%s_%s.png" % [type, g]

## Back-compat: a representative (mid-grade) icon for a type with no grade context.
func type_icon_path(type: String) -> String:
	return type_grade_icon_path(type, GRADE_MID)

## The held-sword sprite the player wields, keyed by the equipped sword's grade.
func weapon_icon_path(grade: String) -> String:
	var g: String = String(GRADE_ICON_SUFFIX.get(grade, "low"))
	return "res://assets/weapons/sword_%s.png" % g

func coin_icon_path() -> String:
	return "res://assets/items/coin.png"

func material_icon_path() -> String:
	return "res://assets/items/material.png"

## Gambling-box chest icon (box id -> res://assets/items/box_<id>.png).
func box_icon_path(box_id: String) -> String:
	return "res://assets/items/box_%s.png" % box_id

# ---------------------------------------------------------------------------
# Enhancement math
# ---------------------------------------------------------------------------
func _table_chance(index: int) -> int:
	if index < ENHANCE_TABLE.size():
		return ENHANCE_TABLE[index]
	return 1  # fixed 1% beyond the table

## Success chance (percent) to take `grade` equipment from `level` to level+1.
func enhance_chance(grade: String, level: int) -> int:
	if grade == GRADE_SUPREME:
		var si: int = level - SUPREME_START_LEVEL
		if si < 0:
			si = 0
		if si < SUPREME_TABLE.size():
			return SUPREME_TABLE[si]
		return 1
	var gi: int = int(GRADE_START_INDEX.get(grade, 0)) + level
	return _table_chance(gi)

## Gold cost to attempt the next enhancement of `grade` equipment at `level`.
## 2-Zone model (docs/BUSINESS.md): Easy Zone (chance>30) is cheap and scales
## with the *global difficulty index*; Hard Zone (chance<=30) jumps ~20x.
func enhance_cost(grade: String, level: int) -> int:
	if grade == GRADE_SUPREME:
		return level * SUPREME_STEP_COST
	var gi: int = int(GRADE_START_INDEX.get(grade, 0)) + level
	if _table_chance(gi) > 30:
		return (gi + 1) * EASY_STEP_COST
	# Hard Zone: previous (last) Easy step cost + relative steps into hard zone.
	var prev_easy: int = (EASY_END_INDEX + 1) * EASY_STEP_COST
	var rel_level: int = gi - EASY_END_INDEX   # 1-based into the hard zone
	return prev_easy + rel_level * HARD_STEP_COST

func is_max_enhanced(_grade: String, _level: int) -> bool:
	# No hard cap in the original; enhancement can always be attempted (1%).
	return false

# ---------------------------------------------------------------------------
# Gambling math
# ---------------------------------------------------------------------------
## Reward = floor(rand^2 * max_reward) — house edge, low payouts dominate.
func box_reward(max_reward: int) -> int:
	var r: float = randf()
	return int(floor(r * r * float(max_reward)))

# ---------------------------------------------------------------------------
# Monster math
# ---------------------------------------------------------------------------
## Total HP of a stage-N monster (linear: base * stage).
func monster_hp(stage: int) -> int:
	return MONSTER_HP_BASE * clampi(stage, 1, MONSTER_MAX_STAGE)

## Gold dropped per kill at the given stage (linear).
func monster_gold(stage: int) -> int:
	return MONSTER_GOLD_BASE * clampi(stage, 1, MONSTER_MAX_STAGE)

# ---------------------------------------------------------------------------
# Stat display helpers
# ---------------------------------------------------------------------------
func equip_power(grade: String, level: int) -> int:
	return int(GRADE_BASE_POWER.get(grade, 0)) + level * int(PER_LEVEL_POWER.get(grade, 0))

## Returns a short stat string for an equipment type/grade/level.
func stat_text(type: String, grade: String, level: int) -> String:
	var p: int = equip_power(grade, level)
	if type == TYPE_SWORD:
		return "공격력 +%d" % p
	if type == TYPE_BOOTS:
		var spd: int = int(round(boots_speed_bonus(level) * 100.0))
		return "방어력 +%d  체력 +%d  이속 +%d%%" % [p, p * 2, spd]
	return "방어력 +%d  체력 +%d" % [p, p * 2]
