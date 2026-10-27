import {spawnSync} from 'node:child_process';
import {describe,expect,it} from 'vitest';
const canary='synthetic-rotation-secret-must-not-be-printed';
describe('credential rotation command scope',()=>{
 it.each([[],['--account-root','wrong'],['--account-root','a'.repeat(64),'--all-accounts'],['--all-accounts','--apply','--dry-run'],['--all-accounts','--unexpected']].map(args=>({args})))('refuses invalid scope $args without storage access or secret logging',({args})=>{
   const result=spawnSync(process.execPath,['--experimental-strip-types','scripts/rotate-connector-key.mjs',...args],{encoding:'utf8',env:{...process.env,SOMA_CONNECTOR_ENCRYPTION_KEY:canary}});
   expect(result.status).toBe(1);expect(result.stderr).toContain('Credential rotation could not complete');expect(result.stderr+result.stdout).not.toContain(canary);
 });
 it('refuses an unconfigured v2 writer even with a syntactically valid account scope',()=>{
  const result=spawnSync(process.execPath,['--experimental-strip-types','scripts/rotate-connector-key.mjs','--account-root','a'.repeat(64)],{encoding:'utf8',env:{...process.env,SOMA_CONNECTOR_ENCRYPTION_KEY:'11'.repeat(32),SOMA_CONNECTOR_ENCRYPTION_KEY_ID:'legacy',SOMA_CONNECTOR_DECRYPTION_KEYS:'{}',SOMA_CONNECTOR_WRITE_FORMAT:'v1',FIREBASE_PROJECT_ID:'synthetic-rotation'}});
  expect(result.status).toBe(1);expect(result.stderr).not.toContain('11'.repeat(32));
 });
});
