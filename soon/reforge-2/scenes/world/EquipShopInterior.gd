extends Node2D
## Equipment shop interior (smithy). Merchant sells/crafts, Blacksmith enhances;
## both reuse ShopUI with a tab mode. Exit door returns to the Town.

const MAP_W: int = 640
const MAP_H: int = 480

func _ready() -> void:
	$MerchantNPC/Interact.interacted.connect(_open_merchant)
	$BlacksmithNPC/Interact.interacted.connect(_open_blacksmith)
	$ExitDoor/Interact.interacted.connect(_go_town)
	SceneManager.setup_camera($Player/Camera2D, MAP_W, MAP_H, 1.0)

func _ui_root() -> Node:
	return get_tree().get_first_node_in_group("ui_root")

func _open_merchant() -> void:
	var ui := _ui_root()
	if ui:
		ui.open_shop("merchant")

func _open_blacksmith() -> void:
	var ui := _ui_root()
	if ui:
		ui.open_shop("blacksmith")

func _go_town() -> void:
	SceneManager.goto(SceneManager.TOWN, "from_equip")
