import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {CredentialCipher,CredentialCryptoError,credentialBinding} from '../../src/lib/server/credential-crypto';
const old='11'.repeat(32),next='22'.repeat(32),context=credentialBinding('owner','workspace','google-gmail'),payload={refreshToken:'original-synthetic-token',contextId:'original-synthetic-context'};
const env=(key=old,id='legacy',extra:Record<string,string>={},format='v2')=>({SOMA_CONNECTOR_ENCRYPTION_KEY:key,SOMA_CONNECTOR_ENCRYPTION_KEY_ID:id,SOMA_CONNECTOR_DECRYPTION_KEYS:JSON.stringify(extra),SOMA_CONNECTOR_WRITE_FORMAT:format});
function legacySeal(value:unknown){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(old,'hex'),nonce);cipher.setAAD(Buffer.from(context));const encrypted=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return ['v1',nonce.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');}
describe('versioned credential protection and reader-first rollout',()=>{
 it('defaults to the original format and remains readable by the independent legacy reader',()=>{
  const cipher=new CredentialCipher({SOMA_CONNECTOR_ENCRYPTION_KEY:old}),encrypted=cipher.encrypt(payload,context),[format,nonce,tag,body]=encrypted.split('.');expect(format).toBe('v1');
  const reader=createDecipheriv('aes-256-gcm',Buffer.from(old,'hex'),Buffer.from(nonce,'base64url'));reader.setAAD(Buffer.from(context));reader.setAuthTag(Buffer.from(tag,'base64url'));
  expect(JSON.parse(Buffer.concat([reader.update(Buffer.from(body,'base64url')),reader.final()]).toString())).toEqual(payload);
 });
 it('preloads a future key, reads both formats, migrates once and supports a reader-compatible rollback',()=>{
  const original=legacySeal(payload),preloaded=new CredentialCipher(env(old,'legacy',{next},'v1')),active=new CredentialCipher(env(next,'next',{legacy:old}));
  const migrated=active.rewrap(original,context);expect(migrated.changed).toBe(true);expect(migrated.encrypted.startsWith('v2.next.')).toBe(true);
  expect(preloaded.decrypt(migrated.encrypted,context)).toEqual(payload);expect(active.decrypt(original,context)).toEqual(payload);expect(active.rewrap(migrated.encrypted,context)).toEqual({encrypted:migrated.encrypted,changed:false});
  const retired=new CredentialCipher(env(next,'next'));expect(retired.decrypt(migrated.encrypted,context)).toEqual(payload);expect(()=>retired.decrypt(original,context)).toThrow(CredentialCryptoError);
  const rollback=new CredentialCipher(env(old,'legacy',{next})),restored=rollback.rewrap(migrated.encrypted,context);expect(restored.encrypted.startsWith('v2.legacy.')).toBe(true);expect(active.decrypt(restored.encrypted,context)).toEqual(payload);
 });
 it('authenticates key identifiers, format and owner context even when key bytes have an alias',()=>{
  const cipher=new CredentialCipher(env(old,'legacy',{alias:old})),encrypted=cipher.encrypt(payload,context);
  expect(()=>cipher.decrypt(encrypted.replace('v2.legacy.','v2.alias.'),context)).toThrow(CredentialCryptoError);
  expect(()=>cipher.decrypt(encrypted.replace('v2.legacy.','v1.'),context)).toThrow(CredentialCryptoError);
  expect(()=>cipher.decrypt(encrypted,credentialBinding('other-owner','workspace','google-gmail'))).toThrow(CredentialCryptoError);
  expect(()=>new CredentialCipher(env(next,'next')).decrypt(encrypted,context)).toThrow(CredentialCryptoError);
 });
 it('fails closed on damaged envelopes and missing keys without rewrapping corruption',()=>{
  const cipher=new CredentialCipher(env()),encrypted=cipher.encrypt(payload,context),parts=encrypted.split('.');parts[3]=Buffer.alloc(16).toString('base64url');
  for(const raw of [parts.join('.'),encrypted+'.extra','v2.unknown.'+encrypted.split('.').slice(2).join('.'),'v1....',encrypted.slice(0,-5)])expect(()=>cipher.rewrap(raw,context)).toThrow(CredentialCryptoError);
 });
 it('bounds the key set and plaintext bytes and keeps key material out of serializable metadata',()=>{
  const cipher=new CredentialCipher(env());expect(JSON.stringify(cipher)).not.toContain(old);
  for(const invalid of [{...env(),SOMA_CONNECTOR_ENCRYPTION_KEY_ID:'bad.id'},{...env(),SOMA_CONNECTOR_DECRYPTION_KEYS:JSON.stringify({legacy:next})},{...env(),SOMA_CONNECTOR_DECRYPTION_KEYS:JSON.stringify({a:old,b:old,c:old,d:old,e:old})},{...env(),SOMA_CONNECTOR_DECRYPTION_KEYS:'[]'},{...env(),SOMA_CONNECTOR_ENCRYPTION_KEY:'bad-secret-canary'}])expect(()=>new CredentialCipher(invalid)).toThrow(CredentialCryptoError);
  expect(()=>cipher.encrypt('界'.repeat(22000),context)).toThrow(CredentialCryptoError);
  expect(()=>cipher.encrypt(undefined,context)).toThrow(CredentialCryptoError);
  const full='x'.repeat(65534);expect(cipher.decrypt(cipher.encrypt(full,context),context)).toBe(full);
 });
});
