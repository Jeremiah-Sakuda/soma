// One-shot, bounded Accessibility helper. No shell, key chords, screen pixels or field values.
// The only keys it can post are six unmodified navigation keys, to the selected app's process.
import AppKit
import ApplicationServices
import CryptoKit

func fail(_ reason: String) -> Never { print("{\"error\":\"\(reason)\"}"); exit(1) }
func attr(_ element: AXUIElement, _ name: String) -> CFTypeRef? { var value: CFTypeRef?; return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil }
func string(_ element: AXUIElement, _ name: String) -> String { (attr(element, name) as? String) ?? "" }
let input = FileHandle.standardInput.readDataToEndOfFile()
guard input.count < 32768, let request = try? JSONSerialization.jsonObject(with: input) as? [String: Any] else { fail("invalid_request") }
if request["command"] as? String == "permission" { print("{\"trusted\":\(AXIsProcessTrusted() ? "true" : "false")}"); exit(0) }
guard AXIsProcessTrusted() else { fail("accessibility_permission_required") }
if let pid = request["activate"] as? Int {
    guard let target = NSRunningApplication(processIdentifier: pid_t(pid)) else { fail("app_closed") }
    target.activate(options: [])
    Thread.sleep(forTimeInterval: 0.3)
}
guard let app = NSWorkspace.shared.frontmostApplication, app.bundleIdentifier != "app.soma.desktop", app.bundleIdentifier != "com.github.Electron" else { fail("select_another_app") }
if let expected = request["pid"] as? Int, expected != Int(app.processIdentifier) { fail("focus_changed") }
let appIdentity = (app.localizedName ?? "") + " " + (app.bundleIdentifier ?? "")
guard appIdentity.range(of: "terminal|iterm|warp|script.?editor|automator|xcode|visual studio code|code runner", options: [.regularExpression,.caseInsensitive]) == nil else { fail("command_apps_unsupported") }
let root = AXUIElementCreateApplication(app.processIdentifier)
AXUIElementSetMessagingTimeout(root, 1)
guard let rawWindow = attr(root, kAXFocusedWindowAttribute), CFGetTypeID(rawWindow) == AXUIElementGetTypeID() else { fail("no_focused_window") }
let window = unsafeBitCast(rawWindow, to: AXUIElement.self)
var nodes: [[String: Any]] = [], elements: [AXUIElement] = [], visited = 0
let forbidden = "password|passcode|secret|token|credit.?card|card.?number|security.?code|verification.?code|one.?time|otp|ssn|social.?security|terminal|console|command|script|code|execute|compile|debug|(?:^|\\s)run(?:$|\\s)"
func sensitive(_ s: String) -> Bool { s.range(of: forbidden, options: [.regularExpression, .caseInsensitive]) != nil }
func walk(_ e: AXUIElement, _ depth: Int) {
    if depth > 16 || visited >= 600 || nodes.count >= 80 { return }; visited += 1
    let role = string(e, kAXRoleAttribute), subrole = string(e, kAXSubroleAttribute)
    let label = String((string(e, kAXTitleAttribute) + " " + string(e, kAXDescriptionAttribute)).trimmingCharacters(in: .whitespacesAndNewlines).prefix(120))
    if subrole == "AXSecureTextField" || sensitive(label) { return }
    let enabled = (attr(e, kAXEnabledAttribute) as? Bool) ?? false
    if enabled && ["AXButton", "AXCheckBox", "AXRadioButton", "AXTextField"].contains(role) && !label.isEmpty {
        let id = nodes.count
        nodes.append(["id": id, "role": role, "label": label]); elements.append(e)
    }
    if let children = attr(e, kAXChildrenAttribute) as? [AXUIElement] { for child in children { walk(child, depth + 1) } }
}
walk(window, 0)
let title = string(window, kAXTitleAttribute)
// Focus is part of the state: a navigation key acts on whatever is focused.
var focus = ""
if let raw = attr(root, kAXFocusedUIElementAttribute), CFGetTypeID(raw) == AXUIElementGetTypeID() {
    let f = unsafeBitCast(raw, to: AXUIElement.self)
    focus = string(f, kAXRoleAttribute) + "|" + string(f, kAXSubroleAttribute) + "|" + String((string(f, kAXTitleAttribute) + " " + string(f, kAXDescriptionAttribute)).prefix(120))
}
func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
func stateValue(_ element: AXUIElement) -> String {
    let value = attr(element,kAXValueAttribute)
    return (value as? String) ?? (value as? NSNumber)?.stringValue ?? ""
}
var geometry: [[String: Any]] = []
for element in elements {
    var point = CGPoint.zero, size = CGSize.zero
    if let raw = attr(element, kAXPositionAttribute), CFGetTypeID(raw) == AXValueGetTypeID() { _ = AXValueGetValue(unsafeBitCast(raw, to: AXValue.self), .cgPoint, &point) }
    if let raw = attr(element, kAXSizeAttribute), CFGetTypeID(raw) == AXValueGetTypeID() { _ = AXValueGetValue(unsafeBitCast(raw, to: AXValue.self), .cgSize, &size) }
    geometry.append(["x":point.x,"y":point.y,"width":size.width,"height":size.height,"valueDigest":SHA256.hash(data:Data(stateValue(element).utf8)).map { String(format:"%02x",$0) }.joined()])
}
let canonical = try! JSONSerialization.data(withJSONObject: ["pid": Int(app.processIdentifier), "window": title, "bundle": app.bundleIdentifier ?? "", "launched": app.launchDate?.timeIntervalSince1970 ?? 0, "controls": nodes, "geometry": geometry, "focus": digest(Data(focus.utf8))], options: [.sortedKeys])
let fingerprint = digest(canonical)
// Window identity without controls: process, launch and focused-window title. Never returned in clear.
let windowIdentity = digest(try! JSONSerialization.data(withJSONObject: ["pid": Int(app.processIdentifier), "bundle": app.bundleIdentifier ?? "", "launched": app.launchDate?.timeIntervalSince1970 ?? 0, "window": title], options: [.sortedKeys]))
// Unmodified navigation keys only (macOS virtual key codes). No characters, Return, Tab, Escape or Space.
let navigationKeys: [String: CGKeyCode] = ["right": 124, "left": 123, "down": 125, "up": 126, "page_down": 121, "page_up": 116]
let command = request["command"] as? String ?? "observe"
if command == "execute" {
    guard request["fingerprint"] as? String == fingerprint else { fail("screen_changed") }
    guard let kind = request["kind"] as? String else { fail("invalid_action") }
    if kind == "key" {
        guard request["target"] as? Int == -1, (request["text"] as? String ?? "") == "", let name = request["key"] as? String, let code = navigationKeys[name] else { fail("invalid_key") }
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { fail("focus_changed") }
        // Refuse if the user is holding a modifier: the app must receive a bare navigation key.
        let held = CGEventSource.flagsState(.combinedSessionState).intersection([.maskCommand, .maskShift, .maskAlternate, .maskControl])
        guard held.isEmpty else { fail("modifier_keys_held") }
        let source = CGEventSource(stateID: .privateState)
        guard let down = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true), let up = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false) else { fail("action_failed") }
        down.flags = []; up.flags = []
        // Delivered to the selected process only, never to the global event stream.
        down.postToPid(app.processIdentifier); up.postToPid(app.processIdentifier)
        print("{\"executed\":true,\"valueConfirmed\":false,\"keyPosted\":true}")
        exit(0)
    }
    guard let id = request["target"] as? Int, id >= 0, id < elements.count else { fail("invalid_action") }
    // The broker re-resolves the reviewed control by role and label; confirm the ID still names it.
    guard let role = request["role"] as? String, let label = request["label"] as? String, nodes[id]["role"] as? String == role, nodes[id]["label"] as? String == label else { fail("target_changed") }
    guard nodes.filter({ ($0["role"] as? String) == (nodes[id]["role"] as? String) && ($0["label"] as? String) == (nodes[id]["label"] as? String) }).count == 1 else { fail("ambiguous_target") }
    let e = elements[id]
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { fail("focus_changed") }
    if kind == "type" {
        guard nodes[id]["role"] as? String == "AXTextField", let text = request["text"] as? String, text.count > 0, text.count <= 500, !text.contains("\n"), !text.contains("\r"), !text.contains("\t"), text.unicodeScalars.allSatisfy({ $0.value >= 32 && $0.value != 127 }), text.range(of: "(?:javascript|vbscript|data|file):",options:[.regularExpression,.caseInsensitive]) == nil else { fail("invalid_text") }
        var settable = DarwinBoolean(false)
        guard AXUIElementIsAttributeSettable(e, kAXValueAttribute as CFString, &settable) == .success, settable.boolValue else { fail("field_not_editable") }
        guard AXUIElementSetAttributeValue(e, kAXValueAttribute as CFString, text as CFString) == .success else { fail("action_failed") }
        guard string(e, kAXValueAttribute) == text else { fail("value_not_confirmed") }
    } else if kind == "click" {
        guard nodes[id]["role"] as? String != "AXTextField" else { fail("invalid_click") }
        // Move the pointer only to the resolved control; arbitrary coordinates are never accepted.
        if let raw = attr(e, kAXPositionAttribute), CFGetTypeID(raw) == AXValueGetTypeID() {
            let value = unsafeBitCast(raw, to: AXValue.self); var position = CGPoint.zero
            if AXValueGetValue(value, .cgPoint, &position) { CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: position, mouseButton: .left)?.post(tap: .cghidEventTap) }
        }
        guard AXUIElementPerformAction(e, kAXPressAction as CFString) == .success else { fail("action_failed") }
    } else { fail("invalid_action") }
    print("{\"executed\":true,\"valueConfirmed\":\(kind == "type" ? "true" : "false")}")
} else if command == "observe" {
    let result: [String: Any] = ["pid": Int(app.processIdentifier), "app": app.localizedName ?? "Selected app", "bundle": app.bundleIdentifier ?? "", "fingerprint": fingerprint, "window": windowIdentity, "controls": nodes]
    print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
} else { fail("invalid_command") }
