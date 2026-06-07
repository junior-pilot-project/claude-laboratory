extends Node2D
## Gamble house interior (tavern). The Bartender opens the random-box UI.

const MAP_W: int = 640
const MAP_H: int = 480

func _ready() -> void:
	$BartenderNPC/Interact.interacted.connect(_open_gambling)
	$ExitDoor/Interact.interacted.connect(_go_town)
	SceneManager.setup_camera($Player/Camera2D, MAP_W, MAP_H, 1.0)

func _open_gambling() -> void:
	var ui := get_tree().get_first_node_in_group("ui_root")
	if ui:
		ui.open_gambling()

func _go_town() -> void:
	SceneManager.goto(SceneManager.TOWN, "from_gamble")
