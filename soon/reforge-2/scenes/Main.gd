extends Node
## Root controller. Owns the World holder, the UI CanvasLayer (HUD + popups)
## and the fade rect. Provides open_shop/open_gambling helpers used by maps,
## and locks player input + suppresses interact prompts while a popup is open.

const SHOP_UI := "res://scenes/ui/ShopUI.tscn"
const GAMBLING_UI := "res://scenes/ui/GamblingUI.tscn"
const POTION_UI := "res://scenes/ui/PotionShopUI.tscn"
const INVENTORY_UI := "res://scenes/ui/InventoryUI.tscn"
const INFO_UI := "res://scenes/ui/InfoUI.tscn"
const SETTINGS_UI := "res://scenes/ui/SettingsUI.tscn"
const MAP_PREVIEW_UI := "res://scenes/ui/MapPreviewUI.tscn"
const NOTICE_UI := "res://scenes/ui/NoticeUI.tscn"

@onready var _world: Node = $World
@onready var _fade: ColorRect = $FadeLayer/Fade
@onready var _popups: Control = $UI/Popups
@onready var _touch: Control = $UI/TouchControls
@onready var _hud: Control = $UI/HUD
@onready var _minimap: Control = $UI/Minimap

var _open_popup: Control = null

func _ready() -> void:
	if _wants_tests():
		_run_tests()
		return
	add_to_group("ui_root")
	_touch.visible = true
	SceneManager.register(_world, _fade)
	SceneManager.goto(SceneManager.ROOM, "start")
	if _arg("--smoke"):
		_run_smoke()
	elif _arg("--shot"):
		_run_shot()

func _wants_tests() -> bool:
	return _arg("--test")

func _arg(name: String) -> bool:
	return OS.get_cmdline_user_args().has(name) or OS.get_cmdline_args().has(name)

func _run_tests() -> void:
	var tests = load("res://tests/Tests.gd").new()
	var failures: int = tests.run()
	get_tree().quit(failures)

## Boots the real scene tree, walks room -> town -> every interior and back,
## and opens each popup. Surfaces runtime/scene-wiring errors under --headless.
func _run_smoke() -> void:
	print("=== smoke: booting scene tree ===")
	await get_tree().create_timer(0.7).timeout
	print("room loaded: ", SceneManager.current_map().name)
	SceneManager.goto(SceneManager.TOWN, "from_room")
	await get_tree().create_timer(0.8).timeout
	print("town loaded: ", SceneManager.current_map().name)
	print("minimap visible in town: ", _minimap.visible)
	# Round-trip every interior (catches marker/door wiring typos).
	for trip in [
		[SceneManager.EQUIP_SHOP, "from_equip"],
		[SceneManager.GAMBLE_HOUSE, "from_gamble"],
		[SceneManager.POTION_SHOP, "from_potion"],
	]:
		SceneManager.goto(trip[0], "from_town")
		await get_tree().create_timer(0.8).timeout
		print("interior loaded: ", SceneManager.current_map().name)
		SceneManager.goto(SceneManager.TOWN, trip[1])
		await get_tree().create_timer(0.8).timeout
		print("back in town from: ", trip[1])
	for mode in ["full", "merchant", "blacksmith"]:
		open_shop(mode)
		await get_tree().create_timer(0.2).timeout
		print("shop(%s) popup children: " % mode, _popups.get_child_count())
		_on_popup_closed()
		await get_tree().create_timer(0.1).timeout
	open_gambling()
	await get_tree().create_timer(0.2).timeout
	print("gambling popup children: ", _popups.get_child_count())
	_on_popup_closed()
	await get_tree().create_timer(0.1).timeout
	open_potion_shop()
	await get_tree().create_timer(0.2).timeout
	print("potion shop popup children: ", _popups.get_child_count())
	_on_popup_closed()
	await get_tree().create_timer(0.1).timeout
	# Hunt chain: town -> hunt1 -> hunt2 -> hunt3 -> boss arena and back
	# (marker/exit wiring).
	for trip in [
		[SceneManager.HUNT1, "from_south"], [SceneManager.HUNT2, "from_south"],
		[SceneManager.HUNT3, "from_south"], [SceneManager.BOSS_ARENA, "from_south"],
		[SceneManager.HUNT3, "from_north"], [SceneManager.HUNT2, "from_north"],
		[SceneManager.HUNT1, "from_north"], [SceneManager.TOWN, "from_hunt"],
	]:
		SceneManager.goto(trip[0], trip[1])
		await get_tree().create_timer(0.9).timeout
		print("chain loaded: ", SceneManager.current_map().name, " @ ", trip[1])
		if trip[0] == SceneManager.BOSS_ARENA:
			var mons: Node = SceneManager.current_map().get_node("Monsters")
			print("boss spawned: ", mons.get_child_count() > 0)
	# Dungeon run: town -> rooms -> boss room and back. The satchel must open on
	# entry, stay open across room hops, and bank on the walk back out.
	for trip in [
		[SceneManager.DUNGEON1, "from_south"], [SceneManager.DUNGEON2, "from_south"],
		[SceneManager.DUNGEON3, "from_south"], [SceneManager.DUNGEON_BOSS, "from_south"],
		[SceneManager.DUNGEON3, "from_north"], [SceneManager.DUNGEON2, "from_north"],
		[SceneManager.DUNGEON1, "from_north"],
	]:
		SceneManager.goto(trip[0], trip[1])
		await get_tree().create_timer(0.9).timeout
		print("dungeon loaded: ", SceneManager.current_map().name, " @ ", trip[1],
			"  run_active: ", GameState.run_active)
		if trip[0] == SceneManager.DUNGEON_BOSS:
			var dmons: Node = SceneManager.current_map().get_node("Monsters")
			print("dungeon boss spawned: ", dmons.get_child_count() > 0)
		elif trip[1] == "from_south":
			var dm: Node = SceneManager.current_map().get_node("Monsters")
			print("  monsters: ", dm.get_child_count())
			for c in dm.get_children():
				var anim: AnimatedSprite2D = c.get_node("Anim")
				print("    pos=", c.position, " vis=", c.visible,
					" anim=", anim.animation,
					" frames=", anim.sprite_frames.get_frame_count("idle") \
						if anim.sprite_frames else -1,
					" playing=", anim.is_playing(), " mod=", anim.modulate)
				break
	GameState.run_gold = 1000
	var gold_pre_retreat: int = GameState.gold
	SceneManager.goto(SceneManager.TOWN, "from_dungeon")
	await get_tree().create_timer(0.9).timeout
	print("retreat banked 100%: ", GameState.gold == gold_pre_retreat + 1000,
		"  run over: ", not GameState.run_active)
	# Death flow: lethal contact damage in the hunt must respawn at the Room bed.
	SceneManager.goto(SceneManager.HUNT1, "from_south")
	await get_tree().create_timer(0.9).timeout
	var player := get_tree().get_first_node_in_group("player")
	if player and player.has_method("take_contact_damage"):
		player.take_contact_damage(999_999_999)
	await get_tree().create_timer(2.0).timeout
	print("after death respawned in: ", SceneManager.current_map().name,
		"  hp full: ", GameState.hp == GameState.max_hp())
	# Dungeon death: the satchel must settle to half BEFORE the bed respawn.
	SceneManager.goto(SceneManager.DUNGEON1, "from_south")
	await get_tree().create_timer(0.9).timeout
	# Gate flow: clearing every wave must open the spiked gate (collider off,
	# north exit live). Two waves of DUNGEON_MONSTERS_PER_WAVE each.
	var droom: Node = SceneManager.current_map()
	for wave in GameConfig.DUNGEON_WAVES_PER_ROOM:
		for m in droom.get_node("Monsters").get_children():
			if m.has_method("take_damage"):
				m.take_damage(999_999_999)
		await get_tree().create_timer(1.6).timeout
	print("gate open: ", droom.get_node("Gate/Body/Col").disabled,
		"  north exit live: ", droom.get_node("ExitNorth/Interact").monitoring)
	# Let the airborne kill pickups land before pinning the satchel, so the
	# half-bank check below sees exactly 1000 in it.
	await get_tree().create_timer(2.5).timeout
	GameState.run_gold = 1000
	var gold_pre_death: int = GameState.gold
	var dplayer := get_tree().get_first_node_in_group("player")
	if dplayer and dplayer.has_method("take_contact_damage"):
		dplayer.take_contact_damage(999_999_999)
	await get_tree().create_timer(2.0).timeout
	print("after dungeon death in: ", SceneManager.current_map().name,
		"  banked half: ", GameState.gold == gold_pre_death + 500,
		"  run over: ", not GameState.run_active)
	print("=== smoke OK ===")
	get_tree().quit(0)

## Real-renderer capture of room/town/shop/gambling for visual verification.
func _run_shot() -> void:
	GameState.reset_progress()
	GameState.add_gold(7_000_000)  # so shop/gambling buttons are enabled
	GameState.inventory.append(Equipment.new("sword", "high", 5))
	GameState.inventory.append(Equipment.new("shield", "mid", 2))
	GameState.equip(GameState.inventory[0])  # wield the sword so the hero shows it
	var dir := "res://build/shots/"
	DirAccess.make_dir_recursive_absolute(dir)
	await get_tree().create_timer(0.7).timeout
	await _shot(dir + "1_room.png")
	SceneManager.goto(SceneManager.TOWN, "from_room")
	await get_tree().create_timer(0.8).timeout
	await _shot(dir + "2_town.png")
	open_shop()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "3_shop_buy.png")
	if is_instance_valid(_open_popup):
		_open_popup.call_deferred("_switch", "enhance")
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "4_shop_enhance.png")
	if is_instance_valid(_open_popup):
		_open_popup.call_deferred("_switch", "craft")
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "4b_shop_craft.png")
	_on_popup_closed()
	open_gambling()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "5_gambling.png")
	_on_popup_closed()
	# New interiors + potion shop popup.
	SceneManager.goto(SceneManager.EQUIP_SHOP, "from_town")
	await get_tree().create_timer(0.8).timeout
	await _shot(dir + "12_equip_interior.png")
	SceneManager.goto(SceneManager.GAMBLE_HOUSE, "from_town")
	await get_tree().create_timer(0.8).timeout
	await _shot(dir + "13_gamble_interior.png")
	SceneManager.goto(SceneManager.POTION_SHOP, "from_town")
	await get_tree().create_timer(0.8).timeout
	await _shot(dir + "14_potion_interior.png")
	open_potion_shop()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "15_potion_shop.png")
	_on_popup_closed()
	SceneManager.goto(SceneManager.HUNT1, "from_south")
	await get_tree().create_timer(0.9).timeout
	await _shot(dir + "6_hunt.png")
	var hunt := SceneManager.current_map()
	if hunt and hunt.has_node("Monsters"):
		var mons := hunt.get_node("Monsters").get_children()
		for i in mons.size():
			var m = mons[i]
			if m.has_method("take_damage"):
				m.take_damage(999_999_999 if i == 0 else GameState.weapon_power())
		# Damaged HP bar + potion quick-slots in frame.
		GameState.potions["small"] = 3
		GameState.potions_changed.emit()
		GameState.take_player_damage(int(GameState.max_hp() / 2.0))
		await get_tree().create_timer(0.25).timeout
		await _shot(dir + "7_hunt_combat.png")
	SceneManager.goto(SceneManager.BOSS_ARENA, "from_south")
	await get_tree().create_timer(0.9).timeout
	await _shot(dir + "18_boss_arena.png")
	# Dungeon run: town entrance mouth, a combat room (gate closed, satchel chip
	# after a fake drop), and the boss chamber.
	SceneManager.goto(SceneManager.TOWN, "from_dungeon")
	await get_tree().create_timer(0.9).timeout
	await _shot(dir + "19_town_dungeon_mouth.png")
	SceneManager.goto(SceneManager.DUNGEON1, "from_south")
	await get_tree().create_timer(0.9).timeout
	GameState.grant_monster_drop({"gold": 120_000, "material": true})
	await get_tree().create_timer(0.2).timeout
	await _shot(dir + "20_dungeon_room1.png")
	var dpl := get_tree().get_first_node_in_group("player")
	if dpl:
		(dpl as Node2D).position = Vector2(230, 300)
	await get_tree().create_timer(0.4).timeout
	await _shot(dir + "20b_dungeon_monster_closeup.png")
	SceneManager.goto(SceneManager.DUNGEON3, "from_north")
	await get_tree().create_timer(0.9).timeout
	await _shot(dir + "21_dungeon_room3.png")
	SceneManager.goto(SceneManager.DUNGEON_BOSS, "from_south")
	await get_tree().create_timer(0.9).timeout
	await _shot(dir + "22_dungeon_boss.png")
	SceneManager.goto(SceneManager.TOWN, "from_dungeon")
	await get_tree().create_timer(0.9).timeout
	SceneManager.goto(SceneManager.BOSS_ARENA, "from_south")
	await get_tree().create_timer(0.9).timeout
	open_inventory()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "8_inventory.png")
	_on_popup_closed()
	open_info()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "9_info.png")
	_on_popup_closed()
	open_settings()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "11_settings.png")
	_on_popup_closed()
	# Zoom multiplier extremes on the hunt map (minimap + bottom potion bar visible).
	Audio.set_cam_zoom(1.4)
	SceneManager.reapply_zoom()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "16_zoom_far.png")
	Audio.set_cam_zoom(0.8)
	SceneManager.reapply_zoom()
	await get_tree().create_timer(0.3).timeout
	await _shot(dir + "17_zoom_near.png")
	Audio.set_cam_zoom(1.0)
	SceneManager.reapply_zoom()
	print("=== shots saved to ", ProjectSettings.globalize_path(dir), " ===")
	get_tree().quit(0)

func _shot(path: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(path)
	print("shot: ", path)

# ---------------------------------------------------------------------------
# Popup management
# ---------------------------------------------------------------------------
## mode selects the visible ShopUI tabs: "merchant" = Buy+Craft, "blacksmith" =
## Enhance only, "full" (default) = all three (keeps --smoke/--shot unchanged).
func open_shop(mode: String = "full") -> void:
	_open(SHOP_UI, func(popup): popup.mode = mode)

func open_gambling() -> void:
	_open(GAMBLING_UI)

func open_potion_shop() -> void:
	_open(POTION_UI)

## Opens the inventory popup (from the HUD hamburger). Reuses the single popup
## slot, so the joystick/attack buttons hide while it is open.
func open_inventory() -> void:
	_open(INVENTORY_UI)

## Opens the character Info popup (from the HUD hamburger): worn gear + total stats.
func open_info() -> void:
	_open(INFO_UI)

## Opens the settings popup (from the HUD hamburger): sound volumes + save.
func open_settings() -> void:
	_open(SETTINGS_UI)

## Opens the full-map preview (tapping the minimap): whole-map render + player dot.
func open_map_preview() -> void:
	_open(MAP_PREVIEW_UI)

## One-line notice modal (e.g. 미구현 길 안내).
func open_notice(text: String) -> void:
	_open(NOTICE_UI, func(popup): popup.message = text)

## `configure` (optional Callable) runs on the instance BEFORE add_child, so the
## popup's _ready already sees any injected state (e.g. ShopUI.mode).
func _open(scene_path: String, configure: Callable = Callable()) -> void:
	if _open_popup != null:
		return
	var packed: PackedScene = load(scene_path)
	if packed == null:
		push_error("Main: failed to load popup %s" % scene_path)
		return
	_open_popup = packed.instantiate()
	if configure.is_valid():
		configure.call(_open_popup)
	_popups.add_child(_open_popup)
	_set_world_active(false)
	if _open_popup.has_signal("closed"):
		_open_popup.closed.connect(_on_popup_closed)

func _on_popup_closed() -> void:
	if is_instance_valid(_open_popup):
		_open_popup.queue_free()
	_open_popup = null
	_set_world_active(true)

func _set_world_active(active: bool) -> void:
	var player := get_tree().get_first_node_in_group("player")
	if player and player.has_method("set_input_locked"):
		player.set_input_locked(not active)
	# On-screen controls (joystick + attack/interact) only make sense while
	# exploring the world — hide them while a popup is open.
	_touch.visible = active
	# Hide the HUD hamburger/menu while a popup is up (can't open over a popup).
	if _hud and _hud.has_method("set_menu_visible"):
		_hud.set_menu_visible(active)
	# Hide the minimap behind popups (it re-evaluates its own map gating on restore).
	if _minimap and _minimap.has_method("set_active"):
		_minimap.set_active(active)
	# Suppress interact prompts/zones while a popup is open.
	for node in get_tree().get_nodes_in_group("interactable"):
		if node.has_method("set_active"):
			node.set_active(active)

