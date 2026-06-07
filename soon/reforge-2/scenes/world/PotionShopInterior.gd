extends Node2D
## Potion shop interior (alchemy lab). The Alchemist sells HP potions.

const MAP_W: int = 640
const MAP_H: int = 480

func _ready() -> void:
	$AlchemistNPC/Interact.interacted.connect(_open_potion_shop)
	$ExitDoor/Interact.interacted.connect(_go_town)
	SceneManager.setup_camera($Player/Camera2D, MAP_W, MAP_H, 1.0)

func _open_potion_shop() -> void:
	var ui := get_tree().get_first_node_in_group("ui_root")
	if ui:
		ui.open_potion_shop()

func _go_town() -> void:
	SceneManager.goto(SceneManager.TOWN, "from_potion")
