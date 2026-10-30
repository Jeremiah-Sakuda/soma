const {test} = require('node:test'); const assert = require('node:assert/strict');
const {appOrigin,trustedPage,safeExternal,panelBounds,captureSource}=require('../policy.cjs');
test('production locks origin and development only accepts loopback',()=>{
 assert.equal(appOrigin(undefined,true),'https://soma-woad-beta.vercel.app');
 assert.equal(appOrigin('http://127.0.0.1:3000/explore',false),'http://127.0.0.1:3000');
 for(const url of ['https://evil.test','file:///tmp/test','http://localhost.evil.test','http://user:pass@localhost']) assert.throws(()=>appOrigin(url,false));
 assert.throws(()=>appOrigin('http://localhost:3000',true));
});
test('privileged events reject lookalike origins and other app routes',()=>{
 const origin=appOrigin(); assert.ok(trustedPage(origin+'/explore?x=1',origin));
 for(const u of [origin+'/explorer',origin+'/login','https://soma-woad-beta.vercel.app.evil.test/explore','file:///explore','not a URL']) assert.equal(trustedPage(u,origin),false);
});
test('external links reject local protocols and embedded credentials',()=>{
 assert.ok(safeExternal('https://example.org/docs'));
 for(const u of ['file:///etc/passwd','javascript:alert(1)','http://localhost','https://user:pass@example.org']) assert.equal(safeExternal(u),false);
});
test('multi-display capture never substitutes the wrong screen',()=>{
 const sources=[{display_id:'12'},{display_id:'34'}]; assert.equal(captureSource(sources,34),sources[1]);assert.equal(captureSource(sources,56),undefined);
 assert.deepEqual(panelBounds({x:-1920,y:24,width:1920,height:1056}),{x:-540,y:24,width:540,height:650});
 assert.deepEqual(panelBounds({x:0,y:0,width:500,height:650}),{x:0,y:0,width:500,height:650});
});
