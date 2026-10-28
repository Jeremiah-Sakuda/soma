import { VaultError } from './vault.mjs';

const unavailable = () => { throw new VaultError('UNAVAILABLE'); };
const integrity = () => { throw new VaultError('INTEGRITY'); };
const MAX_BYTES = 65536;
const filename = (id) => {
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) integrity();
  return `credential-vault/${id}.json`;
};
const is404 = (error) => error?.code === 404 || error?.code === '404';

/** A dedicated vault bucket is preferred; do not grant collector identities access. */
export function createGcsVaultAdapter(bucket) {
  return Object.freeze({
    async read(id) {
      const path = filename(id);
      try {
        // Pin payload to its metadata generation, never combine two versions.
        for (let attempt = 0; attempt < 3; attempt++) {
          let metadata;
          try { [metadata] = await bucket.file(path).getMetadata(); }
          catch (error) { if (is404(error)) return null; throw error; }
          const generation = String(metadata.generation);
          const size = Number(metadata.size);
          if (!/^\d+$/.test(generation) || !Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) integrity();
          try {
            const [bytes] = await bucket.file(path, { generation }).download({ validation: 'crc32c' });
            if (bytes.length !== size || bytes.length > MAX_BYTES) integrity();
            let data;
            try { data = JSON.parse(bytes.toString('utf8')); } catch { integrity(); }
            return { generation, data };
          } catch (error) { if (!is404(error) || attempt === 2) throw error; }
        }
        unavailable();
      } catch (error) { if (error instanceof VaultError) throw error; unavailable(); }
    },
    async write(id, data, expectedGeneration) {
      const path = filename(id);
      if (expectedGeneration !== null && (typeof expectedGeneration !== 'string' || !/^\d+$/.test(expectedGeneration))) integrity();
      try {
        const bytes = Buffer.from(JSON.stringify(data), 'utf8');
        if (bytes.length > MAX_BYTES) integrity();
        await bucket.file(path).save(bytes, { resumable: false, validation: 'crc32c', timeout: 15000,
          contentType: 'application/json', metadata: { cacheControl: 'no-store' },
          preconditionOpts: { ifGenerationMatch: expectedGeneration ?? 0 } });
      } catch (error) {
        if (error instanceof VaultError) throw error;
        if (error?.code === 412 || error?.code === '412') throw new VaultError('CONFLICT');
        unavailable();
      }
    },
  });
}

// Castagnoli checksum for the Cloud KMS transport-integrity fields. TLS and GCM
// remain the security boundaries; a checksum mismatch is never retried silently.
export function vaultCrc32c(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0x82f63b78 : 0);
  }
  return String((crc ^ 0xffffffff) >>> 0);
}

/** accessToken obtains workload ADC; no exported service-account key is accepted. */
export function createKmsVaultAdapter({ keyName, accessToken, fetchImpl = fetch }) {
  if (typeof keyName !== 'string' || !/^projects\/[a-zA-Z0-9_-]+\/locations\/[a-zA-Z0-9_-]+\/keyRings\/[a-zA-Z0-9_-]+\/cryptoKeys\/[a-zA-Z0-9_-]+$/.test(keyName)
    || typeof accessToken !== 'function') unavailable();

  async function call(action, bytes, aad) {
    if (!Buffer.isBuffer(bytes) || !Buffer.isBuffer(aad) || bytes.length > 32768 || aad.length > 4096) integrity();
    const field = action === 'encrypt' ? 'plaintext' : 'ciphertext';
    try {
      const token = await accessToken();
      if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) unavailable();
      const response = await fetchImpl(`https://cloudkms.googleapis.com/v1/${keyName}:${action}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: bytes.toString('base64'), [`${field}Crc32c`]: vaultCrc32c(bytes),
          additionalAuthenticatedData: aad.toString('base64'), additionalAuthenticatedDataCrc32c: vaultCrc32c(aad) }),
      });
      if (!response.ok) unavailable();
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_BYTES) integrity();
      const result = JSON.parse(text);
      const outputField = action === 'encrypt' ? 'ciphertext' : 'plaintext';
      if (typeof result[outputField] !== 'string' || result[outputField].length > 32768) integrity();
      const output = Buffer.from(result[outputField], 'base64');
      if (!output.length || output.toString('base64') !== result[outputField]
        || String(result[`${outputField}Crc32c`]) !== vaultCrc32c(output)
        || action === 'encrypt' && (result.verifiedPlaintextCrc32c !== true || result.verifiedAdditionalAuthenticatedDataCrc32c !== true)) integrity();
      return output;
    } catch (error) { if (error instanceof VaultError) throw error; unavailable(); }
  }
  return Object.freeze({
    async wrap(dek, aad) {
      if (!Buffer.isBuffer(dek) || dek.length !== 32) integrity();
      return (await call('encrypt', dek, aad)).toString('base64');
    },
    async unwrap(wrapped, aad) {
      if (typeof wrapped !== 'string' || wrapped.length > 32768) integrity();
      const bytes = Buffer.from(wrapped, 'base64');
      if (bytes.toString('base64') !== wrapped) integrity();
      const result = await call('decrypt', bytes, aad);
      if (result.length !== 32) { result.fill(0); integrity(); }
      return result;
    },
  });
}
