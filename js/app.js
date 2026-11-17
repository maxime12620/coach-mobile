// Application : état, synchronisation avec le dépôt de données, fenêtres, actions, glisser-déposer.
import * as C from './crypto.js';
import * as ST from './store.js';
import * as GH from './github.js';
import { construire, semaineCourante, esc, f1, fk, dd, jl, jlong, addD, ecart, QUAL, muKind } from './plan.js';
import { vVolume, vFil, vAgenda, vFocus, vAujourdhui, detail, formRessenti } from './vues.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.get('demo') === '1';
const $ = id => document.getElementById(id);
const store = DEMO ? ST.demo : ST.persistant;

const E = {
  cfg: null, gh: null, snap: null, etag: null, M: null,
  actions: [],      // actions locales non accusées : {id, created_at, type, payload, etat: 'a_envoyer' | 'envoyee'}
  conflits: [],     // {id, message, lib}
  debriefs: [],     // séances dont le débrief a été accepté par le PC
  vue: 'fil', selW: null, cur: -1, saisie: {}, saisieJour: null,
  occupe: false, msg: '', msgErr: false, horsLigneForce: false, reglages: false,
};

// ---------- persistance ----------
const sauverActions = () => store.ecrire('actions', E.actions);
const sauverConflits = () => store.ecrire('conflits', E.conflits);

function client(cfg) {
  if (DEMO) return GH.demo({ chiffrerJSON: C.chiffrerJSON, dechiffrerJSON: C.dechiffrerJSON, phrase: cfg.phrase, horsLigne: () => E.horsLigneForce || !navigator.onLine });
  return GH.reel(cfg);
}

function modele() {
  if (!E.snap) { E.M = null; return; }
  const pend = E.actions.filter(a => a.type === 'move_session' || a.type === 'swap_sessions');
  E.M = construire(E.snap, pend, DEMO && E.snap.today ? { T: E.snap.today.date } : {});
}

// ---------- libellés ----------
function libAction(a) {
  const S = E.M ? E.M.S : [], t = id => { const s = S.find(x => x.id === id); return s ? s.t : 'séance ' + id; };
  const p = a.payload || {};
  switch (a.type) {
    case 'move_session': return `${t(p.session_id)} → ${jl(p.to_date)}`;
    case 'swap_sessions': return `${t(p.a_id)} ⇄ ${t(p.b_id)}`;
    case 'feeling': return 'Ressenti' + (p.session_id ? ' · ' + t(p.session_id) : ' du jour');
    case 'pain': return 'Douleur ' + (p.zone || '');
    case 'debrief_todo': return 'Débrief · ' + t(p.session_id);
    default: return a.type;
  }
}

// ---------- synchronisation ----------
function message(t, err) { E.msg = t; E.msgErr = !!err; entete(); }

async function synchroniser() {
  if (E.occupe || !E.cfg) return;
  E.occupe = true; entete();
  try {
    // 1. envoi des actions en file
    for (const a of E.actions.filter(x => x.etat === 'a_envoyer')) {
      const env = await C.chiffrerJSON({ id: a.id, created_at: a.created_at, type: a.type, payload: a.payload }, E.cfg.phrase);
      await E.gh.deposerAction(a.id, JSON.stringify(env));
      a.etat = 'envoyee';
      await sauverActions();
      entete();
    }
    // 2. instantané (requête conditionnelle)
    const r = await E.gh.lireInstantane(E.etag);
    if (!r.inchange) {
      let env;
      try { env = JSON.parse(r.texte); } catch (e) { throw new Error('Instantané illisible'); }
      const snap = await C.dechiffrerJSON(env, E.cfg.phrase);
      E.snap = snap; E.etag = r.etag;
      traiterAcks();
      await store.ecrire('snap', snap);
      await store.ecrire('etag', r.etag);
    }
    await store.ecrire('derniere', new Date().toISOString());
    const reste = r.quota && r.quota.reste;
    message('Synchronisé à ' + heure(new Date()) + (reste != null && reste < 500 ? ` · quota GitHub restant ${reste}` : ''));
  } catch (e) {
    const horsLigne = e.code === 0;
    message(horsLigne ? 'Hors ligne' + (E.actions.length ? ' · actions gardées sur le téléphone' : '') : (e.message || 'Erreur de synchronisation'), !horsLigne);
    if (e.code === 404 && !E.snap) message('Aucun instantané publié par le PC pour l’instant', true);
  } finally {
    E.occupe = false;
    modele(); rendre();
    // fenêtre de détail ouverte : la rafraîchir, sauf pendant une saisie
    const saisie = c.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (ouverte && E.ecran === 'detail' && !saisie) {
      const sc = c.parentNode.scrollTop; montrer(E.cur); c.parentNode.scrollTop = sc;
    }
  }
}

function traiterAcks() {
  const acks = new Map((E.snap.acks || []).map(a => [a.id, a]));
  const restent = [];
  modele();
  for (const a of E.actions) {
    const k = acks.get(a.id);
    if (!k) { restent.push(a); continue; }
    if (k.result === 'conflict') E.conflits.push({ id: a.id, message: k.message || 'Conflit', lib: libAction(a) });
    else if (a.type === 'debrief_todo' && !E.debriefs.includes(a.payload.session_id)) E.debriefs.push(a.payload.session_id);
  }
  E.actions = restent;
  sauverActions(); sauverConflits(); store.ecrire('debriefs', E.debriefs);
}

async function ajouterAction(type, payload) {
  const a = { id: C.uuid(), created_at: isoLocal(new Date()), type, payload, etat: 'a_envoyer' };
  E.actions.push(a);
  await sauverActions();
  modele(); rendre();
  synchroniser();
  return a;
}

const heure = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
function isoLocal(d) {
  const o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-', a = Math.abs(o);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}

// ---------- en-tête ----------
function entete() {
  const g = E.snap && E.snap.generated_at ? new Date(E.snap.generated_at) : null;
  $('date-donnees').textContent = g && !isNaN(g) ? `Données du ${g.getDate()}/${String(g.getMonth() + 1).padStart(2, '0')} à ${heure(g)}` : (E.cfg ? 'Pas encore de données' : 'Coach');
  const n = E.actions.length;
  $('attente').hidden = !n;
  $('attente').textContent = n;
  $('attente').title = n + ' action' + (n > 1 ? 's' : '') + ' en attente du PC';
  $('msg').textContent = E.occupe ? 'Synchronisation…' : (n ? `${n} en attente du PC` + (E.msg ? ' · ' + E.msg : '') : E.msg);
  $('msg').classList.toggle('err', E.msgErr && !E.occupe);
  $('sync').disabled = E.occupe || !E.cfg;
  $('sync').classList.toggle('tourne', E.occupe);
  $('sync').hidden = !E.cfg;
  $('sel').style.top = $('haut').offsetHeight + 'px';
}

// ---------- vues ----------
const VUES = [['fil', 'À venir'], ['agenda', 'Agenda'], ['focus', 'Semaine'], ['jour', 'Aujourd’hui']];
const etroit = () => innerWidth < 760;

function rendre(defiler) {
  entete();
  const sel = $('sel'), vue = $('vue');
  if (!E.cfg || E.reglages) { sel.innerHTML = ''; $('conflits').innerHTML = ''; vue.innerHTML = ecranReglages(); return; }
  sel.innerHTML = VUES.map(([k, n]) => `<button type="button" data-v="${k}" class="${k === E.vue ? 'on' : ''}">${n}</button>`).join('');
  $('conflits').innerHTML = E.conflits.map(c => `<div class="cfl"><span>⚠ <b>${esc(c.message)}</b> · ${esc(c.lib)}</span><button type="button" data-act="cfl-x" data-id="${c.id}" aria-label="Masquer">×</button></div>`).join('');
  const M = E.M;
  if (!M) { vue.innerHTML = `<p class="m">${E.occupe ? 'Chargement…' : 'Pas encore de données. Touchez « Synchroniser ».'}</p>`; return; }
  if (!M.W.length && E.vue !== 'jour') { vue.innerHTML = '<p class="m">Aucune séance dans l’instantané.</p>'; return; }
  const n = E.selW != null ? E.selW : semaineCourante(M);
  if (E.vue === 'fil') vue.innerHTML = vFil(M, E.selW);
  else if (E.vue === 'agenda') vue.innerHTML = vVolume(M, n, etroit()) + vAgenda(M, n);
  else if (E.vue === 'focus') vue.innerHTML = vVolume(M, n, etroit()) + vFocus(M, n);
  else vue.innerHTML = vAujourdhui(M);
  const sc = $('sc-vol');
  if (sc) { const bw = etroit() ? 34 : 46; sc.scrollLeft = Math.max(0, 30 + (M.avant.length + n) * bw - sc.clientWidth / 2); }
  if (defiler && E.vue === 'agenda') { const el = $('v-w' + n); if (el) scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - 100), behavior: 'smooth' }); }
  if (E.vue !== 'jour' && E.vue !== 'fil' || defiler === 'haut') { /* rien */ }
  try { localStorage.setItem('coach-vue', E.vue); } catch (e) { /* stockage indisponible */ }
}

// ---------- fenêtres ----------
const fond = $('fond'), c = $('c');
let ouverte = false;
function ouvrir(html) {
  E.ecran = 'autre';
  c.innerHTML = html;
  if (!ouverte) { ouverte = true; fond.classList.add('on'); history.pushState({ fen: 1 }, ''); document.body.style.overflow = 'hidden'; }
  c.parentNode.scrollTop = 0;
}
function fermer(parHistorique) {
  if (!ouverte) return;
  ouverte = false; fond.classList.remove('on'); document.body.style.overflow = '';
  E.cur = -1; E.pend = null;
  if (!parHistorique && history.state && history.state.fen) history.back();
}
$('x').addEventListener('click', () => fermer());
let bas = null;
fond.addEventListener('pointerdown', e => { bas = e.target === fond ? [e.clientX, e.clientY] : null; });
fond.addEventListener('pointerup', e => { if (bas && e.target === fond && Math.hypot(e.clientX - bas[0], e.clientY - bas[1]) < 5) fermer(); bas = null; });
addEventListener('popstate', () => { if (ouverte) fermer(true); });

function montrer(i) {
  const M = E.M; if (!M || i < 0 || i >= M.S.length) return;
  if (E.cur !== i) E.saisie = {};
  E.cur = i;
  ouvrir(detail(M, M.S[i], ctxDetail()));
  E.ecran = 'detail';
}
const ctxDetail = () => ({ saisie: E.saisie, envoyes: E.actions, debriefs: E.debriefs });
const seanceCourante = () => (E.M && E.cur >= 0 ? E.M.S[E.cur] : null);

// ---------- déplacer / intervertir ----------
function alertes(M) {
  const out = [], by = {};
  M.S.forEach(s => (by[s.d] = by[s.d] || []).push(s));
  const q = s => s.sp === 'r' && (QUAL.has(s.ty) || (/^long/.test(s.ty) && s.key >= 3)), cle = s => s.sp === 'r' && (QUAL.has(s.ty) || /^long/.test(s.ty));
  Object.keys(by).sort().forEach(d => {
    if (d < M.T) return;
    const n = by[addD(d, 1)] || [];
    if (by[d].some(q) && n.some(q)) out.push(`Deux séances de qualité de suite : ${jl(d)} et ${jl(addD(d, 1))}`);
    if (by[d].some(s => s.sp === 'm' && muKind(s.t, s.ty)[0] === 'leg') && n.some(cle)) out.push(`Muscu leg la veille d'une séance clé (${jl(addD(d, 1))})`);
  });
  return out;
}
function opDeplacer(s, d) {
  const autres = E.M.S.filter(x => x.d === d && x.id !== s.id);
  return { type: 'move_session', payload: { session_id: s.id, from_date: s.d, to_date: d, position: autres.length + 1 } };
}
const opIntervertir = (a, b) => ({ type: 'swap_sessions', payload: { a_id: a.id, b_id: b.id } });

function apercu(op) {
  const M0 = E.M;
  const pend = E.actions.filter(a => a.type === 'move_session' || a.type === 'swap_sessions').concat([{ id: 'apercu', ...op }]);
  const M1 = construire(E.snap, pend, DEMO && E.snap.today ? { T: E.snap.today.date } : {});
  const sem = new Set();
  const ids = op.type === 'move_session' ? [op.payload.session_id] : [op.payload.a_id, op.payload.b_id];
  ids.forEach(id => { const a = M0.S.find(x => x.id === id), b = M1.S.find(x => x.id === id); if (a) sem.add(a.w); if (b) sem.add(b.w); });
  const a0 = alertes(M0), nouv = alertes(M1).filter(x => !a0.includes(x));
  E.pend = op;
  const lib = libAction({ ...op });
  ouvrir(`<h3 id="fen-titre">Aperçu</h3><div class="m">${esc(lib)}</div><div class="ap"><table>` +
    [...sem].sort((x, y) => x - y).map(n => `<tr><td><b>S${M0.W[n].n}</b></td><td>${fk(M0.W[n].km)} → <b>${fk(M1.W[n].km)}</b> km</td><td>${M0.W[n].nr} → ${M1.W[n].nr} sorties</td></tr>`).join('') + '</table>' +
    (nouv.length ? nouv.map(x => `<div class="al2">⚠ ${esc(x)}</div>`).join('') : '<div class="ok2">Aucune nouvelle alerte</div>') +
    '</div><div class="m">Appliqué tout de suite ici, en attente du PC jusqu’au prochain instantané.</div>' +
    '<div class="act"><button class="bt2 pri" data-act="valider">Valider</button><button class="bt2" data-act="annuler">Annuler</button></div>');
}

function dlgDeplacer(s, n) {
  const M = E.M; n = Math.max(0, Math.min(M.W.length - 1, n)); const w = M.W[n];
  ouvrir(`<h3 id="fen-titre">Déplacer · ${esc(s.t)}</h3><div class="m">Actuellement ${jl(s.d)}</div>` +
    `<div class="titre-vue" style="margin-top:10px"><span class="fl2"><button data-act="dep-w" data-n="${n - 1}" aria-label="Semaine précédente"${n <= 0 ? ' disabled' : ''}>‹</button><button data-act="dep-w" data-n="${n + 1}" aria-label="Semaine suivante"${n >= M.W.length - 1 ? ' disabled' : ''}>›</button></span><div><b>Semaine ${w.n}</b></div></div><div class="lst">` +
    [0, 1, 2, 3, 4, 5, 6].map(j => {
      const d = addD(w.ws, j), o = M.S.filter(x => x.d === d && x.id !== s.id);
      const off = d < M.T || (d === s.d && !o.length);
      return `<button class="bt2" data-act="dep-ok" data-d="${d}"${off ? ' disabled' : ''}>${jl(d)} <small>· ${o.length ? o.map(x => esc(x.sp === 'r' ? x.t : x.lab)).join(', ') : 'libre'}</small></button>`;
    }).join('') + '</div><div class="act"><button class="bt2" data-act="retour">Retour</button></div>');
}
function dlgIntervertir(s, n) {
  const M = E.M; n = Math.max(0, Math.min(M.W.length - 1, n)); const w = M.W[n];
  const o = M.S.filter(x => x.w === n && x.id !== s.id && !x.done && x.d >= M.T);
  ouvrir(`<h3 id="fen-titre">Intervertir · ${esc(s.t)}</h3>` +
    `<div class="titre-vue" style="margin-top:10px"><span class="fl2"><button data-act="int-w" data-n="${n - 1}" aria-label="Semaine précédente"${n <= 0 ? ' disabled' : ''}>‹</button><button data-act="int-w" data-n="${n + 1}" aria-label="Semaine suivante"${n >= M.W.length - 1 ? ' disabled' : ''}>›</button></span><div><b>Semaine ${w.n}</b></div></div><div class="lst">` +
    (o.length ? o.map(x => `<button class="bt2" data-act="int-ok" data-b="${x.id}">${jl(x.d)} · ${esc(x.t)}</button>`).join('') : '<p class="m">Aucune séance à venir cette semaine.</p>') +
    '</div><div class="act"><button class="bt2" data-act="retour">Retour</button></div>');
}

// ---------- ressenti ----------
async function envoyerRessenti(s) {
  const r = s ? E.saisie : E.saisieJour, date = s ? s.d : E.M.T, sid = s ? s.id : null;
  const com = (r.com || '').trim() || null;
  if (r.rpe || r.legs || r.breath || (com && r.douleur !== 'oui')) {
    await ajouterAction('feeling', { date, rpe: r.rpe ? +r.rpe : null, legs: r.legs ? +r.legs : null, breath: r.breath ? +r.breath : null, comment: com, session_id: sid });
  }
  if (r.douleur === 'oui') await ajouterAction('pain', { date, zone: r.zone || 'autre', intensity: +(r.int || 0), comment: com, session_id: sid });
  if (s) { E.saisie = {}; montrer(E.cur); } else { E.saisieJour = null; fermer(); }
}
function dlgJour() {
  E.saisieJour = E.saisieJour || {};
  ouvrir(`<h3 id="fen-titre">Ressenti du jour</h3><div class="m">${jl(E.M.T)}</div>` + formRessenti(E.saisieJour));
}

// ---------- réglages / premier lancement ----------
function ecranReglages() {
  const c0 = E.cfg || (DEMO ? { owner: 'demo', repo: 'coach-donnees', token: 'demo', phrase: 'demo' } : {});
  return `<div class="accueil"><h1>${E.cfg ? 'Réglages' : 'Premier lancement'}</h1>` +
    '<p class="m">Le jeton et la phrase secrète restent sur ce téléphone. La phrase n’est jamais envoyée.</p>' +
    '<form class="fm" id="f-cfg" autocomplete="off">' +
    `<label for="f-owner">Propriétaire GitHub</label><input type="text" id="f-owner" value="${esc(c0.owner || '')}" autocapitalize="off" spellcheck="false">` +
    `<label for="f-repo">Dépôt de données (privé)</label><input type="text" id="f-repo" value="${esc(c0.repo || 'coach-donnees')}" autocapitalize="off" spellcheck="false">` +
    `<label for="f-token">Jeton GitHub (fine-grained, Contents lecture et écriture sur ce dépôt seul)</label><input type="password" id="f-token" value="${esc(c0.token || '')}" autocapitalize="off" spellcheck="false">` +
    `<label for="f-phrase">Phrase secrète</label><input type="password" id="f-phrase" value="${esc(c0.phrase || '')}" autocapitalize="off" spellcheck="false">` +
    '<div class="act"><button class="bt2 pri" type="button" data-act="cfg-test">Tester et enregistrer</button>' + (E.cfg ? '<button class="bt2" type="button" data-act="cfg-retour">Retour</button>' : '') + '</div>' +
    '<div class="res" id="cfg-res" role="status"></div></form>' +
    '<div class="danger"><button class="bt2 rouge" type="button" data-act="effacer">Tout effacer de ce téléphone</button></div></div>';
}

async function testerEtEnregistrer() {
  const v = id => $(id).value.trim();
  const cfg = { owner: v('f-owner'), repo: v('f-repo') || 'coach-donnees', token: v('f-token'), phrase: $('f-phrase').value };
  const res = $('cfg-res'), dire = (t, ok) => { res.textContent = t; res.className = 'res ' + (ok ? 'ok3' : 'ko'); };
  if (!cfg.owner || !cfg.token || !cfg.phrase) return dire('Remplir les quatre champs.');
  if (!/^[A-Za-z0-9-]+$/.test(cfg.owner) || !/^[A-Za-z0-9._-]+$/.test(cfg.repo)) return dire('Propriétaire ou dépôt invalide.');
  dire('Test en cours…', true);
  const gh = client(cfg);
  let snap = null, etag = null;
  try {
    await gh.verifierDepot();
    try {
      const r = await gh.lireInstantane(null);
      snap = await C.dechiffrerJSON(JSON.parse(r.texte), cfg.phrase);
      etag = r.etag;
    } catch (e) {
      if (e.code !== 404) throw e;
    }
  } catch (e) {
    return dire(e instanceof C.ErreurDechiffrement ? 'Connexion réussie, mais déchiffrement impossible : phrase secrète incorrecte.' : e.message);
  }
  const change = !E.cfg || E.cfg.phrase !== cfg.phrase || E.cfg.owner !== cfg.owner || E.cfg.repo !== cfg.repo;
  E.cfg = cfg; E.gh = gh;
  await store.ecrire('cfg', cfg);
  if (snap || change) { E.snap = snap; E.etag = etag; await store.ecrire('snap', snap); await store.ecrire('etag', etag); }
  if (E.snap) traiterAcks();
  E.reglages = false;
  message(snap ? 'Connexion et déchiffrement réussis' : 'Connexion réussie · aucun instantané publié pour l’instant', !snap);
  modele(); rendre();
}

let confirmEffacer = false;
async function effacer(btn) {
  if (!confirmEffacer) { confirmEffacer = true; btn.textContent = 'Confirmer : tout effacer'; setTimeout(() => { confirmEffacer = false; if (btn.isConnected) btn.textContent = 'Tout effacer de ce téléphone'; }, 5000); return; }
  confirmEffacer = false;
  await store.toutEffacer();
  C.oublierCles();
  try { localStorage.clear(); } catch (e) { /* rien */ }
  Object.assign(E, { cfg: null, gh: null, snap: null, etag: null, M: null, actions: [], conflits: [], debriefs: [], reglages: false, msg: 'Tout est effacé de ce téléphone', msgErr: false });
  rendre();
}

// ---------- clics ----------
let stopClic = false;
async function agir(t) {
  const a = t.dataset.act, s = seanceCourante();
  switch (a) {
    case 'prec': return montrer(E.cur - 1);
    case 'suiv': return montrer(E.cur + 1);
    case 'retour': return s ? montrer(E.cur) : fermer();
    case 'dep': return s && dlgDeplacer(s, s.w);
    case 'dep-w': return s && dlgDeplacer(s, +t.dataset.n);
    case 'dep-ok': return s && apercu(opDeplacer(s, t.dataset.d));
    case 'int': return s && dlgIntervertir(s, s.w);
    case 'int-w': return s && dlgIntervertir(s, +t.dataset.n);
    case 'int-ok': { const b = E.M.S.find(x => x.id === +t.dataset.b); return s && b && apercu(opIntervertir(s, b)); }
    case 'valider': { const op = E.pend; E.pend = null; if (!op) return; const id = s ? s.id : null; fermer(); await ajouterAction(op.type, op.payload); if (id != null) { /* la fenêtre est fermée : la vue montre la séance « en attente » */ } return; }
    case 'annuler': E.pend = null; return s ? montrer(E.cur) : fermer();
    case 'debrief': if (s) { await ajouterAction('debrief_todo', { session_id: s.id }); montrer(E.cur); } return;
    case 'res': {
      const r = s ? E.saisie : E.saisieJour; if (!r) return;
      r[t.dataset.f] = String(r[t.dataset.f]) === t.dataset.val ? undefined : t.dataset.val;
      return s ? montrer(E.cur) : dlgJour();
    }
    case 'res-ok': return envoyerRessenti(s);
    case 'ressenti-jour': return dlgJour();
    case 'cfl-x': E.conflits = E.conflits.filter(x => x.id !== t.dataset.id); await sauverConflits(); return rendre();
    case 'cfg-test': return testerEtEnregistrer();
    case 'cfg-retour': E.reglages = false; return rendre();
    case 'effacer': return effacer(t);
  }
}

document.addEventListener('click', e => {
  if (stopClic) { e.preventDefault(); e.stopPropagation(); stopClic = false; return; }
  const t = e.target.closest('[data-act],[data-v],[data-i],[data-w],[data-nav]');
  if (!t || t.disabled) return;
  if (t.dataset.act) { e.preventDefault(); agir(t); return; }
  if (t.dataset.v) { E.vue = t.dataset.v; rendre(true); scrollTo({ top: 0 }); return; }
  if (t.dataset.i !== undefined) return montrer(+t.dataset.i);
  if (t.dataset.w !== undefined) { E.selW = +t.dataset.w; return rendre(true); }
  if (t.dataset.nav) { const n = E.selW != null ? E.selW : semaineCourante(E.M); E.selW = Math.max(0, Math.min(E.M.W.length - 1, n + +t.dataset.nav)); return rendre(true); }
});
$('sync').addEventListener('click', () => synchroniser());
document.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'f-cfg') testerEtEnregistrer(); });
$('reglages').addEventListener('click', () => { fermer(); E.reglages = !E.reglages || !E.cfg; rendre(); scrollTo({ top: 0 }); });
document.addEventListener('input', e => {
  const t = e.target.closest('[data-in]'); if (!t) return;
  const r = seanceCourante() ? E.saisie : E.saisieJour; if (!r) return;
  r[t.dataset.in] = t.value;
  if (t.dataset.in === 'int') { const b = $('int-v'); if (b) b.textContent = t.value; }
  const ok = c.querySelector('[data-act="res-ok"]');
  if (ok) ok.disabled = !(r.rpe || r.legs || r.breath || r.douleur === 'oui' || (r.com || '').trim());
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ouverte && !drag) { fermer(); return; }
  if (ouverte && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
    if (e.key === 'ArrowLeft' && E.cur >= 0) montrer(E.cur - 1);
    if (e.key === 'ArrowRight' && E.cur >= 0) montrer(E.cur + 1);
  }
});

// ---------- glisser-déposer : souris au-delà de 6 px, tactile après un appui de 300 ms ----------
let drag = null;
const carte = t => t && t.closest ? t.closest('#vue [data-i]') : null;
function cibleSous(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return null;
  const k = el.closest('#vue [data-i]'); if (k && k !== drag.el) return k; if (k) return null;
  return el.closest('#vue [data-day]');
}
function opPour(t) {
  const M = E.M, s = M.S.find(x => x.id === drag.id); if (!s || !t) return null;
  if (t.dataset.i !== undefined) { const b = M.S[+t.dataset.i]; if (!b || b.id === s.id || b.done || b.d < M.T) return null; return opIntervertir(s, b); }
  const d = t.dataset.day; if (d && d >= M.T) return opDeplacer(s, d);
  return null;
}
function bulle(op) {
  const M = E.M, s = M.S.find(x => x.id === drag.id);
  if (op.type === 'swap_sessions') { const b = M.S.find(x => x.id === op.payload.b_id); return 'Intervertir avec ' + (b.sp === 'r' ? b.t : b.lab); }
  const d = op.payload.to_date;
  return (d === s.d ? 'Placer en dernier le ' : 'Déplacer au ') + jlong(d);
}
function nettoyer() {
  if (drag.ph) { drag.ph.remove(); drag.ph = null; }
  if (drag.ov) { drag.ov.remove(); drag.ov = null; }
  if (drag.t) drag.t.classList.remove('cible');
  drag.t = null; drag.op = null;
}
function viser(t) {
  if (t === drag.t) return; nettoyer(); drag.t = t;
  if (!t) { drag.b.textContent = ''; return; }
  const op = opPour(t); if (!op) { drag.b.textContent = ''; drag.t = null; return; }
  drag.op = op; t.classList.add('cible');
  if (op.type === 'swap_sessions') {
    const o = t.cloneNode(true), r = drag.r; o.classList.remove('cible'); o.classList.add('apercu');
    Object.assign(o.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); document.body.appendChild(o); drag.ov = o;
  } else {
    const ph = document.createElement('div'); ph.className = 'fcase'; ph.style.height = Math.min(drag.r.height, 60) + 'px';
    const box = t.querySelector(':scope > div:last-child') || t; box.appendChild(ph); drag.ph = ph;
  }
  drag.b.textContent = bulle(op);
}
function deplacerA(x, y) {
  const d = drag; d.g.style.left = (x - d.dx) + 'px'; d.g.style.top = (y - d.dy) + 'px';
  const bx = Math.min(x + 14, innerWidth - 20); d.b.style.left = Math.max(8, Math.min(bx, innerWidth - d.b.offsetWidth - 8)) + 'px'; d.b.style.top = (y + 22) + 'px';
  viser(cibleSous(x, y));
  if (y < 70) scrollBy(0, -8); else if (y > innerHeight - 40) scrollBy(0, 8);
}
function commencer() {
  const d = drag, r = d.el.getBoundingClientRect(); d.on = true; d.r = r; d.dx = d.x - r.left; d.dy = d.y - r.top;
  d.g = d.el.cloneNode(true); d.g.classList.add('fant2'); Object.assign(d.g.style, { width: r.width + 'px', height: r.height + 'px' }); document.body.appendChild(d.g);
  d.b = document.createElement('div'); d.b.className = 'bulle'; document.body.appendChild(d.b);
  d.el.classList.add('orig'); document.body.classList.add('glisse');
  if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* rien */ }
}
function finir() {
  if (!drag) return; clearTimeout(drag.tm);
  if (drag.on) { nettoyer(); drag.g.remove(); drag.b.remove(); drag.el.classList.remove('orig'); document.body.classList.remove('glisse'); }
  drag = null;
}
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || drag || ouverte) return;
  const el = carte(e.target); if (!el || !E.M) return;
  const s = E.M.S[+el.dataset.i]; if (!s || s.done || s.d < E.M.T) return;
  drag = { id: s.id, el, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse' };
  if (drag.touch) drag.tm = setTimeout(() => { if (drag && !drag.on) { commencer(); deplacerA(drag.x, drag.y); } }, 300);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.on) {
    const m = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    if (drag.touch) { if (m > 8) finir(); return; }
    if (m < 6) return; commencer();
  }
  deplacerA(e.clientX, e.clientY);
});
document.addEventListener('pointerup', () => {
  if (!drag) return; const on = drag.on, op = drag.op; finir();
  if (!on) return; stopClic = true; setTimeout(() => { stopClic = false; }, 80);
  if (op) { E.cur = -1; apercu(op); }
});
document.addEventListener('pointercancel', () => finir());
document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if (drag && drag.on && e.key === 'Escape') { e.stopPropagation(); finir(); } }, true);
document.addEventListener('contextmenu', e => { if (drag) e.preventDefault(); });

// ---------- démarrage ----------
async function demarrer() {
  try { const v = localStorage.getItem('coach-vue'); if (VUES.some(x => x[0] === v)) E.vue = v; } catch (e) { /* rien */ }
  if (Q.get('vue') && VUES.some(x => x[0] === Q.get('vue'))) E.vue = Q.get('vue');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (DEMO) {
    document.title = 'Coach · démo';
    if (Q.get('reglages') !== '1') await store.ecrire('cfg', { owner: 'demo', repo: 'coach-donnees', token: 'demo', phrase: 'demo' });
  }
  E.cfg = await store.lire('cfg') || null;
  E.actions = await store.lire('actions') || [];
  E.conflits = await store.lire('conflits') || [];
  E.debriefs = await store.lire('debriefs') || [];
  E.snap = await store.lire('snap') || null;
  E.etag = await store.lire('etag') || null;
  if (E.cfg) E.gh = client(E.cfg);
  if (E.snap) traiterAcks();
  modele(); rendre();
  if (E.cfg) synchroniser();
  addEventListener('online', () => synchroniser());
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !E.cfg) return;
    const d = await store.lire('derniere');
    if (!d || Date.now() - new Date(d) > 5 * 60e3 || E.actions.some(a => a.etat === 'a_envoyer')) synchroniser();
  });
  let l = innerWidth < 760;
  addEventListener('resize', () => { const n = innerWidth < 760; if (n !== l) { l = n; rendre(); } });
}
// Accès de test (démo seulement) : simuler la perte de réseau.
if (DEMO) globalThis.coachDemo = { horsLigne(v) { E.horsLigneForce = !!v; }, etat: () => E, action: (t, p) => ajouterAction(t, p) };
demarrer();
