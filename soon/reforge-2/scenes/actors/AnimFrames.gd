extends Sprite2D
## Loops a single-row frame strip (Franuka "Animated objects": fireplace,
## candles, cauldron, furnace, ...). Set hframes in the scene; this just cycles.

@export var fps: float = 6.0

var _t: float = 0.0

func _process(delta: float) -> void:
	_t += delta
	frame = int(_t * fps) % hframes
