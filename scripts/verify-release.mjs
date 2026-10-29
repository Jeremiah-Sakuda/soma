import {createHash} from 'node:crypto';import {readFileSync,readdirSync,writeFileSync} from 'node:fs';import {resolve,relative} from 'node:path';
const root=process.cwd(),paths=[];
for(const name of ['src','desktop','services','public/synthetic'])walk(resolve(root,name));
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(['node_modules','test','.DS_Store'].includes(e.name))continue;const p=resolve(dir,e.name);if(e.isDirectory())walk(p);else if(!e.name.endsWith('.md')&&!e.name.endsWith('.tsbuildinfo'))paths.push(relative(root,p));}}
paths.push('package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs','vercel.json','firebase.json','firestore.rules','.nvmrc');paths.sort();
const runtime=Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
const fingerprint=createHash('sha256').update(JSON.stringify(runtime)).digest('hex'),path=resolve(root,'public/release.json');
if(process.argv.includes('--write'))writeFileSync(path,JSON.stringify({releaseId:'soma-pm064-2026-10-29',sourceTreeSha256:fingerprint,runtime},null,2)+'\n');
else{const expected=JSON.parse(readFileSync(path,'utf8'));if(fingerprint!==expected.sourceTreeSha256||JSON.stringify(runtime)!==JSON.stringify(expected.runtime))throw Error('Runtime source differs from the published release manifest.');console.log(JSON.stringify({releaseId:expected.releaseId,verified:true,files:paths.length,sourceTreeSha256:fingerprint}));}
