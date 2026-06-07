extends Sprite2D
## Idle animation for shop NPCs (Medieval Townsfolk 4x4 sheets: ROW = facing
## down/left/right/up, COLUMN = frame). Cycles the front-facing row so the NPC
## breathes instead of holding a frozen frame.

@export var fps: float = 4.0
@export var facing_row: int = 0   # 0 = down (facing the player/camera)

var _t: float = 0.0

func _process(delta: float) -> void:
	_t += delta
	frame = facing_row * hframes + int(_t * fps) % hframes
