// SafePic web crypto — pure browser, no Node APIs.
//
// .enc file format (PQIE). Writes v2; reads v1 and v2.
//   v1: "PQIE" | 0x01 | salt[16] | wrap | kem_ct | data          (scrypt N=2^15, r=8, p=1)
//   v2: "PQIE" | 0x02 | logN | r | p | salt[16] | wrap | kem_ct | data
// where wrap = iv[12] | tag[16] | u32le len | ct   (ML-KEM secret key under the password key)
//       data = iv[12] | tag[16] | u32le len | ct   (image under SHA-256 of the KEM shared secret)
//
// Security note: the password is what protects a file. scrypt + AES-256-GCM
// are quantum-resistant on their own; the per-file ML-KEM-768 key pair keeps
// the format ready for public-key sharing.

import { scryptAsync } from '@noble/hashes/scrypt';
import { sha256 } from '@noble/hashes/sha256';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

const MAGIC_BYTES = new TextEncoder().encode('PQIE'); // [0x50, 0x51, 0x49, 0x45]
const VERSION = 2;

// scrypt cost for new files (OWASP minimum: N=2^17, r=8, p=1 → 128 MiB).
const KDF = { logN: 17, r: 8, p: 1 };
const V1_KDF = { logN: 15, r: 8, p: 1 };

// --- KDF -----------------------------------------------------------
function checkKdf({ logN, r, p }) {
  // Bounds stop a crafted file from demanding gigabytes of memory or
  // minutes of CPU when someone tries to open it.
  if (logN < 14 || logN > 20 || r < 1 || r > 16 || p < 1 || p > 4) {
    throw new Error('Unsupported encryption parameters');
  }
}
function kdf(password, salt, { logN, r, p }) {
  const pwBytes = typeof password === 'string'
    ? new TextEncoder().encode(password)
    : password;
  return scryptAsync(pwBytes, salt, { N: 2 ** logN, r, p, dkLen: 32 });
}

// --- AES-GCM via WebCrypto -----------------------------------------
async function importAesKey(rawKey) {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function aesEncrypt(rawKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(rawKey);
  const ctWithTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  // Web Crypto appends the 16-byte GCM tag; split it out so the format
  // matches the desktop layout (iv | tag | ct).
  const tag = ctWithTag.slice(ctWithTag.length - 16);
  const ct = ctWithTag.slice(0, ctWithTag.length - 16);
  return { iv, ct, tag };
}

async function aesDecrypt(rawKey, iv, tag, ct) {
  const key = await importAesKey(rawKey);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct, 0);
  combined.set(tag, ct.length);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined),
  );
}

// --- buffer helpers ------------------------------------------------
function u32leToBytes(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
function readU32le(arr, offset) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength).getUint32(offset, true);
}
function concatBytes(...arrs) {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// --- Public API ---------------------------------------------------
export async function encryptImage(imageBytes, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kdfKey = await kdf(password, salt, KDF);

  const { publicKey, secretKey } = ml_kem768.keygen();
  const { cipherText: kemCt, sharedSecret } = ml_kem768.encapsulate(publicKey);

  const wrap = await aesEncrypt(kdfKey, secretKey);
  const dataKey = sha256(sharedSecret);
  const data = await aesEncrypt(dataKey, imageBytes);

  return concatBytes(
    MAGIC_BYTES,
    new Uint8Array([VERSION, KDF.logN, KDF.r, KDF.p]),
    salt,
    wrap.iv, wrap.tag, u32leToBytes(wrap.ct.length), wrap.ct,
    u32leToBytes(kemCt.length), kemCt,
    data.iv, data.tag, u32leToBytes(data.ct.length), data.ct,
  );
}

export async function decryptImage(fileBytes, password) {
  const f = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  let o = 0;
  const read = (n) => {
    if (o + n > f.length) throw new Error('File is truncated or corrupt');
    const s = f.slice(o, o + n); o += n; return s;
  };
  const u32 = () => { const v = readU32le(f, o); o += 4; return v; };

  if (f.length < 5 || !bytesEqual(read(4), MAGIC_BYTES)) throw new Error('Not a PQIE file');
  const version = read(1)[0];
  let params;
  if (version === 1) {
    params = V1_KDF;
  } else if (version === 2) {
    const [logN, r, p] = read(3);
    params = { logN, r, p };
    checkKdf(params);
  } else {
    throw new Error('Unsupported file version');
  }

  const salt = read(16);
  const wrapIv = read(12), wrapTag = read(16);
  const wrappedSk = read(u32());
  const kemCt = read(u32());
  const dataIv = read(12), dataTag = read(16);
  const dataCt = read(u32());

  const kdfKey = await kdf(password, salt, params);
  let sk;
  try {
    sk = await aesDecrypt(kdfKey, wrapIv, wrapTag, wrappedSk);
  } catch {
    throw new Error('Incorrect password');
  }

  const sharedSecret = ml_kem768.decapsulate(kemCt, sk);
  const dataKey = sha256(sharedSecret);
  return aesDecrypt(dataKey, dataIv, dataTag, dataCt);
}
