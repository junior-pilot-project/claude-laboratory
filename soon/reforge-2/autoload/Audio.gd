extends Node
## Sound. Plays the curated SFX (assets/audio/sfx) through a small voice pool and
## a single looping BGM track per map (assets/audio/bgm). Other scripts call
## `Audio.play("name")` for effects and `Audio.play_bgm("room"|"town")` for music.
## Registered as an autoload singleton.

const POOL_SIZE: int = 8
const SFX_DB: float = -4.0
const BGM_DB: float = -12.0
const SETTINGS_PATH := "user://settings.cfg"

const SFX := {
	"click":           "res://assets/audio/sfx/click.wav",
	"buy":             "res://assets/audio/sfx/buy.wav",
	"enhance_success": "res://assets/audio/sfx/enhance_success.wav",
	"enhance_fail":    "res://assets/audio/sfx/enhance_fail.wav",
	"gamble":          "res://assets/audio/sfx/gamble.wav",
	"reward":          "res://assets/audio/sfx/reward.wav",
	"door":            "res://assets/audio/sfx/door.wav",
	"lose":            "res://assets/audio/sfx/lose.wav",
	"slash":           "res://assets/audio/sfx/slash.wav",
	"whoosh":          "res://assets/audio/sfx/whoosh.wav",
}
const BGM := {
	"room": "res://assets/audio/bgm/room.ogg",
	"town": "res://assets/audio/bgm/town.ogg",
}

var _sfx: Dictionary = {}                  # name -> AudioStream
var _players: Array[AudioStreamPlayer] = []
var _next: int = 0
var _bgm: AudioStreamPlayer
var _current_bgm: String = ""

# User-facing volumes (settings popup), 0..1 linear on top of the base dB levels.
var bgm_volume: float = 1.0
var sfx_volume: float = 1.0
# Camera zoom multiplier (settings popup): applied on top of each map's base zoom
# (0.7 world / 1.0 interior) by SceneManager. Stored here as the settings owner;
# SceneManager reads it and reapplies. 1.0 = map default.
var cam_zoom_mult: float = 1.0
const CAM_ZOOM_MIN: float = 0.8
const CAM_ZOOM_MAX: float = 1.4

func _ready() -> void:
	_load_settings()
	for _i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)
	for name in SFX:
		var s: AudioStream = load(SFX[name])
		if s != null:
			_sfx[name] = s
	_bgm = AudioStreamPlayer.new()
	_bgm.volume_db = BGM_DB + _gain_db(bgm_volume)
	add_child(_bgm)

## Plays a one-shot effect. Unknown names are ignored (no crash).
func play(name: String, volume_db: float = SFX_DB, pitch: float = 1.0) -> void:
	var s: AudioStream = _sfx.get(name)
	if s == null:
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = s
	p.volume_db = volume_db + _gain_db(sfx_volume)
	p.pitch_scale = pitch
	p.play()

# ---------------------------------------------------------------------------
# Volume settings (settings popup)
# ---------------------------------------------------------------------------
func set_bgm_volume(v: float) -> void:
	bgm_volume = clampf(v, 0.0, 1.0)
	if _bgm:
		_bgm.volume_db = BGM_DB + _gain_db(bgm_volume)

func set_sfx_volume(v: float) -> void:
	sfx_volume = clampf(v, 0.0, 1.0)

## Camera zoom multiplier (storage only; SceneManager applies it to the live camera).
func set_cam_zoom(v: float) -> void:
	cam_zoom_mult = clampf(v, CAM_ZOOM_MIN, CAM_ZOOM_MAX)

func save_settings() -> void:
	var cf := ConfigFile.new()
	cf.set_value("audio", "bgm_volume", bgm_volume)
	cf.set_value("audio", "sfx_volume", sfx_volume)
	cf.set_value("camera", "zoom_mult", cam_zoom_mult)
	cf.save(SETTINGS_PATH)

func _load_settings() -> void:
	var cf := ConfigFile.new()
	if cf.load(SETTINGS_PATH) != OK:
		return
	bgm_volume = clampf(float(cf.get_value("audio", "bgm_volume", 1.0)), 0.0, 1.0)
	sfx_volume = clampf(float(cf.get_value("audio", "sfx_volume", 1.0)), 0.0, 1.0)
	cam_zoom_mult = clampf(float(cf.get_value("camera", "zoom_mult", 1.0)), CAM_ZOOM_MIN, CAM_ZOOM_MAX)

## 0..1 -> dB offset added to the base track level (0 -> effectively muted).
static func _gain_db(v: float) -> float:
	return linear_to_db(v) if v > 0.001 else -80.0

## Switches the looping background track (no-op if already playing it).
func play_bgm(name: String) -> void:
	if name == _current_bgm and _bgm.playing:
		return
	var path: String = BGM.get(name, "")
	if path == "":
		return
	var stream: AudioStream = load(path)
	if stream == null:
		return
	# Ensure seamless looping regardless of import settings.
	if stream is AudioStreamOggVorbis or stream is AudioStreamMP3:
		stream.loop = true
	_current_bgm = name
	_bgm.stream = stream
	_bgm.play()

func stop_bgm() -> void:
	_bgm.stop()
	_current_bgm = ""
