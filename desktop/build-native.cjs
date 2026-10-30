const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function buildNative() {
  if (process.platform !== 'darwin') return null;
  const output = path.join(__dirname, 'node_modules/.cache/soma/hold-shortcut');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync(
    'xcrun',
    [
      'swiftc',
      '-O',
      '-module-cache-path',
      path.join(path.dirname(output), 'module-cache'),
      '-target',
      `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos14.2`,
      path.join(__dirname, 'native/HoldShortcut.swift'),
      '-o',
      output,
    ],
    { stdio: 'inherit' },
  );
  return output;
}
if (require.main === module) buildNative();
module.exports = { buildNative };
