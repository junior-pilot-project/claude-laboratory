extends Sprite2D
## Torch flame flicker. Torch.png is a single frame (no animation strip), so the
## flicker is a warm brightness wobble on modulate — two unsynced sine waves
## read as organic firelight.

var _t: float = randf() * 10.0

func _process(delta: float) -> void:
	_t += delta
	var b: float = 0.86 + 0.14 * sin(_t * 9.0) * sin(_t * 5.3 + 1.7)
	modulate = Color(1.0, b * 0.97, b * 0.88)
