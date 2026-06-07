class_name Equipment
extends RefCounted
## A single piece of equipment: a type (sword/shield/...), a grade, and an
## enhancement level. Kept as a plain RefCounted (not a saved Resource) so it
## serialises cleanly to/from the JSON save via to_dict/from_dict.

var type: String = "sword"   # GameConfig.TYPE_*
var grade: String = "low"    # GameConfig.GRADE_*
var level: int = 0           # enhancement level (+N). supreme starts at 12.

func _init(_type: String = "sword", _grade: String = "low", _level: int = -1) -> void:
	type = _type
	grade = _grade
	# supreme equipment begins at SUPREME_START_LEVEL; everything else at 0.
	if _level >= 0:
		level = _level
	elif grade == GameConfig.GRADE_SUPREME:
		level = GameConfig.SUPREME_START_LEVEL
	else:
		level = 0

func display_name() -> String:
	return "%s +%d" % [GameConfig.type_grade_name(type, grade), level]

func is_weapon() -> bool:
	return type == GameConfig.TYPE_SWORD

func to_dict() -> Dictionary:
	return {"type": type, "grade": grade, "level": level}

static func from_dict(d: Dictionary) -> Equipment:
	return Equipment.new(
		String(d.get("type", "sword")),
		String(d.get("grade", "low")),
		int(d.get("level", 0)))
