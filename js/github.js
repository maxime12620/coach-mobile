// Accès au dépôt privé de données via l'API REST GitHub (contents API).
// Deux implémentations au même format : réelle (fetch vers api.github.com) et démo (fichiers locaux, actions en mémoire).

const API = 'https://api.github.com';

export class ErreurGitHub extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function b64utf8(texte) {
  const u = new TextEncoder().encode(texte);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

function quota(r) {
  const reste = r.headers.get('x-ratelimit-remaining');
  const reprise = r.headers.get('x-ratelimit-reset');
  return { reste: reste == null ? null : +reste, reprise: reprise ? new Date(+reprise * 1000) : null };
}

async function erreur(r, quoi) {
  const q = quota(r);
  if (r.status === 401) return new ErreurGitHub('Jeton refusé (expiré ou invalide)', 401);
  if ((r.status === 403 || r.status === 429) && q.reste === 0) {
    const h = q.reprise ? q.reprise.toTimeString().slice(0, 5) : '';
    return new ErreurGitHub('Quota GitHub atteint' + (h ? ', reprise à ' + h : ''), 429);
  }
  if (r.status === 403) return new ErreurGitHub('Accès refusé : vérifier les droits du jeton (Contents : lecture et écriture)', 403);
  if (r.status === 404) return new ErreurGitHub(quoi + ' introuvable', 404);
  return new ErreurGitHub(`GitHub a répondu ${r.status} (${quoi})`, r.status);
}

export function reel({ owner, repo, token }) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const entetes = (accept) => ({
    Accept: accept || 'application/vnd.github+json',
    Authorization: 'Bearer ' + token,
    'X-GitHub-Api-Version': '2022-11-28',
  });
  async function appel(url, init, quoi) {
    let r;
    try { r = await fetch(url, { cache: 'no-store', ...init }); }
    catch (e) { throw new ErreurGitHub('Pas de réseau', 0); }
    return r;
  }
  return {
    demo: false,
    // Contrôle d'accès : le dépôt doit exister, être privé et autoriser l'écriture.
    async verifierDepot() {
      const r = await appel(base, { headers: entetes() }, 'Dépôt');
      if (!r.ok) throw await erreur(r, 'Dépôt ' + owner + '/' + repo);
      const d = await r.json();
      if (!d.private) throw new ErreurGitHub('Le dépôt est public : refusé, il doit être privé', 'public');
      if (d.permissions && d.permissions.push === false) throw new ErreurGitHub('Le jeton ne permet pas d’écrire dans le dépôt', 'lecture');
      return { prive: true };
    },
    // Instantané brut (texte JSON de l'enveloppe). etag : requête conditionnelle, une réponse 304 ne consomme pas de quota.
    async lireInstantane(etag) {
      const h = entetes('application/vnd.github.raw+json');
      if (etag) h['If-None-Match'] = etag;
      const r = await appel(base + '/contents/instantane.json', { headers: h }, 'Instantané');
      if (r.status === 304) return { inchange: true, etag, quota: quota(r) };
      if (!r.ok) throw await erreur(r, 'Instantané');
      return { texte: await r.text(), etag: r.headers.get('etag'), quota: quota(r) };
    },
    // Dépôt d'une action. Un fichier déjà présent (422) signifie qu'un envoi précédent a abouti.
    async deposerAction(id, texte) {
      const r = await appel(base + '/contents/actions/' + encodeURIComponent(id) + '.json', {
        method: 'PUT', headers: { ...entetes(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'action', content: b64utf8(texte) }),
      }, 'Action');
      if (r.status === 201 || r.status === 200) return { ok: true, quota: quota(r) };
      if (r.status === 422) return { ok: true, deja: true, quota: quota(r) };
      throw await erreur(r, 'Dépôt de l’action');
    },
  };
}

// Démo : l'instantané vient de demo/instantane.json ; un « PC simulé » traite les actions déposées
// et publie un nouvel instantané (rechiffré) avec les accusés, à la synchronisation suivante.
export function demo({ chiffrerJSON, dechiffrerJSON, phrase, horsLigne }) {
  let courant = null, version = 0;
  const deposees = [];
  async function charger() {
    if (courant) return;
    const r = await fetch('demo/instantane.json', { cache: 'no-store' });
    if (!r.ok) throw new ErreurGitHub('Instantané de démonstration introuvable', 404);
    courant = { texte: await r.text(), etag: '"demo-0"' };
  }
  async function traiter() {
    if (!deposees.length) return;
    const snap = await dechiffrerJSON(JSON.parse(courant.texte), phrase);
    const maintenant = new Date().toISOString();
    for (const t of deposees.splice(0)) {
      const a = await dechiffrerJSON(JSON.parse(t), phrase);
      snap.acks = snap.acks || [];
      snap.acks.push(appliquerDemo(snap, a, maintenant));
    }
    snap.acks = snap.acks.slice(-200);
    snap.generated_at = maintenant;
    version++;
    courant = { texte: JSON.stringify(await chiffrerJSON(snap, phrase)), etag: `"demo-${version}"` };
  }
  return {
    demo: true,
    async verifierDepot() { if (horsLigne && horsLigne()) throw new ErreurGitHub('Pas de réseau', 0); return { prive: true }; },
    async lireInstantane(etag) {
      if (horsLigne && horsLigne()) throw new ErreurGitHub('Pas de réseau', 0);
      await charger();
      await traiter();
      if (etag && etag === courant.etag) return { inchange: true, etag };
      return { texte: courant.texte, etag: courant.etag, quota: { reste: 4999, reprise: null } };
    },
    async deposerAction(id, texte) {
      if (horsLigne && horsLigne()) throw new ErreurGitHub('Pas de réseau', 0);
      await charger();
      deposees.push(texte);
      return { ok: true };
    },
  };
}

// Comportement du PC, simplifié, pour la démo seulement.
function appliquerDemo(snap, a, at) {
  const S = snap.sessions || [];
  const p = a.payload || {};
  const ack = (result, message) => ({ id: a.id, result, message, at });
  const parId = id => S.find(s => s.id === id);
  const aujourdhui = (snap.today && snap.today.date) || at.slice(0, 10);
  if (a.type === 'move_session') {
    const s = parId(p.session_id);
    if (!s) return ack('conflict', 'Séance inexistante');
    if (s.date !== p.from_date) return ack('conflict', 'Séance déjà déplacée');
    if (p.to_date < aujourdhui) return ack('conflict', 'Date passée');
    const autres = S.filter(x => x.date === p.to_date && x !== s).sort((x, y) => x.order - y.order);
    autres.splice(Math.max(0, (p.position || autres.length + 1) - 1), 0, s);
    s.date = p.to_date;
    autres.forEach((x, k) => { x.order = k + 1; });
    S.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.order - y.order));
    return ack('applied', 'Séance déplacée');
  }
  if (a.type === 'swap_sessions') {
    const x = parId(p.a_id), y = parId(p.b_id);
    if (!x || !y) return ack('conflict', 'Séance inexistante');
    if (x.status === 'done' || y.status === 'done') return ack('conflict', 'Séance déjà réalisée');
    [x.date, y.date] = [y.date, x.date];
    [x.order, y.order] = [y.order, x.order];
    S.sort((u, v) => (u.date < v.date ? -1 : u.date > v.date ? 1 : u.order - v.order));
    return ack('applied', 'Séances interverties');
  }
  if (a.type === 'feeling' || a.type === 'pain') {
    snap.wellness = snap.wellness || [];
    snap.wellness.push(a.type === 'feeling'
      ? { date: p.date, kind: p.session_id ? 'session' : 'checkin', session_id: p.session_id ?? null, rpe: p.rpe ?? null, legs: p.legs ?? null, breath: p.breath ?? null, comment: p.comment ?? null }
      : { date: p.date, kind: 'pain', zone: p.zone, intensity: p.intensity, comment: p.comment ?? null, session_id: p.session_id ?? null });
    return ack('applied', a.type === 'feeling' ? 'Ressenti enregistré' : 'Douleur enregistrée');
  }
  if (a.type === 'sync_request') return ack('applied', 'Demande de synchro reçue');
  if (a.type === 'strength_session') {
    const B = snap.strength; if (!B) return ack('conflict', 'Action invalide');
    if (!p.exercises || !p.exercises.length) return ack('conflict', 'aucun exercice');
    const L = B.sessions;
    let s = p.session_id != null ? L.find(x => x.id === p.session_id) : L.find(x => x.uid === p.uid);
    if (p.session_id != null && !s) return ack('conflict', 'séance de muscu introuvable sur le PC (supprimée ?)');
    const neuf = !s;
    if (neuf) { s = { id: 900 + L.length, uid: p.uid, activity_id: null }; L.push(s); }
    Object.assign(s, { date: p.date, title: p.title, note: p.note, exercises: p.exercises.map(e => ({ exercise: e.exercise, note: e.note, sets: e.sets })) });
    for (const e of p.exercises) {
      const w = e.sets.filter(x => !x.set_type).map(x => [x.reps, x.load_kg]);
      if (!B.exercises[e.exercise]) B.exercises[e.exercise] = { label: e.exercise, last: null };
      if (w.length) B.exercises[e.exercise].last = { date: p.date, sets: w };
    }
    return ack('applied', neuf ? 'Séance de muscu enregistrée' : 'Séance de muscu mise à jour');
  }
  // D75 : suppression, intitulé et type, muscu supprimée, rattachement, retour sur l'appli (PC de démonstration)
  if (a.type === 'delete_session') {
    const k = S.findIndex(x => x.id === p.session_id);
    if (k < 0) return ack('conflict', 'séance inexistante');
    if (p.from_date && S[k].date !== p.from_date) return ack('conflict', 'séance déplacée depuis');
    S.splice(k, 1);
    return ack('applied', 'Séance supprimée');
  }
  if (a.type === 'edit_session') {
    const s = parId(p.session_id);
    if (!s) return ack('conflict', 'séance inexistante');
    if (p.title) s.title = p.title;
    if (p.type) s.type = p.type;
    if (p.kind) s.type = { leg: 'strength_legs', abdos: 'mobility', hyrox: 'strength_full' }[p.kind] || 'strength_upper';
    return ack('applied', 'Séance modifiée');
  }
  if (a.type === 'delete_strength_session') {
    const L = (snap.strength && snap.strength.sessions) || [];
    const k = L.findIndex(x => (p.session_id != null && x.id === p.session_id) || (p.uid && x.uid === p.uid));
    if (k < 0) return ack('conflict', 'séance de muscu introuvable (déjà supprimée ?)');
    L.splice(k, 1);
    return ack('applied', 'Séance de muscu supprimée');
  }
  if (a.type === 'link_activity') {
    const x = (snap.activities || []).find(y => y.id === p.activity_id);
    if (!x) return ack('conflict', 'activité introuvable');
    x.plan_link = p.reset ? null : p.session_id == null ? 'none' : 'manual';
    if (!p.reset) {
      for (const s of S) {
        if (s.activity_id === x.id || (s.realized && (s.realized.activity_ids || []).includes(x.id))) {
          s.activity_id = null; s.realized = null; s.compliance = s.date < snap.today.date ? 'missed' : 'upcoming';
        }
      }
      x.session_id = p.session_id ?? null;
      const t = x.session_id != null ? parId(x.session_id) : null;
      if (t) Object.assign(t, { activity_id: x.id, compliance: 'done', realized: { activity_ids: [x.id], distance_m: x.distance_m, duration_s: x.duration_s, pace_s_km: x.pace_s_km, avg_hr: x.avg_hr } });
    }
    return ack('applied', p.reset ? 'Rattachement automatique rétabli' : p.session_id == null ? 'Activité laissée hors plan' : 'Activité rattachée');
  }
  if (a.type === 'app_feedback') return p.text ? ack('applied', 'Retour enregistré') : ack('conflict', 'retour vide');
  if (a.type === 'debrief_todo') {
    const s = parId(p.session_id);
    if (!s) return ack('conflict', 'Séance inexistante');
    s.debrief_todo = true;
    return ack('applied', 'Débrief noté pour le PC');
  }
  return ack('conflict', 'Action invalide');
}
