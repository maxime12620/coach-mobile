// Enveloppe chiffrée partagée avec le PC :
// {"v":1,"kdf":"PBKDF2-SHA256","iter":600000,"salt":b64,"iv":b64,"ct":b64}
// AES-256-GCM, clé dérivée de la phrase secrète par PBKDF2-SHA256. ct contient le texte chiffré suivi de l'étiquette GCM (16 octets), comme WebCrypto.
// Le texte clair est du JSON en UTF-8.

const subtle = globalThis.crypto.subtle;
const ITER = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(bytes) {
  let s = '';
  const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) {
  const s = atob(String(str).replace(/\s+/g, ''));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

// La dérivation coûte environ une seconde sur téléphone : on garde les clés en mémoire, par sel.
const cache = new Map();
async function cle(phrase, sel, iter) {
  const k = iter + ':' + b64(sel) + ':' + phrase;
  if (cache.has(k)) return cache.get(k);
  const p = (async () => {
    const base = await subtle.importKey('raw', enc.encode(phrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  })();
  cache.set(k, p);
  p.catch(() => cache.delete(k));
  return p;
}
export function oublierCles() { cache.clear(); }

export class ErreurDechiffrement extends Error {}

export function estEnveloppe(o) {
  return o && typeof o === 'object' && o.v === 1 && typeof o.ct === 'string' && typeof o.iv === 'string' && typeof o.salt === 'string';
}

export async function dechiffrer(env, phrase) {
  if (!estEnveloppe(env)) throw new ErreurDechiffrement('Format d’enveloppe inconnu');
  if (env.kdf && env.kdf !== 'PBKDF2-SHA256') throw new ErreurDechiffrement('Dérivation non prise en charge : ' + env.kdf);
  const iter = env.iter || ITER;
  if (iter < 100000 || iter > 10000000) throw new ErreurDechiffrement('Nombre d’itérations hors bornes');
  const k = await cle(phrase, unb64(env.salt), iter);
  let clair;
  try {
    clair = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.ct));
  } catch (e) {
    throw new ErreurDechiffrement('Phrase secrète incorrecte ou données altérées');
  }
  return dec.decode(clair);
}

export async function dechiffrerJSON(env, phrase) {
  return JSON.parse(await dechiffrer(env, phrase));
}

// Le sel est réutilisé pour tout ce que ce téléphone chiffre (clé dérivée une seule fois) ; l'IV est neuf à chaque message.
export async function chiffrer(texte, phrase, sel) {
  const s = sel || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const k = await cle(phrase, s, ITER);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(texte));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(s), iv: b64(iv), ct: b64(ct) };
}

export async function chiffrerJSON(obj, phrase, sel) {
  return chiffrer(JSON.stringify(obj), phrase, sel);
}

export function nouveauSel() { return globalThis.crypto.getRandomValues(new Uint8Array(16)); }

export function uuid() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const u = globalThis.crypto.getRandomValues(new Uint8Array(16));
  u[6] = (u[6] & 0x0f) | 0x40; u[8] = (u[8] & 0x3f) | 0x80;
  const h = [...u].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
