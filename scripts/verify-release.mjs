import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'public/release.json');
const paths = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'test', '.DS_Store'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (
      path !== manifestPath &&
      !entry.name.endsWith('.md') &&
      !entry.name.endsWith('.tsbuildinfo')
    )
      paths.push(relative(root, path));
  }
}

// Include the exact original examples and recorded-source assets, not just code.
// The generated manifest itself is excluded to avoid a self-referential hash.
for (const name of ['src', 'desktop', 'services', 'public']) walk(resolve(root, name));
paths.push(
  'package.json',
  'package-lock.json',
  'next.config.ts',
  'tsconfig.json',
  'postcss.config.mjs',
  'vercel.json',
  'firebase.json',
  'firestore.rules',
  '.nvmrc',
);
paths.sort();
const runtime = Object.fromEntries(
  paths.map((path) => [
    path,
    createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex'),
  ]),
);
const fingerprint = createHash('sha256').update(JSON.stringify(runtime)).digest('hex');

if (process.argv.includes('--write')) {
  const releaseId =
    process.argv
      .find((argument) => argument.startsWith('--release-id='))
      ?.slice('--release-id='.length) || 'soma-pm099-2026-10-30';
  writeFileSync(
    manifestPath,
    JSON.stringify({ releaseId, sourceTreeSha256: fingerprint, runtime }, null, 2) + '\n',
  );
} else {
  const expected = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (
    fingerprint !== expected.sourceTreeSha256 ||
    JSON.stringify(runtime) !== JSON.stringify(expected.runtime)
  )
    throw Error('Runtime source differs from the published release manifest.');
  console.log(
    JSON.stringify({
      releaseId: expected.releaseId,
      verified: true,
      files: paths.length,
      sourceTreeSha256: fingerprint,
    }),
  );
}
