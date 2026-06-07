extends Node
## Handles map (world scene) transitions with a fade and named spawn points.
## Main.tscn registers its world-holder + fade rect on ready; maps contain
## their own Player child and Marker2D spawn points named via `spawn_name`.

signal map_changed(map_path: String)

const ROOM := "res://scenes/world/Room.tscn"
const TOWN := "res://scenes/world/Town.tscn"
const HUNT1 := "res://scenes/world/HuntingGround1.tscn"
const HUNT2 := "res://scenes/world/HuntingGround2.tscn"
const HUNT3 := "res://scenes/world/HuntingGround3.tscn"
const BOSS_ARENA := "res://scenes/world/BossArena.tscn"
const HUNTS: Array[String] = [HUNT1, HUNT2, HUNT3, BOSS_ARENA]
const DUNGEON1 := "res://scenes/world/DungeonRoom1.tscn"
const DUNGEON2 := "res://scenes/world/DungeonRoom2.tscn"
const DUNGEON3 := "res://scenes/world/DungeonRoom3.tscn"
const DUNGEON_BOSS := "res://scenes/world/DungeonBossRoom.tscn"
const DUNGEONS: Array[String] = [DUNGEON1, DUNGEON2, DUNGEON3, DUNGEON_BOSS]
const EQUIP_SHOP := "res://scenes/world/EquipShopInterior.tscn"
const GAMBLE_HOUSE := "res://scenes/world/GambleInterior.tscn"
const POTION_SHOP := "res://scenes/world/PotionShopInterior.tscn"

## True for any map of the hunting-ground chain (HP can drop there).
func is_hunt(scene_path: String) -> bool:
	return scene_path in HUNTS

## True for any room of the dungeon run (run-satchel territory).
func is_dungeon(scene_path: String) -> bool:
	return scene_path in DUNGEONS

## True wherever combat happens (hunt chain or dungeon): HP does not auto-restore
## and the potion quick-bar is shown.
func is_combat(scene_path: String) -> bool:
	return is_hunt(scene_path) or is_dungeon(scene_path)

var _world: Node = null
var _fade: ColorRect = null
var _current_map: Node = null
var _busy: bool = false
# Scene path of the loaded map (UI reads it for map-name lookups).
var current_map_path: String = ""

# Camera cached by setup_camera, so the zoom slider can reapply live.
var _cam: Camera2D = null
var _cam_base_zoom: float = 1.0

func register(world_holder: Node, fade_rect: ColorRect) -> void:
	_world = world_holder
	_fade = fade_rect
	if _fade:
		_fade.color = Color(0, 0, 0, 1)  # start opaque; first goto fades in

## Returns the currently loaded map node (or null).
func current_map() -> Node:
	return _current_map

func goto(scene_path: String, spawn_name: String = "") -> void:
	if _busy or _world == null:
		return
	_busy = true
	Audio.play("door")
	await _fade_to(1.0, 0.25)
	if is_instance_valid(_current_map):
		_current_map.queue_free()
		_current_map = null
		# wait one frame so the freed node leaves the tree before adding next
		await get_tree().process_frame
	var packed: PackedScene = load(scene_path)
	if packed == null:
		push_error("SceneManager: failed to load %s" % scene_path)
		_busy = false
		return
	_current_map = packed.instantiate()
	_world.add_child(_current_map)
	current_map_path = scene_path
	_place_player(spawn_name)
	# Dungeon-run lifecycle: entering the dungeon from outside opens the satchel;
	# walking back out to any non-dungeon map banks it ("retreat"). Death and the
	# boss kill settle the run BEFORE their goto, so this never double-fires.
	if GameState.run_active and not is_dungeon(scene_path):
		GameState.end_dungeon_run("retreat")
	elif is_dungeon(scene_path) and not GameState.run_active:
		GameState.start_dungeon_run()
	# HP fully restores anywhere outside combat maps (covers leaving the hunt or
	# dungeon, death respawn in the room, and shop visits).
	if not is_combat(scene_path):
		GameState.restore_hp()
	if is_hunt(scene_path):
		Audio.play_bgm("town")
	elif is_dungeon(scene_path):
		Audio.play_bgm("room")  # enclosed-interior mood for the stone halls
	else:
		match scene_path:
			ROOM: Audio.play_bgm("room")
			TOWN: Audio.play_bgm("town")
			EQUIP_SHOP, GAMBLE_HOUSE, POTION_SHOP: Audio.play_bgm("room")
	map_changed.emit(scene_path)
	await _fade_to(0.0, 0.25)
	_busy = false

func _place_player(spawn_name: String) -> void:
	if spawn_name == "" or _current_map == null:
		return
	var player := _current_map.get_node_or_null("Player")
	var marker := _find_spawn(_current_map, spawn_name)
	if player != null and marker != null:
		(player as Node2D).global_position = (marker as Node2D).global_position

func _find_spawn(root: Node, spawn_name: String) -> Node:
	for n in root.get_children():
		if n is Marker2D and n.name == spawn_name:
			return n
	return null

# ---------------------------------------------------------------------------
# Camera setup (centralised: every map calls this from _ready instead of
# duplicating the limit block). base_zoom is the map's design zoom (0.7 world /
# 1.0 interior); the user's saved multiplier scales it.
# ---------------------------------------------------------------------------
func setup_camera(cam: Camera2D, w: int, h: int, base_zoom: float) -> void:
	if cam == null:
		return
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = w
	cam.limit_bottom = h
	_cam = cam
	_cam_base_zoom = base_zoom
	reapply_zoom()

## Reapplies base_zoom * Audio.cam_zoom_mult to the cached camera (live slider).
func reapply_zoom() -> void:
	if _cam == null or not is_instance_valid(_cam):
		return
	var z: float = _cam_base_zoom * Audio.cam_zoom_mult
	_cam.zoom = Vector2(z, z)

func _fade_to(alpha: float, dur: float) -> void:
	if _fade == null:
		return
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", alpha, dur)
	await tw.finished
