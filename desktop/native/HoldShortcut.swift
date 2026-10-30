// Reserved shortcut only: no keyboard text, event tap, or general input monitoring.
import AppKit
import Carbon
import Foundation

func emit(_ type: String, _ extra: [String: Any] = [:]) {
    var payload = extra
    payload["type"] = type
    if let data = try? JSONSerialization.data(withJSONObject: payload),
       let line = String(data: data, encoding: .utf8) {
        print(line)
        fflush(stdout)
    }
}
let application = NSApplication.shared
application.setActivationPolicy(.prohibited)
var hotKey: EventHotKeyRef?
var handler: EventHandlerRef?
var events = [
    EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed)),
    EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyReleased))
]
let installed = InstallEventHandler(GetApplicationEventTarget(), { _, event, _ in
    guard let event = event else { return OSStatus(eventNotHandledErr) }
    var identifier = EventHotKeyID()
    let status = GetEventParameter(event, EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &identifier)
    guard status == noErr, identifier.id == 1 else { return OSStatus(eventNotHandledErr) }
    emit(GetEventKind(event) == UInt32(kEventHotKeyPressed) ? "pressed" : "released")
    return noErr
}, events.count, &events, nil, &handler)
let registered = installed == noErr ? RegisterEventHotKey(UInt32(kVK_Space),
    UInt32(controlKey | optionKey), EventHotKeyID(signature: 0x534F4D41, id: 1),
    GetApplicationEventTarget(), 0, &hotKey) : installed
emit("ready", ["available": registered == noErr])
if registered != noErr { exit(1) }
application.run()
