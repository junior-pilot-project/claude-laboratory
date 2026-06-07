extends RefCounted
## Headless logic tests for the core economy loop. Invoked by Main when the
## game is launched with `-- --test`. Exercises GameConfig math and GameState
## buy/enhance/equip/gamble/save-load. Returns the number of failures.

var _fail: int = 0
var _pass: int = 0

func _check(cond: bool, msg: String) -> void:
	if cond:
		_pass += 1
	else:
		_fail += 1
		print("  [FAIL] ", msg)

func _eq(a, b, msg: String) -> void:
	_check(a == b, "%s  (got %s, want %s)" % [msg, str(a), str(b)])

func _eq_f(a: float, b: float, msg: String) -> void:
	_check(is_equal_approx(a, b), "%s  (got %s, want %s)" % [msg, str(a), str(b)])

## Test baseline: wipe progress and start from zero gold, so the economy tests are
## independent of the (tunable) INITIAL_GOLD starting capital.
func _reset() -> void:
	GameState.reset_progress()
	GameState.gold = 0

func run() -> int:
	print("=== reforge-2 logic tests ===")
	_test_enhance_chance()
	_test_enhance_cost()
	_test_box_reward()
	_test_buy_and_inventory()
	_test_gold_cap()
	_test_inventory_cap()
	_test_delete_equipment()
	_test_max_hp()
	_test_enhance_flow()
	_test_equip_and_sum()
	_test_gambling_limits()
	_test_monster_math()
	_test_kill_reward()
	_test_craft()
	_test_labels()
	_test_move_speed()
	_test_hunt_persistence()
	_test_save_load()
	_test_goal()
	_test_player_damage()
	_test_monster_damage()
	_test_potions()
	_test_dungeon_run()
	_test_cam_zoom()
	print("=== result: %d passed, %d failed ===" % [_pass, _fail])
	return _fail

func _test_enhance_chance() -> void:
	print("- enhance_chance")
	_eq(GameConfig.enhance_chance("high", 0), 100, "high+0")
	_eq(GameConfig.enhance_chance("mid", 0), 60, "mid+0")
	_eq(GameConfig.enhance_chance("low", 0), 10, "low+0")
	_eq(GameConfig.enhance_chance("high", 7), 30, "high+7")
	_eq(GameConfig.enhance_chance("high", 20), 1, "high beyond table -> 1%")
	_eq(GameConfig.enhance_chance("supreme", 12), 10, "supreme+12")
	_eq(GameConfig.enhance_chance("supreme", 16), 1, "supreme beyond -> 1%")

func _test_enhance_cost() -> void:
	print("- enhance_cost")
	_eq(GameConfig.enhance_cost("high", 0), 5_000, "high+0 easy")
	_eq(GameConfig.enhance_cost("high", 6), 35_000, "high+6 last easy")
	_eq(GameConfig.enhance_cost("high", 7), 135_000, "high+7 first hard")
	_eq(GameConfig.enhance_cost("mid", 0), 25_000, "mid+0 easy (gi=4)")
	_eq(GameConfig.enhance_cost("low", 0), 335_000, "low+0 hard (gi=9)")
	_eq(GameConfig.enhance_cost("supreme", 12), 12_000_000, "supreme+12")

func _test_box_reward() -> void:
	print("- box_reward distribution (house edge)")
	seed(12345)
	var max_r := 500_000
	var total := 0
	var n := 4000
	var worst := 0
	for i in n:
		var r := GameConfig.box_reward(max_r)
		_check(r >= 0 and r <= max_r, "reward in range")
		total += r
		worst = max(worst, r)
	var mean := float(total) / float(n)
	# rand^2 expectation = 1/3 of max -> mean should be well under half.
	_check(mean < float(max_r) * 0.5, "mean below half max (house edge), got %d" % int(mean))
	_check(worst <= max_r, "never exceeds max reward")

func _test_buy_and_inventory() -> void:
	print("- buy / inventory")
	_reset()
	_eq(GameState.gold, 0, "initial gold 0")
	_check(GameState.buy_equipment("sword", "low") == null, "cannot buy with 0 gold")
	GameState.add_gold(60_000)
	var eq := GameState.buy_equipment("sword", "low")
	_check(eq != null, "buy succeeds after funding")
	_eq(GameState.inventory.size(), 1, "inventory has 1")
	_eq(GameState.gold, 10_000, "gold deducted (60k-50k)")

func _test_gold_cap() -> void:
	print("- gold cap (99,999,999)")
	_reset()
	GameState.add_gold(GameConfig.GOLD_CAP)
	_eq(GameState.gold, GameConfig.GOLD_CAP, "gold reaches cap")
	GameState.add_gold(1_000_000)
	_eq(GameState.gold, GameConfig.GOLD_CAP, "gold clamped at cap (add_gold)")
	# Box rewards also clamp: at the cap a winning draw cannot push gold higher.
	var batch := GameState.open_boxes("free", 10)
	_check(batch["ok"], "free draw ok at cap")
	_eq(GameState.gold, GameConfig.GOLD_CAP, "gold clamped at cap (box reward)")
	_reset()

func _test_inventory_cap() -> void:
	print("- inventory cap (blocks buying when full)")
	_reset()
	GameState.add_gold(GameConfig.INVENTORY_MAX * 50_000)
	for i in GameConfig.INVENTORY_MAX:
		_check(GameState.buy_equipment("sword", "low") != null, "buy %d fits" % i)
	_eq(GameState.inventory.size(), GameConfig.INVENTORY_MAX, "inventory at capacity")
	_check(GameState.inventory_full(), "inventory_full() true at cap")
	GameState.add_gold(50_000)
	_check(GameState.buy_equipment("sword", "low") == null, "buy blocked when full")
	_eq(GameState.inventory.size(), GameConfig.INVENTORY_MAX, "size unchanged after blocked buy")
	# Whetstone never counts against the cap.
	GameState.add_material(3)
	_check(GameState.inventory_full(), "whetstone does not free a slot")
	_reset()

func _test_delete_equipment() -> void:
	print("- delete equipment (discard, auto-unequip)")
	_reset()
	var a := Equipment.new("sword", "high", 5)
	GameState.inventory.append(a)
	GameState.equip(a)
	_eq(GameState.get_enhance_sum(), 5, "sum reflects equipped sword")
	_check(GameState.delete_equipment(a), "delete returns true")
	_eq(GameState.inventory.size(), 0, "item removed from inventory")
	_check(not GameState.is_equipped(a), "deleted item is unequipped")
	_eq(GameState.get_enhance_sum(), 0, "enhance sum back to 0")
	_check(not GameState.delete_equipment(a), "deleting a missing item returns false")
	_reset()

func _test_max_hp() -> void:
	print("- max HP (base + equipped gear)")
	_reset()
	_eq(GameState.max_hp(), GameConfig.BASE_HP, "no gear -> base HP")
	var armor := Equipment.new("armor", "high", 0)  # equip_power(high,0)=120 -> HP +240
	GameState.inventory.append(armor)
	GameState.equip(armor)
	_eq(GameState.max_hp(), GameConfig.BASE_HP + 240, "armor adds equip_power*2 HP")
	var sword := Equipment.new("sword", "high", 10)
	GameState.inventory.append(sword)
	GameState.equip(sword)
	_eq(GameState.max_hp(), GameConfig.BASE_HP + 240, "weapon does not add HP")
	# Equip/unequip shifts current HP by the max delta (missing HP stays constant).
	_eq(GameState.hp, GameState.max_hp(), "equip at full stays full")
	GameState.take_player_damage(100)
	var missing: int = GameState.max_hp() - GameState.hp
	GameState.toggle_equip(armor)   # off: max -240, hp follows
	_eq(GameState.max_hp() - GameState.hp, missing, "missing HP kept on unequip")
	GameState.toggle_equip(armor)   # back on: max +240, hp follows
	_eq(GameState.max_hp() - GameState.hp, missing, "missing HP kept on re-equip")
	_reset()

func _test_enhance_flow() -> void:
	print("- enhance flow")
	_reset()
	GameState.add_gold(10_000_000)
	var eq := GameState.buy_equipment("sword", "high")  # high+0 = 100% success
	var res := GameState.try_enhance(eq)
	_check(res["ok"], "enhance attempted")
	_check(res["success"], "high+0 (100%) always succeeds")
	_eq(eq.level, 1, "level raised to 1")
	# Unaffordable case
	_reset()
	GameState.add_gold(100)
	var eq2 := Equipment.new("sword", "high", 7)  # cost 135,000
	GameState.inventory.append(eq2)
	var res2 := GameState.try_enhance(eq2)
	_check(not res2["ok"], "enhance blocked when broke")
	_eq(res2["reason"], "no_gold", "reason no_gold")

func _test_equip_and_sum() -> void:
	print("- equip / enhance sum")
	_reset()
	var a := Equipment.new("sword", "high", 5)
	var b := Equipment.new("shield", "high", 3)
	GameState.inventory.append(a)
	GameState.inventory.append(b)
	_eq(GameState.get_enhance_sum(), 0, "sum 0 before equip")
	GameState.equip(a)
	GameState.equip(b)
	_eq(GameState.get_enhance_sum(), 8, "sum = 5+3")
	GameState.toggle_equip(a)  # unequip
	_eq(GameState.get_enhance_sum(), 3, "sum = 3 after unequip sword")

func _test_gambling_limits() -> void:
	print("- gambling multi-draw (uncapped)")
	_reset()
	# x10 free draw works and there is no purchase cap.
	var batch := GameState.open_boxes("free", 10)
	_check(batch["ok"], "free x10 ok")
	_eq(int(batch["count"]), 10, "drew 10")
	_eq((batch["rewards"] as Array).size(), 10, "10 reward rolls")
	_eq(GameState.box_count("free"), 10, "free count = 10")
	var again := GameState.open_boxes("free", 10)
	_check(again["ok"], "free x10 again (no cap)")
	_eq(GameState.box_count("free"), 20, "free count accumulates past 10")
	# Count is clamped to MAX_DRAW.
	_reset()
	var clamped := GameState.open_boxes("free", 999)
	_eq(int(clamped["count"]), GameConfig.MAX_DRAW, "draw count clamped to MAX_DRAW")
	# Paid box requires the full batch price up front.
	_reset()
	var broke := GameState.open_boxes("big", 10)
	_check(not broke["ok"] and broke["reason"] == "no_gold", "big x10 needs gold")
	GameState.add_gold(50_000 * 10)
	var rich := GameState.open_boxes("big", 10)
	_check(rich["ok"], "big x10 with funds ok")
	_eq(int(rich["spent"]), 50_000 * 10, "spent full batch price")

func _test_save_load() -> void:
	print("- save / load persistence")
	_reset()
	GameState.add_gold(123_456)
	var eq := GameState.buy_equipment("armor", "mid")  # costs 500k? no -> need funds
	# armor mid costs 500,000; ensure enough by topping up
	GameState.add_gold(500_000)
	eq = GameState.buy_equipment("armor", "mid")
	eq.level = 4
	GameState.equip(eq)
	GameState.box_counts["cheap"] = 3
	GameState.save_game()
	var saved_gold := GameState.gold
	var saved_sum := GameState.get_enhance_sum()
	# Corrupt in-memory state then reload from disk.
	GameState.gold = -1
	GameState.inventory = []
	GameState.equipped = {}
	GameState.load_game()
	_eq(GameState.gold, saved_gold, "gold restored")
	_eq(GameState.inventory.size(), 1, "inventory restored")
	_eq(GameState.get_enhance_sum(), saved_sum, "equipped sum restored")
	_eq(int(GameState.box_counts.get("cheap", 0)), 3, "box counts restored")

func _test_monster_math() -> void:
	print("- monster math / weapon power")
	_eq(GameConfig.monster_hp(1), 1260, "stage1 hp = 1260 (3-hit anchor)")
	_eq(GameConfig.monster_hp(3), 3780, "stage3 hp linear")
	_eq(GameConfig.monster_hp(99), GameConfig.MONSTER_HP_BASE * GameConfig.MONSTER_MAX_STAGE,
		"hp clamped to max stage")
	_eq(GameConfig.monster_gold(2), GameConfig.MONSTER_GOLD_BASE * 2, "gold scales by stage")
	_reset()
	_eq(GameState.weapon_power(), 0, "no weapon -> 0 power")
	var sw := Equipment.new("sword", "high", 10)
	GameState.inventory.append(sw)
	GameState.equip(sw)
	_eq(GameState.weapon_power(), 420, "high+10 power = 420")
	_reset()

func _test_kill_reward() -> void:
	print("- monster kill reward")
	_reset()
	var drop := GameState.on_monster_killed(2)
	_eq(GameState.gold, GameConfig.monster_gold(2), "kill adds stage gold")
	_eq(int(drop["gold"]), GameConfig.monster_gold(2), "drop reports gold")
	_check(drop.has("material"), "drop reports material flag")
	# Roll/grant split (ground pickups grant on collection, not on the kill).
	_reset()
	var rolled := GameState.roll_monster_drop(3)
	_eq(GameState.gold, 0, "roll alone grants nothing")
	GameState.grant_monster_drop({"gold": int(rolled["gold"]), "material": false})
	_eq(GameState.gold, GameConfig.monster_gold(3), "grant applies the rolled gold")
	GameState.grant_monster_drop({"gold": 0, "material": true})
	_eq(GameState.craft_mats, 1, "grant applies the material")
	_reset()

func _test_craft() -> void:
	print("- craft (per type)")
	# Every shop type crafts: a +11 source piece + a whetstone -> same-type supreme.
	for type in GameConfig.SHOP_TYPES:
		_reset()
		GameState.inventory.append(Equipment.new(type, "high", 11))
		_check(not GameState.can_craft(type), "%s: cannot craft without material" % type)
		var r0: Dictionary = GameState.craft_supreme(type)
		_check(not r0["ok"] and r0["reason"] == "no_material", "%s: blocked no material" % type)
		GameState.add_material(1)
		_check(GameState.can_craft(type), "%s: can craft" % type)
		var r1: Dictionary = GameState.craft_supreme(type)
		_check(r1["ok"], "%s: craft ok" % type)
		_eq(GameState.craft_mats, 0, "%s: material consumed" % type)
		_eq(GameState.inventory.size(), 1, "%s: source consumed, crafted added" % type)
		var made: Equipment = GameState.inventory[0]
		_eq(made.type, type, "%s: result keeps the type" % type)
		_eq(made.grade, "supreme", "%s: result grade" % type)
		_eq(made.level, GameConfig.SUPREME_START_LEVEL, "%s: starts at +12" % type)
	# Material present but only an under-leveled source -> no_source.
	_reset()
	GameState.add_material(1)
	GameState.inventory.append(Equipment.new("sword", "high", 10))
	var r2: Dictionary = GameState.craft_supreme("sword")
	_check(not r2["ok"] and r2["reason"] == "no_source", "blocked: no eligible source")
	# Helmet is not craftable (raid drop).
	var r3: Dictionary = GameState.craft_supreme("helmet")
	_check(not r3["ok"] and r3["reason"] == "bad_type", "helmet rejected")
	# Sword wrappers still work.
	GameState.inventory.append(Equipment.new("sword", "high", 11))
	_check(GameState.can_craft_supreme(), "wrapper can_craft_supreme")
	_check(GameState.craft_supreme_sword()["ok"], "wrapper craft_supreme_sword")
	_reset()

func _test_labels() -> void:
	print("- grade label/icon remap")
	_eq(GameConfig.grade_label("high"), "", "high label hidden")
	_eq(GameConfig.grade_label("supreme"), "중급", "supreme shows 중급")
	_eq(GameConfig.type_grade_name("sword", "high"), "검", "no leading space")
	_eq(GameConfig.type_grade_name("sword", "supreme"), "중급 검", "crafted name")
	_eq(Equipment.new("sword", "high", 5).display_name(), "검 +5", "shop display name")
	_eq(Equipment.new("sword", "supreme").display_name(), "중급 검 +12", "crafted display name")
	_check(GameConfig.type_grade_icon_path("sword", "high").ends_with("sword_low.png"),
		"shop tier uses copper icon")
	_check(GameConfig.type_grade_icon_path("sword", "supreme").ends_with("sword_mid.png"),
		"crafted tier uses steel icon")
	_check(GameConfig.weapon_icon_path("high").ends_with("sword_low.png"),
		"held sword follows the remap")

func _test_move_speed() -> void:
	print("- move speed / dash multipliers")
	_reset()
	_eq_f(GameState.move_speed_mult(), 1.0, "no boots -> 1.0")
	var boots := Equipment.new("boots", "high", 7)
	GameState.inventory.append(boots)
	GameState.equip(boots)
	_eq_f(GameState.move_speed_mult(), 1.07, "boots +7 -> +7%")
	boots.level = 40
	_eq_f(GameState.move_speed_mult(), 1.15, "bonus caps at +15%")
	_eq_f(GameState.dash_mult(), 1.0, "dash hook stays 1.0 (helmet later)")
	_check("이속" in GameConfig.stat_text("boots", "high", 5), "boots stat text mentions 이속")
	_check("%" in GameConfig.stat_text("boots", "high", 5), "percent renders")
	_reset()

func _test_hunt_persistence() -> void:
	print("- craft_mats persistence")
	_reset()
	GameState.add_material(5)
	GameState.save_game()
	GameState.craft_mats = 0
	GameState.load_game()
	_eq(GameState.craft_mats, 5, "craft_mats restored")
	_reset()

func _test_goal() -> void:
	print("- goal reached")
	_reset()
	var reached := [false]
	GameState.goal_reached.connect(func(): reached[0] = true)
	var sword := Equipment.new("sword", "supreme", 80)
	GameState.inventory.append(sword)
	GameState.equip(sword)
	_check(GameState.check_goal(), "check_goal true at sum>=80")
	_check(reached[0], "goal_reached signal fired")
	_reset()

func _test_player_damage() -> void:
	print("- player damage / death / restore")
	_reset()
	_eq(GameState.hp, GameConfig.BASE_HP, "reset -> full base HP")
	# Mitigation curve: def 0 -> full damage; always at least 1.
	_eq(GameConfig.mitigated_damage(100, 0), 100, "def 0 -> raw")
	_eq(GameConfig.mitigated_damage(100, 100), 50, "def 100 -> half")
	_eq(GameConfig.mitigated_damage(100, 100_000),
		int(ceil(100.0 * GameConfig.DAMAGE_FLOOR_PCT)), "huge def floored at pct of raw")
	_eq(GameConfig.mitigated_damage(1, 10_000), 1, "damage floor of 1")
	var died := [false]
	GameState.player_died.connect(func(): died[0] = true)
	var lethal := GameState.take_player_damage(70)
	_check(not lethal, "one stage-1 touch is not lethal")
	_eq(GameState.hp, GameConfig.BASE_HP - 70, "hp dropped by mitigated dmg (def 0)")
	# Defense reduces the next hit.
	var armor := Equipment.new("armor", "high", 0)  # def 120
	GameState.inventory.append(armor)
	GameState.equip(armor)
	var before := GameState.hp
	GameState.take_player_damage(100)
	_eq(GameState.hp, before - GameConfig.mitigated_damage(100, 120), "armor mitigates")
	# Death at 0.
	lethal = GameState.take_player_damage(99_999_999)
	_check(lethal, "huge hit is lethal")
	_eq(GameState.hp, 0, "hp clamped at 0")
	_check(died[0], "player_died fired")
	_check(not GameState.take_player_damage(10), "no damage while dead")
	GameState.restore_hp()
	_eq(GameState.hp, GameState.max_hp(), "restore_hp -> full")
	# Unequipping armor clamps hp to the smaller max.
	GameState.toggle_equip(armor)
	_check(GameState.hp <= GameState.max_hp(), "hp clamped after unequip")
	_reset()

func _test_monster_damage() -> void:
	print("- monster contact damage scaling")
	_eq(GameConfig.monster_damage(1), GameConfig.MONSTER_DAMAGE_BASE, "stage1 base")
	_eq(GameConfig.monster_damage(3), GameConfig.MONSTER_DAMAGE_BASE * 3, "stage3 linear")
	_eq(GameConfig.monster_damage(99), GameConfig.MONSTER_DAMAGE_BASE * GameConfig.MONSTER_MAX_STAGE,
		"clamped to max stage")

func _test_potions() -> void:
	print("- potions: buy / use / quick-use / persistence")
	_reset()
	_eq(GameState.potion_count("small"), 0, "starts with none")
	_check(not GameState.buy_potion("small", 1), "cannot buy broke")
	_check(not GameState.buy_potion("bogus", 1), "unknown id rejected")
	GameState.add_gold(5_000 * 3 + 20_000)
	_check(GameState.buy_potion("small", 3), "buy small x3")
	_check(GameState.buy_potion("medium", 1), "buy medium x1")
	_eq(GameState.gold, 0, "gold fully spent")
	_eq(GameState.potion_count("small"), 3, "owns 3 small")
	# Use: heals heal_pct of max, clamped; no-op at full HP.
	_check(not GameState.use_potion("small"), "no use at full HP")
	GameState.take_player_damage(900)
	var hp_before := GameState.hp
	_check(GameState.use_potion("small"), "drink small")
	_eq(GameState.hp, mini(hp_before + int(ceil(0.30 * float(GameState.max_hp()))),
		GameState.max_hp()), "healed 30% of max")
	_eq(GameState.potion_count("small"), 2, "count decremented")
	# Cooldown: a second drink right away is blocked until POTION_COOLDOWN passes.
	_check(GameState.potion_cooldown_left() > 0.0, "cooldown running after drink")
	GameState.take_player_damage(300)
	_check(not GameState.use_potion("small"), "cooldown blocks next drink")
	GameState._potion_ready_at_ms = 0  # tests can't wait 3s — clear the gate
	# Quick-use prefers the smallest available.
	GameState.restore_hp()
	GameState.take_player_damage(300)
	_eq(GameState.use_best_potion(), "small", "best = small while owned")
	GameState._potion_ready_at_ms = 0
	GameState.potions["small"] = 0
	GameState.restore_hp()
	GameState.take_player_damage(300)
	_eq(GameState.use_best_potion(), "medium", "falls through to medium")
	GameState._potion_ready_at_ms = 0
	GameState.restore_hp()
	GameState.take_player_damage(300)
	_eq(GameState.use_best_potion(), "", "nothing left -> empty id")
	# Ownership cap: a buy that would exceed POTION_MAX is rejected outright.
	GameState.potions["small"] = GameConfig.POTION_MAX - 1
	GameState.add_gold(5_000 * 10)
	_check(not GameState.buy_potion("small", 2), "buy over cap rejected")
	_eq(GameState.potion_count("small"), GameConfig.POTION_MAX - 1, "count unchanged")
	_check(GameState.buy_potion("small", 1), "buy up to cap ok")
	_eq(GameState.potion_count("small"), GameConfig.POTION_MAX, "at cap")
	_check(not GameState.buy_potion("small", 1), "no buy at cap")
	# Equip: only the equipped potion drinks via the quick-slot; toggling works.
	_eq(GameState.equipped_potion, "", "starts unequipped")
	GameState.restore_hp()
	GameState.take_player_damage(300)
	_check(not GameState.use_equipped_potion(), "no equipped -> no drink")
	_check(GameState.toggle_equip_potion("small"), "equip small")
	_check(not GameState.toggle_equip_potion("bogus"), "unknown equip rejected")
	_eq(GameState.equipped_potion, "small", "bogus did not clobber")
	_check(GameState.use_equipped_potion(), "drink equipped")
	_check(not GameState.toggle_equip_potion("small"), "toggle off")
	_eq(GameState.equipped_potion, "", "unequipped")
	GameState.toggle_equip_potion("medium")
	# Persistence round-trip (counts + equipped id; loads clamp to the cap).
	GameState.potions = {"small": 7, "medium": 1, "large": 999}
	GameState.save_game()
	GameState.potions = {"small": 0, "medium": 0, "large": 0}
	GameState.equipped_potion = ""
	GameState.load_game()
	_eq(GameState.potion_count("small"), 7, "small restored")
	_eq(GameState.potion_count("large"), GameConfig.POTION_MAX, "load clamps to cap")
	_eq(GameState.equipped_potion, "medium", "equipped potion restored")
	_reset()

func _test_dungeon_run() -> void:
	print("- dungeon run satchel")
	_reset()
	# Config sanity: the dungeon must outpay the hunt to justify the risk.
	_eq(GameConfig.DUNGEON_ROOM_STAGES, [3, 4, 5] as Array[int], "room stage ramp")
	_check(GameConfig.DUNGEON_GOLD_MULT > 1.0, "dungeon gold multiplier > 1")
	_check(GameConfig.DUNGEON_MAT_DROP_CHANCE > GameConfig.MAT_DROP_CHANCE,
		"dungeon mat chance beats the hunt's")
	# Drops accumulate in the satchel, not the wallet.
	GameState.start_dungeon_run()
	_check(GameState.run_active, "run active after start")
	GameState.grant_monster_drop({"gold": 100, "material": true})
	_eq(GameState.gold, 0, "wallet untouched mid-run")
	_eq(GameState.run_gold, 100, "satchel holds the gold")
	_eq(GameState.run_mats, 1, "satchel holds the material")
	_eq(GameState.craft_mats, 0, "real mats untouched mid-run")
	# Rolls use the dungeon multipliers while a run is active.
	var roll := GameState.roll_monster_drop(3)
	_eq(int(roll["gold"]), int(GameConfig.monster_gold(3) * GameConfig.DUNGEON_GOLD_MULT),
		"mid-run roll applies gold mult")
	# Walking back out banks everything.
	var ended := [0, 0, ""]
	GameState.run_ended.connect(func(g, m, r): ended[0] = g; ended[1] = m; ended[2] = r)
	GameState.end_dungeon_run("retreat")
	_check(not GameState.run_active, "run over after retreat")
	_eq(GameState.gold, 100, "retreat banks 100% gold")
	_eq(GameState.craft_mats, 1, "retreat banks 100% mats")
	_eq(ended[2], "retreat", "run_ended reports reason")
	_eq(GameState.run_gold, 0, "satchel cleared")
	# Death keeps only DUNGEON_DEATH_KEEP_PCT (rounded down).
	_reset()
	GameState.start_dungeon_run()
	GameState.run_gold = 101
	GameState.run_mats = 3
	GameState.end_dungeon_run("death")
	_eq(GameState.gold, 50, "death banks half the gold (floored)")
	_eq(GameState.craft_mats, 1, "death banks half the mats (int div)")
	# Boss clear banks everything plus the bonus.
	_reset()
	GameState.start_dungeon_run()
	GameState.run_gold = 100
	GameState.run_mats = 1
	GameState.end_dungeon_run("boss")
	_eq(GameState.gold, 100 + GameConfig.DUNGEON_CLEAR_BONUS_GOLD, "boss banks gold + bonus")
	_eq(GameState.craft_mats, 1 + GameConfig.DUNGEON_CLEAR_BONUS_MATS, "boss banks mats + bonus")
	# Lethal damage settles the satchel before player_died fires.
	_reset()
	GameState.start_dungeon_run()
	GameState.run_gold = 100
	var run_on_death := [true]
	GameState.player_died.connect(func(): run_on_death[0] = GameState.run_active)
	GameState.take_player_damage(99_999_999)
	_check(not run_on_death[0], "run already settled when player_died fired")
	_eq(GameState.gold, 50, "lethal hit banked half the satchel")
	# The satchel never persists: a mid-run save/load forgets the run entirely.
	_reset()
	GameState.start_dungeon_run()
	GameState.run_gold = 777
	_check(not GameState.to_dict().has("run_gold"), "satchel absent from save data")
	GameState.save_game()
	GameState.load_game()
	_eq(GameState.gold, 0, "wallet unchanged by mid-run save/load")
	GameState.end_dungeon_run("retreat")  # leave no run behind for later tests
	_reset()

func _test_cam_zoom() -> void:
	print("- camera zoom multiplier clamp")
	var original: float = Audio.cam_zoom_mult
	Audio.set_cam_zoom(2.0)
	_eq(Audio.cam_zoom_mult, Audio.CAM_ZOOM_MAX, "clamps above max")
	Audio.set_cam_zoom(0.1)
	_eq(Audio.cam_zoom_mult, Audio.CAM_ZOOM_MIN, "clamps below min")
	Audio.set_cam_zoom(1.1)
	_eq(Audio.cam_zoom_mult, 1.1, "in-range value kept")
	Audio.set_cam_zoom(original)  # restore so the run doesn't leak state
