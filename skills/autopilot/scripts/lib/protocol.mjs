// Shared by the Node CLI and browser. No remote services or package dependencies.
export const PROTOCOL = 'autopilot-receipt/v1';
export const MAX_BYTES = 32 * 1024 * 1024;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
export const bytes = value => typeof value === 'string' ? enc.encode(value) : new Uint8Array(value);
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
export function base64(value) {
  let out = '';
  for (const v of bytes(value)) out += String.fromCharCode(v);
  return btoa(out);
}
export function unbase64(value) {
  if (typeof value !== 'string' || value.length > 400000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw Error('Invalid base64');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', bytes(value));
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
}
export const fingerprint = key => sha256(unbase64(key));
export function pemToBase64(pem) {
  if (!pem.includes('-----BEGIN PUBLIC KEY-----')) throw Error('Expected a public SPKI PEM key');
  return pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
}
export function safePath(path) {
  return typeof path === 'string' && path.length > 0 && path.length < 1024 &&
    !/[\\:\x00-\x1f]/.test(path) && !path.startsWith('/') &&
    path.split('/').every(p => p && p !== '.' && p !== '..');
}
export function isRepoEligible(path) { return safePath(path) && !/^(\.autopilot|\.openai)\//.test(path) && !/(^|\/)(\.env[^/]*|[^/]*\.(pem|key))$/i.test(path); }
function assertPayload(p) {
  if (!p || p.protocol !== PROTOCOL || p.claim !== 'Created with the Autopilot workflow' || p.algorithm !== 'Ed25519') throw Error('Unsupported receipt protocol');
  if (!/^[0-9a-f-]{36}$/.test(p.id) || !/^[a-f0-9]{64}$/.test(p.digest) || !Number.isFinite(Date.parse(p.createdAt))) throw Error('Invalid receipt fields');
  if (p.kind !== 'file' && p.kind !== 'repo') throw Error('Unsupported receipt kind');
  if (p.kind === 'file' && !['exact-bytes-v1', 'png-without-autopilot-chunk-v1'].includes(p.normalization)) throw Error('Unsupported normalization');
  if (p.kind === 'repo') {
    if (!Array.isArray(p.files) || !p.files.length || p.files.length > 1000) throw Error('Invalid repository file count');
    const paths = new Set();
    for (const f of p.files) {
      if (!safePath(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256) || !Number.isSafeInteger(f.size) || f.size < 0 || f.size > MAX_BYTES || paths.has(f.path)) throw Error('Invalid repository file entry');
      paths.add(f.path);
    }
  }
}
export async function verifyReceipt(receipt, artifact, trustedPublicKey) {
  try {
    if (canonical(receipt).length > 300000) throw Error('Receipt too large');
    const { payload: p, signature, publicKey } = receipt;
    assertPayload(p);
    const publicBytes = unbase64(publicKey);
    if (publicBytes.length !== 44 || unbase64(signature).length !== 64) throw Error('Invalid Ed25519 key or signature length');
    const key = await crypto.subtle.importKey('spki', publicBytes, 'Ed25519', false, ['verify']);
    const valid = await crypto.subtle.verify('Ed25519', key, unbase64(signature), bytes(canonical(p)));
    const fp = await fingerprint(publicKey);
    if (!valid) return { status: 'invalid', message: 'The receipt signature is invalid.' };
    const actual = p.kind === 'repo' ? await sha256(canonical(artifact)) : await sha256(p.normalization === 'png-without-autopilot-chunk-v1' ? stripPngReceipt(artifact).data : artifact);
    if (actual !== p.digest) return { status: 'mismatch', message: 'These bytes do not match the signed receipt.', fingerprint: fp };
    if (p.kind === 'repo' && canonical(p.files) !== canonical(artifact)) return { status: 'mismatch', message: 'The repository file list does not match.' };
    const trusted = trustedPublicKey && pemToBase64(trustedPublicKey) === publicKey;
    return {
      status: trusted ? 'trusted' : 'self-signed',
      message: trusted ? 'Artifact matches a receipt signed by your trusted key.' : 'Artifact matches a signed Autopilot declaration. The signer is not independently trusted.',
      fingerprint: fp, id: p.id, createdAt: p.createdAt, kind: p.kind,
      limitation: 'A signature authenticates a declaration and matching bytes; it does not prove how the artifact was made.'
    };
  } catch (error) { return { status: 'invalid', message: error.message }; }
}
export function markers(value) {
  const found = String(value).match(/\bAP1:[0-9a-f-]{36}\b/gi);
  return [...new Set(found || [])];
}

const PNG = [137,80,78,71,13,10,26,10];
const KEYWORD = 'AutopilotReceipt';
export function isPng(value) { const b = bytes(value); return PNG.every((v,i) => b[i] === v); }
function crc32(value) {
  let crc = 0xffffffff;
  for (const n of value) {
    crc ^= n;
    for (let j=0;j<8;j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function concat(parts) {
  const out = new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
  let i=0; for (const p of parts) { out.set(p,i); i+=p.length; }
  return out;
}
function chunks(value) {
  const b = bytes(value);
  if (!isPng(b) || b.length > MAX_BYTES) throw Error('Expected a PNG file up to 32 MiB');
  const found = []; let offset=8, end=false;
  while (offset < b.length) {
    if (offset+12>b.length) throw Error('Truncated PNG');
    const view=new DataView(b.buffer,b.byteOffset+offset);
    const length=view.getUint32(0), finish=offset+12+length;
    if (finish>b.length) throw Error('Invalid PNG chunk length');
    const raw=b.slice(offset,finish), type=String.fromCharCode(...raw.slice(4,8)), content=raw.slice(8,-4);
    if (crc32(raw.slice(4,-4)) !== new DataView(raw.buffer).getUint32(raw.length-4)) throw Error('Invalid PNG checksum');
    found.push({raw,type,content}); offset=finish;
    if (type==='IEND') { end=true; break; }
  }
  if (!end || offset!==b.length || found[0]?.type!=='IHDR') throw Error('Invalid PNG structure');
  return found;
}
function isReceiptChunk(c) { return c.type==='tEXt' && String.fromCharCode(...c.content.slice(0,KEYWORD.length+1)) === KEYWORD+'\0'; }
export function stripPngReceipt(value) {
  const list=chunks(value), embedded=list.filter(isReceiptChunk);
  if (embedded.length>1) throw Error('Multiple PNG receipts are ambiguous');
  let receipt;
  if (embedded.length) {
    const text=dec.decode(embedded[0].content.slice(KEYWORD.length+1));
    if (text.length>300000) throw Error('Embedded receipt too large');
    receipt=JSON.parse(dec.decode(unbase64(text)));
  }
  return { data:concat([Uint8Array.from(PNG),...list.filter(c=>!isReceiptChunk(c)).map(c=>c.raw)]), receipt };
}
export function embedPngReceipt(value,receipt) {
  const clean=stripPngReceipt(value).data;
  const content=bytes(KEYWORD+'\0'+base64(bytes(canonical(receipt))));
  const type=bytes('tEXt'), raw=new Uint8Array(content.length+12), view=new DataView(raw.buffer);
  view.setUint32(0,content.length); raw.set(type,4); raw.set(content,8); view.setUint32(raw.length-4,crc32(raw.slice(4,-4)));
  const list=chunks(clean);
  return concat([Uint8Array.from(PNG),...list.flatMap(c=>c.type==='IEND'?[raw,c.raw]:[c.raw])]);
}
