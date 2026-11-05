const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { consequentialLabel } = require('../computer-policy.cjs');

test('dialog and destructive verbs always need their own approval', () => {
  for (const label of [
    "Don't Save",
    'Replace',
    'Clear All',
    'Reset',
    'Empty Trash',
    'Allow',
    'Accept',
    'Approve',
    'Install',
    'Restart',
    'Shut Down',
    'Revert',
    'Send',
    'Delete',
    'Reply',
    'Forward',
    'Authorize',
    'Grant access',
    'I Agree',
    'Subscribe',
    'Sign In',
    'Log in',
    'Join',
    'Move to Bin',
    'Comment',
    'Save',
    'OK',
    'Yes',
    'Archive',
    'Block',
    'Leave',
    'Report',
    'Continue',
  ])
    assert.ok(consequentialLabel.test(label), label);
  for (const label of ['Next', 'Previous', 'Zoom In', 'Open', 'Notebook', 'Facebook', 'Bookmarks'])
    assert.ok(!consequentialLabel.test(label), label);
});

test('the desktop and server copies of the verb list match', () => {
  const server = fs.readFileSync(
    path.join(__dirname, '../../src/lib/server/computer-actions.ts'),
    'utf8',
  );
  assert.ok(
    server.includes(consequentialLabel.source),
    'server regex differs from the desktop copy',
  );
});
