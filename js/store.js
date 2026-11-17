// Stockage local (IndexedDB) : réglages, dernier instantané déchiffré, actions en attente, conflits.
// Un seul magasin clé → valeur par base. La démo utilise sa propre base, distincte de la vraie.

export function base(nom) {
  let dbp = null;
  function ouvrir() {
    if (dbp) return dbp;
    dbp = new Promise((ok, ko) => {
      const r = indexedDB.open(nom, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    return dbp;
  }
  async function tx(mode, f) {
    const db = await ouvrir();
    return new Promise((ok, ko) => {
      const t = db.transaction('kv', mode);
      const req = f(t.objectStore('kv'));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error);
    });
  }
  return {
    lire: k => tx('readonly', s => s.get(k)),
    ecrire: (k, v) => tx('readwrite', s => s.put(v, k)),
    supprimer: k => tx('readwrite', s => s.delete(k)),
    // Efface la base (le cache du service worker ne contient que le code de l'application).
    async toutEffacer() {
      try { (await ouvrir()).close(); } catch (e) { /* base absente */ }
      dbp = null;
      await new Promise(ok => {
        const r = indexedDB.deleteDatabase(nom);
        r.onsuccess = r.onerror = r.onblocked = () => ok();
      });
    },
  };
}

export const persistant = base('coach-mobile');
export const demo = base('coach-mobile-demo');
