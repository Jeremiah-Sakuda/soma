// Developer ID distribution only; no ad-hoc/development-signature fallback.
const {execFileSync}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.local/desktop-release'),bundle=path.join(output,'Soma-darwin-arm64/Soma.app');
const run=(command,args)=>execFileSync(command,args,{cwd:__dirname,stdio:'inherit'});
async function release(){
 const signOnly=process.argv.includes('--sign-only'),notarizeOnly=process.argv.includes('--notarize-only');
 if(signOnly&&notarizeOnly)throw new Error('Choose one release phase.');
 const identities=execFileSync('security',['find-identity','-v','-p','codesigning'],{encoding:'utf8'});
 const available=[...identities.matchAll(/"(Developer ID Application:[^"\n]+)"/g)].map(m=>m[1]);
 const identity=process.env.SOMA_SIGNING_IDENTITY||(available.length===1?available[0]:null),profile=process.env.SOMA_NOTARY_PROFILE||'soma-notary';
 if(!identity||!available.includes(identity))throw new Error('Install a valid Developer ID Application certificate; set SOMA_SIGNING_IDENTITY if more than one is available.');
 if(!notarizeOnly){
  const helper=require('./build-native.cjs').buildNative();
  const {packager}=await import('@electron/packager');
  await packager({dir:__dirname,name:'Soma',platform:'darwin',arch:'arm64',out:output,overwrite:true,asar:true,appBundleId:'app.soma.desktop',extendInfo:path.join(__dirname,'Info.plist'),extraResource:[helper],ignore:[/^\/test(?:\/|$)/,/^\/README\.md$/,/^\/node_modules\/\.cache(?:\/|$)/]});
  const {sign}=await import('@electron/osx-sign');
  await sign({app:bundle,identity,platform:'darwin',binaries:[path.join(bundle,'Contents/Resources/hold-shortcut')],optionsForFile:()=>({hardenedRuntime:true,entitlements:path.join(__dirname,'entitlements.plist')})});
 }
 run('codesign',['--verify','--deep','--strict','--verbose=2',bundle]);
 if(signOnly){console.log(`Developer ID signed, NOT notarized: ${bundle}`);return;}
 // Keychain credentials are never read into this process or bundled with Soma.
 execFileSync('xcrun',['notarytool','history','--keychain-profile',profile,'--output-format','json'],{stdio:['ignore','ignore','pipe']});
 const submission=path.join(output,'Soma-notary.zip');if(fs.existsSync(submission))fs.unlinkSync(submission);
 run('ditto',['-c','-k','--sequesterRsrc','--keepParent',bundle,submission]);
 run('xcrun',['notarytool','submit',submission,'--keychain-profile',profile,'--wait']);
 run('xcrun',['stapler','staple',bundle]);run('xcrun',['stapler','validate',bundle]);run('spctl',['--assess','--type','execute','--verbose=2',bundle]);
 const zip=path.join(output,'Soma-macOS-arm64.zip');if(fs.existsSync(zip))fs.unlinkSync(zip);
 run('ditto',['-c','-k','--sequesterRsrc','--keepParent',path.dirname(bundle),zip]);
 console.log(`Signed, notarized and verified release: ${zip}`);
}
release().catch(error=>{console.error(error.message);process.exitCode=1;});
