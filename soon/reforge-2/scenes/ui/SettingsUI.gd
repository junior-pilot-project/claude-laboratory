extends Control
## 설정 팝업(HUD 햄버거 메뉴에서 열림): BGM/효과음 볼륨 슬라이더.
## 저장 버튼은 아직 자리만 잡아둔 더미(비활성) — 세이브 슬롯 작업 때 연결 예정.
## 볼륨은 움직이는 즉시 Audio 싱글톤에 반영되고, 드래그가 끝나면 파일로 저장된다.

signal closed

@onready var _bgm_slider: HSlider = %BgmSlider
@onready var _sfx_slider: HSlider = %SfxSlider
@onready var _zoom_slider: HSlider = %ZoomSlider

func _ready() -> void:
	%Close.pressed.connect(_close)
	_bgm_slider.value = Audio.bgm_volume
	_sfx_slider.value = Audio.sfx_volume
	_zoom_slider.value = Audio.cam_zoom_mult
	_bgm_slider.value_changed.connect(func(v: float) -> void: Audio.set_bgm_volume(v))
	_sfx_slider.value_changed.connect(func(v: float) -> void: Audio.set_sfx_volume(v))
	# 줌은 끌면서 바로 보이도록 매 변경마다 현재 맵 카메라에 반영한다.
	_zoom_slider.value_changed.connect(func(v: float) -> void:
		Audio.set_cam_zoom(v)
		SceneManager.reapply_zoom())
	_bgm_slider.drag_ended.connect(func(_changed: bool) -> void: Audio.save_settings())
	# 효과음은 들으면서 맞출 수 있게 드래그를 놓는 순간 클릭음을 들려준다.
	_sfx_slider.drag_ended.connect(func(_changed: bool) -> void:
		Audio.save_settings()
		Audio.play("click"))
	_zoom_slider.drag_ended.connect(func(_changed: bool) -> void: Audio.save_settings())

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_close()

func _close() -> void:
	Audio.save_settings()
	Audio.play("click")
	closed.emit()
