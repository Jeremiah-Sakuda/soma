#!/usr/bin/env node
// Check actual Vercel tracing. A full local node_modules directory can mask missing runtime assets.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const project = fs.realpathSync(process.cwd());
const args = process.argv.slice(2);
const nextTrace = args[0] === '--next-trace';
if (args.length && !(nextTrace && args.length <= 2) && !(args[0] === '--function' && args.length === 2)) {
  console.error('Usage: node scripts/check-browser-artifact.mjs [--function <function-path> | --next-trace [route-trace-path]]');
  process.exit(2);
}
let isolated;
try {
  let entries;
  if (nextTrace) {
    const filename = path.resolve(project, args[1] ?? '.next/server/app/api/connectors/browser/route.js.nft.json');
    const trace = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!Array.isArray(trace.files) || trace.files.some(file => typeof file !== 'string')) throw new Error('The route has no valid file trace. Run the production build first.');
    entries = trace.files.map(file => { const relative = path.relative(project, path.resolve(path.dirname(filename), file)); return [relative, relative]; });
  } else {
    const functionPath = path.resolve(project, args[1] ?? '.vercel/output/functions/api/connectors/browser.func');
    const configuration = JSON.parse(fs.readFileSync(path.join(functionPath, '.vc-config.json'), 'utf8'));
    if (!configuration.filePathMap || typeof configuration.filePathMap !== 'object' || Array.isArray(configuration.filePathMap)) throw new Error('The function has no traced file map. Run vercel build --prod first.');
    entries = Object.entries(configuration.filePathMap);
  }
  isolated = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'soma-browser-artifact-')));
  let files = 0, links = 0, privateConfigurationOmitted = 0;
  for (const [from, to] of entries) {
    if (typeof to !== 'string' || path.isAbsolute(from) || path.isAbsolute(to)) throw new Error('The artifact contains an unsupported absolute file mapping.');
    // Package loading never needs deployment dotenv files. Do not read or duplicate their values.
    if (/(?:^|\/)\.env(?:[./]|$)|firebase-adminsdk|service-account/i.test(from)) { privateConfigurationOmitted++; continue; }
    const source = path.resolve(project, from), destination = path.resolve(isolated, to);
    if (!source.startsWith(project + path.sep) || !destination.startsWith(isolated + path.sep)) throw new Error('The artifact file mapping escapes its root.');
    const stat = fs.lstatSync(source);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(source);
      if (path.isAbsolute(target) || !path.resolve(path.dirname(destination), target).startsWith(isolated + path.sep)) throw new Error('A traced package link escapes the isolated artifact.');
      fs.symlinkSync(target, destination); links++;
    } else if (stat.isFile()) { fs.copyFileSync(source, destination); files++; }
    else throw new Error('The artifact contains an unsupported directory mapping.');
  }
  const aliases = entries.flatMap(([, value]) => {
    const match = /^\.next\/node_modules\/(playwright-core-[A-Za-z0-9_-]+)$/.exec(value);
    return match ? [match[1]] : [];
  });
  if (aliases.length > 1) throw new Error('The artifact contains ambiguous Playwright package aliases.');
  const specifier = aliases[0] ?? 'playwright-core';
  const checkPath = path.join(isolated, '.next/server/chunks/__soma_browser_artifact_check.mjs');
  fs.mkdirSync(path.dirname(checkPath), { recursive: true });
  fs.writeFileSync(checkPath, `
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=${JSON.stringify(isolated)}, specifier=${JSON.stringify(specifier)};
try {
  const resolved=fs.realpathSync(fileURLToPath(import.meta.resolve(specifier)));
  if(!resolved.startsWith(root+'/'))throw new Error('Package resolution escaped the isolated artifact.');
  const imported=await import(specifier);
  if(typeof imported.chromium?.connectOverCDP!=='function')throw new Error('The traced package lacks the browser connection API.');
  process.stdout.write(JSON.stringify({ok:true,package:specifier}));
}catch(error){
  process.stdout.write(JSON.stringify({ok:false,errorType:error instanceof Error?error.name:'unknown',code:typeof error?.code==='string'?error.code:'unknown',message:error instanceof Error?error.message.replaceAll(root,'<artifact>').slice(0,1000):'Package import failed.'}));
  process.exitCode=1;
}
`);
  // Fresh process, outside project ancestry, with no NODE_PATH, env file or provider credentials.
  const child = spawnSync(process.execPath, ['--no-experimental-require-module', checkPath], {
    cwd: isolated, env: { NODE_ENV: 'production' }, encoding: 'utf8', timeout: 30_000, maxBuffer: 16_384,
  });
  let result;
  try { result = JSON.parse(child.stdout); }
  catch { throw new Error('The isolated package import did not produce a valid result.'); }
  const safe = child.status === 0 && result.ok === true && privateConfigurationOmitted === 0;
  console.log(JSON.stringify({ event: 'browser_artifact_import', trace: nextTrace ? 'next-route' : 'vercel-function', ...result, ok: safe,
    packageImport: result.ok === true, tracedFiles: files, tracedLinks: links, privateConfigurationMappings: privateConfigurationOmitted,
    ...(privateConfigurationOmitted ? { configurationFailure: 'Deployment configuration paths must be excluded from executable artifacts.' } : {}) }));
  process.exitCode = safe ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ event: 'browser_artifact_import', ok: false, message: error instanceof Error ? error.message : 'Artifact validation failed.' }));
  process.exitCode = 1;
} finally { if (isolated) fs.rmSync(isolated, { recursive: true, force: true }); }
