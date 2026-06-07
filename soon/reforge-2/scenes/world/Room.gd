extends Node2D
## Starting bedroom (and death-respawn point — the "bed" marker). The door
## leads to the Town.

const MAP_W: int = 640
const MAP_H: int = 480

func _ready() -> void:
	$DoorToTown/Interact.interacted.connect(_go_to_town)
	# Interiors design at zoom 1.0 (224x384 view fits the room; the world maps'
	# 0.7 would show the void beyond the walls). The user's zoom multiplier scales it.
	SceneManager.setup_camera($Player/Camera2D, MAP_W, MAP_H, 1.0)

func _go_to_town() -> void:
	SceneManager.goto(SceneManager.TOWN, "from_room")
