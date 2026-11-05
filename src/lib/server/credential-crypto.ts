import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class CredentialCryptoError extends Error {
  readonly code: 'configuration' | 'unavailable' | 'capacity';
  constructor(code: 'configuration' | 'unavailable' | 'capacity') {
    super('Credential protection is unavailable.');
    this.code = code;
  }
}
const MAX_BYTES = 64 * 1024,
  keyId = /^[A-Za-z0-9_-]{1,32}$/;
export const credentialBinding = (uid: string, workspaceId: string, id: string) =>
  JSON.stringify({ uid, workspaceId, id });

function decodeKey(raw: string): Buffer {
  let value: Buffer;
  if (/^[a-f0-9]{64}$/i.test(raw)) value = Buffer.from(raw, 'hex');
  else if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) value = Buffer.from(raw, 'base64');
  else if (/^[A-Za-z0-9_-]{43}$/.test(raw)) value = Buffer.from(raw, 'base64url');
  else throw new CredentialCryptoError('configuration');
  if (value.length !== 32) throw new CredentialCryptoError('configuration');
  return value;
}
type Envelope = {
  format: 'v1' | 'v2';
  keyId?: string;
  nonce: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};
function parseEnvelope(raw: string): Envelope {
  if (typeof raw !== 'string' || raw.length > 90_000)
    throw new CredentialCryptoError('unavailable');
  const parts = raw.split('.'),
    format = parts.shift();
  if (format !== 'v1' && format !== 'v2') throw new CredentialCryptoError('unavailable');
  const id = format === 'v2' ? parts.shift() : undefined;
  if (
    (format === 'v2' && (!id || !keyId.test(id))) ||
    parts.length !== 3 ||
    parts.some((value) => !value || !/^[A-Za-z0-9_-]+$/.test(value))
  )
    throw new CredentialCryptoError('unavailable');
  const [nonce, tag, ciphertext] = parts.map((value) => Buffer.from(value, 'base64url'));
  if (
    nonce.length !== 12 ||
    tag.length !== 16 ||
    ciphertext.length < 1 ||
    ciphertext.length > MAX_BYTES ||
    parts.some((value, index) => [nonce, tag, ciphertext][index].toString('base64url') !== value)
  )
    throw new CredentialCryptoError('unavailable');
  return { format, ...(id ? { keyId: id } : {}), nonce, tag, ciphertext };
}

/** Key material stays private. Both application storage and rotation use this interface. */
export class CredentialCipher {
  readonly activeId: string;
  readonly writeFormat: 'v1' | 'v2';
  #keys: Map<string, Buffer>;
  constructor(env: Record<string, string | undefined> = process.env) {
    this.activeId = env.SOMA_CONNECTOR_ENCRYPTION_KEY_ID || 'legacy';
    const format = env.SOMA_CONNECTOR_WRITE_FORMAT || 'v1';
    if (!keyId.test(this.activeId) || !['v1', 'v2'].includes(format))
      throw new CredentialCryptoError('configuration');
    this.writeFormat = format as 'v1' | 'v2';
    this.#keys = new Map([[this.activeId, decodeKey(env.SOMA_CONNECTOR_ENCRYPTION_KEY || '')]]);
    let additional: unknown = {};
    try {
      const raw = env.SOMA_CONNECTOR_DECRYPTION_KEYS || '{}';
      if (raw.length > 4096) throw new Error();
      additional = JSON.parse(raw);
    } catch {
      throw new CredentialCryptoError('configuration');
    }
    if (
      !additional ||
      typeof additional !== 'object' ||
      Array.isArray(additional) ||
      Object.keys(additional).length > 4
    )
      throw new CredentialCryptoError('configuration');
    for (const [id, value] of Object.entries(additional)) {
      if (!keyId.test(id) || id === this.activeId || typeof value !== 'string')
        throw new CredentialCryptoError('configuration');
      this.#keys.set(id, decodeKey(value));
    }
  }
  #aad(format: 'v1' | 'v2', id: string, context: string): Buffer {
    return Buffer.from(format === 'v1' ? context : JSON.stringify({ format, keyId: id, context }));
  }
  encrypt(value: unknown, context: string): string {
    let plaintext: Buffer;
    try {
      const json = JSON.stringify(value);
      if (json === undefined) throw new Error();
      plaintext = Buffer.from(json, 'utf8');
    } catch {
      throw new CredentialCryptoError('unavailable');
    }
    if (plaintext.length > MAX_BYTES) throw new CredentialCryptoError('capacity');
    const nonce = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.#keys.get(this.activeId)!, nonce);
    cipher.setAAD(this.#aad(this.writeFormat, this.activeId, context));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return [
      this.writeFormat,
      ...(this.writeFormat === 'v2' ? [this.activeId] : []),
      nonce.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }
  #open(raw: string, context: string): { value: unknown; keyId: string; format: 'v1' | 'v2' } {
    const envelope = parseEnvelope(raw);
    const candidates =
      envelope.format === 'v2'
        ? [[envelope.keyId!, this.#keys.get(envelope.keyId!)] as const]
        : [...this.#keys];
    for (const [id, key] of candidates) {
      if (!key) continue;
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, envelope.nonce);
        decipher.setAAD(this.#aad(envelope.format, id, context));
        decipher.setAuthTag(envelope.tag);
        const value = JSON.parse(
          Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]).toString('utf8'),
        );
        return { value, keyId: id, format: envelope.format };
      } catch {
        /* Try only the bounded configured keys for unlabelled legacy envelopes. */
      }
    }
    throw new CredentialCryptoError('unavailable');
  }
  decrypt<T>(raw: string, context: string): T {
    return this.#open(raw, context).value as T;
  }
  /** Authentication is checked even when an envelope already uses the target key. */
  rewrap(raw: string, context: string): { encrypted: string; changed: boolean } {
    const current = this.#open(raw, context);
    if (current.keyId === this.activeId && current.format === this.writeFormat)
      return { encrypted: raw, changed: false };
    return { encrypted: this.encrypt(current.value, context), changed: true };
  }
}
