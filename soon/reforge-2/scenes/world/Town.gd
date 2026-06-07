extends Node2D
## Town hub (2048x1280 exploration village). Four buildings lead to interior
## scenes (player's room + three shops); the north road exits to the
## hunting-ground chain (사냥터1→2→3).

const MAP_W: int = 2048
const MAP_H: int = 1280

func _ready() -> void:
	$DoorToRoom.interacted.connect(_go_room)
	$DoorToEquip.interacted.connect(_go_equip)
	$DoorToGamble.interacted.connect(_go_gamble)
	$DoorToPotion.interacted.connect(_go_potion)
	$ExitToHunt/Interact.interacted.connect(_go_hunt)
	$DungeonEntrance/Interact.interacted.connect(_go_dungeon)
	# West/east roads lead to future areas — show a 미구현 notice for now.
	$ExitWest/Interact.interacted.connect(_go_unbuilt)
	$ExitEast/Interact.interacted.connect(_go_unbuilt)
	# Keep the camera inside the village (the forest canopy hides the map edge).
	SceneManager.setup_camera($Player/Camera2D, MAP_W, MAP_H, 0.7)

func _go_room() -> void:
	SceneManager.goto(SceneManager.ROOM, "from_town")

func _go_equip() -> void:
	SceneManager.goto(SceneManager.EQUIP_SHOP, "from_town")

func _go_gamble() -> void:
	SceneManager.goto(SceneManager.GAMBLE_HOUSE, "from_town")

func _go_potion() -> void:
	SceneManager.goto(SceneManager.POTION_SHOP, "from_town")

func _go_hunt() -> void:
	SceneManager.goto(SceneManager.HUNT1, "from_south")

func _go_dungeon() -> void:
	# The run satchel opens automatically inside SceneManager.goto.
	SceneManager.goto(SceneManager.DUNGEON1, "from_south")

func _go_unbuilt() -> void:
	var root: Node = get_tree().get_first_node_in_group("ui_root")
	if root and root.has_method("open_notice"):
		root.open_notice("아직 갈 수 없는 길입니다 (미구현)")
