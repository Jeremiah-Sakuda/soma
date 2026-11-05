# Desktop companion

[Download Soma 0.5.0](https://github.com/Jeremiah-Sakuda/soma/releases/latest/download/Soma-macOS-arm64.zip) · [Release and checksum](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.5.0)

Requires Apple Silicon and macOS 14.2 or newer. The published archive is Developer ID signed, Apple-notarized and stapled. Extract it, move Soma to Applications and open it. The browser experience remains available without installation.

## Controls

- **Option–Space:** show/hide the compact question bar. If that shortcut is unavailable, the app attempts **Command–Option–Space**.
- **Command–Shift–Space:** capture a display for review.
- **Command–L:** lift the current supported visual into 3D from the compact experience.
- **Point & ask:** when enabled, hold **Control–Option–Space**, point/circle and speak, then release. Escape cancels. [Details](POINT_AND_ASK.md).
- **Menu-bar Soma icon:** reopen a hidden panel. Closing hides; Quit exits.

Capture selects the display under the cursor, omits Soma’s own drawing and presents explicit selected context. It does not continuously watch every app. A changed screen invalidates source overlays; recapture before drawing on new material.

## Permissions

Enable Soma in **System Settings → Privacy & Security → Screen & System Audio Recording** when requested. Optional spoken questions need Microphone permission; the held shortcut/helper may request Input Monitoring or Accessibility. Enable only the requested capabilities. Relaunch when macOS requests it after a permission change.

Screen-capture permission does not establish microphone, shortcut or computer-action permission. Permission failure must be recoverable; Soma must not silently substitute a different display. Optional external computer actions use a separate explicit approval window.

## Development and release

```sh
npm ci
npm ci --prefix desktop
npm start --prefix desktop
node --test desktop/test/*.test.cjs
```

`npm run package --prefix desktop` creates a local package; it is not the published notarized distribution. Release tooling is `desktop/release.cjs`, using the developer’s own Developer ID Application identity and local Keychain notarization profile. No signing keys or Apple credentials ship with the repository.

Native Node integration is disabled for hosted content. Only application-owned origins can use the restricted preload bridge. See [desktop development](../desktop/README.md), [security](SECURITY.md) and [executed verification](VERIFICATION.md). Automated capture/controller/renderer checks, actual-device gestures, OS consent and a clean-Mac install are distinct evidence.
