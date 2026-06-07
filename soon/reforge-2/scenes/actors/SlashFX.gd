extends Sprite2D
## Brief directional slash effect (single Sword-slash icon from the Fantasy RPG
## icon pack). The player spawns one on attack; it pops in front of the facing
## direction with a quick scale + fade, then frees itself. Purely cosmetic.

# Offsets scaled for the 2x art (player ~48px tall, 32px tiles).
const OFFSET := {
	"down": Vector2(0, 22), "up": Vector2(0, -22),
	"left": Vector2(-22, 4), "right": Vector2(22, 4),
}
# The icon's blade points to the upper-right; rotate so the arc faces the swing.
const ROT := {"right": 0.0, "down": 90.0, "left": 180.0, "up": 270.0}

func setup(facing: String) -> void:
	position = OFFSET.get(facing, Vector2(0, 22))
	rotation_degrees = ROT.get(facing, 90.0)
	scale = Vector2(0.6, 0.6)
	modulate = Color(1, 1, 1, 1)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(self, "scale", Vector2(1.25, 1.25), 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(self, "modulate:a", 0.0, 0.16).set_delay(0.05)
	tw.chain().tween_callback(queue_free)
