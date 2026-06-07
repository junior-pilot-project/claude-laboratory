extends Control
## 작은 안내 팝업 (확인 한 개). Main.open_notice(text)로 띄운다 — 미구현 길
## 안내처럼 한 줄 메시지에 쓰는 범용 모달.

signal closed

var message: String = "알림"   # set by Main BEFORE add_child (configure callable)

func _ready() -> void:
	%Message.text = message
	%Ok.pressed.connect(func() -> void: closed.emit())
	%Ok.grab_focus()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		closed.emit()
