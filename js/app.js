// Application : état, synchronisation avec le dépôt de données, fenêtres, actions, glisser-déposer.
import * as C from './crypto.js';
import * as ST from './store.js';
import * as GH from './github.js';
import { construire, semaineCourante, esc, fk, jl, jlong, addD, opDeplacement, opInterversion, opInverse, nouvellesAlertes, muKind, remplacerOuAjouter } from './plan.js';
import * as MU from './muscu.js';
import { agirAnalyse, lire as lireCourbe } from './analyse.js';
import { vPlanning, vAujourdhui, detail, detailHors, nomSeance, formRessenti, ressentiSeance, carteRessenti, niv3, statutEnvoi, dlgEdition, dlgLien, TYPES_MUSCU } from './vues.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.get('demo') === '1';
const $ = id => document.getElementById(id);
const store = DEMO ? ST.demo : ST.persistant;

const E = {
  cfg: null, gh: null, snap: null, etag: null, M: null,
  actions: [],      // actions locales non accusées : {id, created_at, type, payload, etat: 'a_envoyer' | 'envoyee'}
  conflits: [],     // {id, message, lib}
  debriefs: [],     // séances dont le débrief a été accepté par le PC
  ressentis: {},    // ressentis accusés par le PC : {'s<id>' | 'j<date>': {rpe, legs, breath, comment}}
  edition: false, editionJour: false,
  vue: 'jour', onglet: null, cur: -1, saisie: {}, saisieJour: null,
  occupe: false, msg: '', msgErr: false, horsLigneForce: false, reglages: false,
  // saisie muscu (D68) : brouillons gardés sur le téléphone jusqu'à l'accusé du PC, exercices ajoutés à la main
  mu: { brouillons: [], perso: {}, cur: null, choix: false, libre: false, confirmer: false },
  confirmSuppr: false,
  retours: [],      // retours sur l'appli envoyés depuis ce téléphone (D75) : {id, date, screen, text}
  retourSaisie: { text: '', screen: '' },
  partage: null,    // dernier moment où tout était parti du téléphone (indicateur de l'en-tête, D75)
  supprimes: {},    // brouillons muscu supprimés pendant le bandeau « Annuler » : {action_id: brouillon}
};

// ---------- persistance ----------
const sauverActions = () => store.ecrire('actions', E.actions);
const sauverConflits = () => store.ecrire('conflits', E.conflits);
const sauverMuscu = () => store.ecrire('muscu', { brouillons: E.mu.brouillons, perso: E.mu.perso });

function client(cfg) {
  if (DEMO) return GH.demo({ chiffrerJSON: C.chiffrerJSON, dechiffrerJSON: C.dechiffrerJSON, phrase: cfg.phrase, horsLigne: () => E.horsLigneForce || !navigator.onLine });
  return GH.reel(cfg);
}

function modele() {
  if (!E.snap) { E.M = null; return; }
  const pend = E.actions.filter(a => ['move_session', 'swap_sessions', 'strength_session', 'delete_session', 'edit_session', 'delete_strength_session'].includes(a.type));
  E.M = construire(E.snap, pend, DEMO && E.snap.today ? { T: E.snap.today.date } : {});
}

// ---------- libellés ----------
function libAction(a) {
  const S = E.M ? E.M.S : [], t = id => { const s = S.find(x => x.id === id); return s ? (s.sp === 'r' ? s.t : s.lab || s.t) : 'séance ' + id; };
  const p = a.payload || {};
  switch (a.type) {
    case 'move_session': return `${t(p.session_id)} → ${jl(p.to_date)}`;
    case 'swap_sessions': return `${t(p.a_id)} ⇄ ${t(p.b_id)}`;
    case 'feeling': return 'Ressenti' + (p.session_id ? ' · ' + t(p.session_id) : ' du jour');
    case 'pain': return 'Douleur ' + (p.zone || '');
    case 'debrief_todo': return 'Débrief · ' + t(p.session_id);
    case 'sync_request': return 'Demande de synchro';
    case 'strength_session': return 'Muscu · ' + (p.title || '') + ' · ' + jl(p.date);
    case 'delete_session': return 'Suppression · ' + t(p.session_id);
    case 'edit_session': return 'Intitulé et type · ' + (p.title || t(p.session_id));
    case 'delete_strength_session': return 'Suppression d’une muscu';
    case 'link_activity': return 'Rattachement d’une activité';
    case 'app_feedback': return 'Retour sur l’appli';
    default: return a.type;
  }
}

// ---------- synchronisation ----------
function message(t, err) { E.msg = t; E.msgErr = !!err; entete(); }

// Dépose une demande de synchro Garmin pour le PC (`coach mobile tick`) : une seule en attente, et au plus une
// toutes les 10 min à l'ouverture ou au retour sur l'appli (le bouton passe outre ce délai).
async function demanderSynchro(manuel) {
  if (!E.cfg) return;
  if (E.actions.some(a => a.type === 'sync_request')) return;
  const der = await store.lire('demande');
  if (!manuel && der && Date.now() - new Date(der) < 10 * 60e3) return;
  await store.ecrire('demande', new Date().toISOString());
  E.actions.push({ id: C.uuid(), created_at: isoLocal(new Date()), type: 'sync_request', payload: {}, etat: 'a_envoyer' });
  await sauverActions();
}

async function synchroniser(manuel) {
  if (E.occupe || !E.cfg) return;
  await demanderSynchro(manuel);
  E.occupe = true; entete();
  try {
    // 1. envoi des actions en file
    for (const a of E.actions.filter(x => x.etat === 'a_envoyer' && !(x.retenu > Date.now()))) {
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
    if (!E.actions.some(x => x.etat === 'a_envoyer')) { E.partage = new Date().toISOString(); await store.ecrire('partage', E.partage); }
    const reste = r.quota && r.quota.reste;
    message(reste != null && reste < 500 ? `Quota GitHub restant ${reste}` : '');
  } catch (e) {
    const horsLigne = e.code === 0;
    message(horsLigne ? 'Hors ligne · envoi au retour du réseau' : (e.message || 'Erreur de synchronisation'), !horsLigne);
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
    if (a.type === 'strength_session') {
      // accusé : le brouillon envoyé (et non retouché depuis) laisse place à la séance du PC ; refus : il reste
      const b = E.mu.brouillons.find(x => x.action_id === a.id);
      if (b && k.result === 'conflict') { b.etat = 'local'; b.erreur = k.message || 'refusée'; }
      else if (b && b.etat === 'envoye') E.mu.brouillons = E.mu.brouillons.filter(x => x !== b);
    }
    if (k.result === 'conflict') E.conflits.push({ id: a.id, message: k.message || 'Conflit', lib: libAction(a) });
    else if (a.type === 'debrief_todo' && !E.debriefs.includes(a.payload.session_id)) E.debriefs.push(a.payload.session_id);
    else if (a.type === 'feeling') {
      const p = a.payload;
      E.ressentis[p.session_id != null ? 's' + p.session_id : 'j' + p.date] = { rpe: p.rpe, legs: p.legs, breath: p.breath, comment: p.comment };
    }
  }
  E.actions = restent;
  sauverActions(); sauverConflits(); sauverMuscu(); store.ecrire('debriefs', E.debriefs); store.ecrire('ressentis', E.ressentis);
}

// Une correction d'une saisie encore en file (même séance, même brouillon) remplace l'action au lieu de s'ajouter.
async function ajouterAction(type, payload) {
  const r = remplacerOuAjouter(E.actions, { id: C.uuid(), created_at: isoLocal(new Date()), type, payload, etat: 'a_envoyer' });
  E.actions = r.actions;
  const a = r.action;
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
const quand = d => {
  const auj = new Date(), hier = new Date(auj); hier.setDate(auj.getDate() - 1);
  const meme = (a, b) => a.toDateString() === b.toDateString();
  return meme(d, auj) ? 'à ' + heure(d) : meme(d, hier) ? 'hier à ' + heure(d) : `le ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')} à ${heure(d)}`;
};
function entete() {
  const g = E.snap && E.snap.generated_at ? new Date(E.snap.generated_at) : null;
  const gs = E.snap && E.snap.sources && E.snap.sources.garmin_synced_at ? new Date(E.snap.sources.garmin_synced_at) : null;
  $('date-donnees').textContent = g && !isNaN(g) ? 'Données du PC ' + quand(g) : (E.cfg ? 'Pas encore de données' : 'Coach');
  const n = E.actions.filter(a => a.type !== 'sync_request').length, dem = E.actions.some(a => a.type === 'sync_request');
  $('attente').hidden = !n;
  $('attente').textContent = n;
  $('attente').title = n + ' action' + (n > 1 ? 's' : '') + ' en attente du PC';
  // D75 : l'état de partage avec le PC est ici, pas sur les boutons (« 1 saisie à partager », « tout est partagé à HH:MM »)
  const ap = E.actions.filter(a => a.type !== 'sync_request' && a.etat === 'a_envoyer').length;
  const pt = E.partage ? new Date(E.partage) : null;
  const part = ap ? `${ap} saisie${ap > 1 ? 's' : ''} à partager` : pt && !isNaN(pt) ? 'tout est partagé ' + quand(pt) : '';
  const info = [dem ? 'synchro demandée au PC' : gs && !isNaN(gs) ? 'Garmin lu ' + quand(gs) : '', part].filter(Boolean).join(' · ');
  $('msg').textContent = E.occupe ? 'Synchronisation…' : [E.msg, info].filter(Boolean).join(' · ');
  $('msg').classList.toggle('err', E.msgErr && !E.occupe);
  $('sync').disabled = E.occupe || !E.cfg;
  $('sync').classList.toggle('tourne', E.occupe);
  $('sync').hidden = !E.cfg;
  $('sel').style.top = $('haut').offsetHeight + 'px';
}

// ---------- vues ----------
// Trois onglets (D70) : Aujourd'hui, Planning (semaine par semaine, tous les jours), Muscu ; réglages en icône.
const VUES = [['jour', 'Aujourd’hui'], ['plan', 'Planning'], ['muscu', 'Muscu']];
const ANCIENNES = { fil: 'plan', agenda: 'plan', focus: 'plan' };

// Planning : la semaine en cours en haut de l'écran, le passé au-dessus (en remontant), la suite en dessous.
function versSemaineCourante() {
  if (!E.M || !E.M.W.length) return;
  const el = $('pw-' + semaineCourante(E.M)); if (!el) return;
  const haut = $('haut').offsetHeight + $('sel').offsetHeight + 4;
  scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - haut) });
}

function rendre(defiler) {
  entete();
  const sel = $('sel'), vue = $('vue');
  if (!E.cfg || E.reglages) {
    // pas de re-rendu pendant une saisie dans les réglages (retour sur l'appli) : le clavier reste ouvert
    if (vue.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    sel.innerHTML = ''; $('conflits').innerHTML = ''; vue.innerHTML = ecranReglages(); return;
  }
  sel.innerHTML = VUES.map(([k, n]) => `<button type="button" data-v="${k}" class="${k === E.vue ? 'on' : ''}">${n}</button>`).join('');
  $('conflits').innerHTML = E.conflits.map(c => `<div class="cfl"><span>⚠ <b>${esc(c.message)}</b> · ${esc(c.lib)}</span><button type="button" data-act="cfl-x" data-id="${c.id}" aria-label="Masquer">×</button></div>`).join('');
  try { localStorage.setItem('coach-vue', E.vue); } catch (e) { /* stockage indisponible */ }
  const M = E.M;
  if (E.vue === 'muscu' && E.snap) {
    // pas de re-rendu pendant une saisie (synchro en arrière-plan) : le clavier et la valeur tapée restent
    const f = document.activeElement;
    if (vue.contains(f) && /INPUT|TEXTAREA|SELECT/.test(f.tagName) && !defiler) return;
    vue.innerHTML = vMuscu();
    return;
  }
  if (!M) { vue.innerHTML = `<p class="m">${E.occupe ? 'Chargement…' : 'Pas encore de données. Touchez « Synchroniser ».'}</p>`; return; }
  if (E.vue === 'plan') {
    if (!M.W.length) { vue.innerHTML = '<p class="m">Aucune séance dans l’instantané.</p>'; return; }
    vue.innerHTML = vPlanning(M, ctxDetail());
    if (defiler || !E.planPlace) { versSemaineCourante(); E.planPlace = true; }
    return;
  }
  vue.innerHTML = vAujourdhui(M, ctxDetail());
}

// ---------- fenêtres ----------
const fond = $('fond'), c = $('c');
let ouverte = false;
// garder : même fenêtre re-rendue (choix dans un formulaire, envoi) -> la position de défilement est conservée.
// Barre collante en haut de la fenêtre : le titre de la fenêtre (h3#fen-titre), « ‹ Retour » quand la fenêtre est un
// sous-écran d'une séance (Déplacer, Intervertir, Aperçu) et la croix, toujours visibles même sur une longue Analyse.
function barre() {
  const h = c.querySelector('#fen-titre'), t = $('fen-t');
  t.replaceChildren(...(h ? [h] : []));
  $('fen-retour').hidden = !(E.cur >= 0 && c.querySelector('[data-act="retour"],[data-act="annuler"]'));
}
function ouvrir(html, garder) {
  E.ecran = 'autre';
  const sc = c.parentNode.scrollTop;
  c.innerHTML = html;
  barre();
  if (garder && ouverte) { c.parentNode.scrollTop = sc; return; }
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
$('fen-retour').addEventListener('click', () => { E.pend = null; if (seanceCourante()) montrer(E.cur); else fermer(); });
let bas = null;
fond.addEventListener('pointerdown', e => { bas = e.target === fond ? [e.clientX, e.clientY] : null; });
fond.addEventListener('pointerup', e => { if (bas && e.target === fond && Math.hypot(e.clientX - bas[0], e.clientY - bas[1]) < 5) fermer(); bas = null; });
addEventListener('popstate', () => { if (ouverte) fermer(true); });

function montrer(i, versRessenti) {
  const M = E.M; if (!M || i < 0 || i >= M.S.length) return;
  const meme = E.cur === i && E.ecran === 'detail';
  if (E.cur !== i) { E.saisie = {}; E.edition = false; E.onglet = null; E.confirmSuppr = false; }
  E.cur = i;
  if (versRessenti) E.onglet = 'real';
  ouvrir(detail(M, M.S[i], ctxDetail()), meme && !versRessenti);
  E.ecran = 'detail';
  // « ressenti ? » : la fiche s'ouvre défilée sur le formulaire
  if (versRessenti) {
    const f = $('ressenti'), fen = c.parentNode;
    if (f) fen.scrollTop += f.getBoundingClientRect().top - fen.getBoundingClientRect().top - $('fen-barre').offsetHeight - 8;
  }
}
const ctxDetail = () => ({ saisie: E.saisie, envoyes: E.actions, debriefs: E.debriefs, ressentis: E.ressentis, edition: E.edition, onglet: E.onglet, confirmSuppr: E.confirmSuppr });
const seanceCourante = () => (E.M && E.cur >= 0 ? E.M.S[E.cur] : null);

// ---------- déplacer / intervertir ----------
function apercu(op) {
  const M0 = E.M;
  const pend = E.actions.filter(a => a.type === 'move_session' || a.type === 'swap_sessions').concat([{ id: 'apercu', ...op }]);
  const M1 = construire(E.snap, pend, DEMO && E.snap.today ? { T: E.snap.today.date } : {});
  const sem = new Set();
  const ids = op.type === 'move_session' ? [op.payload.session_id] : [op.payload.a_id, op.payload.b_id];
  ids.forEach(id => { const a = M0.S.find(x => x.id === id), b = M1.S.find(x => x.id === id); if (a) sem.add(a.w); if (b) sem.add(b.w); });
  const nouv = nouvellesAlertes(M0, M1);
  E.pend = op;
  const lib = libAction({ ...op });
  ouvrir(`<h3 id="fen-titre">Aperçu</h3><div class="m">${esc(lib)}</div><div class="ap"><table>` +
    [...sem].sort((x, y) => x - y).map(n => `<tr><td><b>S${M0.W[n].n}</b></td><td>${fk(M0.W[n].km)} → <b>${fk(M1.W[n].km)}</b> km</td><td>${M0.W[n].nr} → ${M1.W[n].nr} sorties</td></tr>`).join('') + '</table>' +
    (nouv.length ? nouv.map(x => `<div class="al2">⚠ ${esc(x)}</div>`).join('') : '<div class="ok2">Aucune nouvelle alerte</div>') +
    '</div><div class="m">Appliqué tout de suite ici, en attente du PC jusqu’au prochain instantané.</div>' +
    '<div class="act"><button class="bt2 pri" data-act="valider">Valider</button><button class="bt2" data-act="annuler">Annuler</button></div>');
}

// Déplacement sans nouvelle alerte : appliqué tout de suite, bandeau « Déplacé · Annuler » quelques secondes (l'envoi
// au PC attend la fin du bandeau) ; avec une alerte : la fenêtre d'aperçu, qui demande de valider.
const RETENUE = 6000;
function simuler(op) {
  const pend = E.actions.filter(a => a.type === 'move_session' || a.type === 'swap_sessions').concat([{ id: 'apercu', ...op }]);
  return construire(E.snap, pend, DEMO && E.snap.today ? { T: E.snap.today.date } : {});
}
async function deplacerOuApercu(op) {
  if (nouvellesAlertes(E.M, simuler(op)).length) return apercu(op);
  fermer();
  const a = { id: C.uuid(), created_at: isoLocal(new Date()), type: op.type, payload: op.payload, etat: 'a_envoyer', retenu: Date.now() + RETENUE };
  E.actions.push(a);
  await sauverActions();
  modele(); rendre();
  bandeau(op.type === 'swap_sessions' ? 'Interverti' : 'Déplacé', libAction(a), a);
  setTimeout(async () => { if (E.actions.includes(a) && a.retenu) { delete a.retenu; await sauverActions(); synchroniser(); } }, RETENUE);
}
let bandeauTm = null;
function bandeau(titre, lib, a) {
  let b = $('bandeau');
  if (!b) { b = document.createElement('div'); b.id = 'bandeau'; b.className = 'bandeau'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
  b.innerHTML = `<span><b>${esc(titre)}</b> · ${esc(lib)}</span><button type="button" data-act="dep-annuler" data-id="${a.id}">Annuler</button>`;
  b.hidden = false;
  clearTimeout(bandeauTm); bandeauTm = setTimeout(() => { b.hidden = true; }, RETENUE);
}
async function annulerDeplacement(id) {
  const b = $('bandeau'); if (b) b.hidden = true;
  const a = E.actions.find(x => x.id === id);
  if (a && (a.type === 'delete_session' || a.type === 'delete_strength_session')) {
    // suppression retenue pendant le bandeau : rien n'est parti, on la retire (et le brouillon muscu revient)
    if (a.etat === 'a_envoyer') E.actions = E.actions.filter(x => x !== a);
    if (E.supprimes[id]) { E.mu.brouillons.unshift(E.supprimes[id]); delete E.supprimes[id]; await sauverMuscu(); }
    await sauverActions(); modele(); rendre(); return;
  }
  if (a && a.etat === 'a_envoyer') E.actions = E.actions.filter(x => x !== a);
  else if (a) { const inv = opInverse(a); E.actions.push({ id: C.uuid(), created_at: isoLocal(new Date()), type: inv.type, payload: inv.payload, etat: 'a_envoyer' }); }
  await sauverActions(); modele(); rendre();
  if (a && a.etat !== 'a_envoyer') synchroniser();
}

// Action retenue quelques secondes (bandeau « … · Annuler ») avant de partir au PC (D75 : suppressions).
async function retenir(type, payload, titre, lib) {
  const a = { id: C.uuid(), created_at: isoLocal(new Date()), type, payload, etat: 'a_envoyer', retenu: Date.now() + RETENUE };
  E.actions.push(a);
  await sauverActions(); modele(); rendre();
  bandeau(titre, lib, a);
  setTimeout(async () => { if (E.actions.includes(a) && a.retenu) { delete a.retenu; delete E.supprimes[a.id]; await sauverActions(); synchroniser(); } }, RETENUE);
  return a;
}
async function supprimerSeance(s) {
  E.confirmSuppr = false; fermer();
  await retenir('delete_session', { session_id: s.id, from_date: s.d }, 'Supprimée', nomSeance(s));
}
async function supprimerMuscu(b) {
  E.mu.brouillons = E.mu.brouillons.filter(x => x !== b); E.mu.cur = null;
  const envoi = E.actions.find(a => a.id === b.action_id && a.etat === 'a_envoyer' && !a.retenu);
  if (envoi && b.session_id == null) {
    // jamais parti du téléphone : rien à demander au PC
    E.actions = E.actions.filter(a => a !== envoi); await sauverActions(); await sauverMuscu(); modele(); return muRendre(true);
  }
  await sauverMuscu();
  const a = await retenir('delete_strength_session', { session_id: b.session_id, uid: b.uid }, 'Supprimée', 'Muscu · ' + MU.libTyp(E.snap, b.typ));
  E.supprimes[a.id] = b;
  muRendre(true);
}
function ouvrirEdition(s) { E.cur = s.i; ouvrir(dlgEdition(s)); }
async function validerEdition(s) {
  const ty = c.querySelector('[data-ed="ty"]').value, ti = c.querySelector('[data-ed="ti"]').value.trim();
  const p = { session_id: s.id, title: ti || null };
  if (s.sp === 'r') p.type = ty;
  else { p.kind = ty; if (!ti || ti === s.t) p.title = (TYPES_MUSCU.find(x => x[0] === ty) || [])[2] || s.t; }
  const change = p.title !== s.t || (s.sp === 'r' ? ty !== s.ty : ty !== muKind(s.t, s.ty)[0]);
  if (!change) return montrer(s.i);
  await ajouterAction('edit_session', p);
  montrer(E.M.S.findIndex(x => x.id === s.id));
}
const activite = id => ((E.snap && E.snap.activities) || []).find(a => a.id === id);
function ouvrirLien(aid) {
  const a = activite(aid); if (!a) return;
  ouvrir(dlgLien(E.M, a, E.actions.some(x => x.type === 'link_activity' && x.payload.activity_id === aid)));
}
async function envoyerLien(aid, sid, reset) {
  await ajouterAction('link_activity', reset ? { activity_id: aid, session_id: null, reset: true } : { activity_id: aid, session_id: sid });
  ouvrirLien(aid);
}

function dlgDeplacer(s, n) {
  const M = E.M; n = Math.max(0, Math.min(M.W.length - 1, n)); const w = M.W[n];
  ouvrir(`<h3 id="fen-titre">Déplacer · ${esc(nomSeance(s))}</h3><div class="m">Actuellement ${jl(s.d)}</div>` +
    `<div class="titre-vue" style="margin-top:10px"><span class="fl2"><button data-act="dep-w" data-n="${n - 1}" aria-label="Semaine précédente"${n <= 0 ? ' disabled' : ''}>‹</button><button data-act="dep-w" data-n="${n + 1}" aria-label="Semaine suivante"${n >= M.W.length - 1 ? ' disabled' : ''}>›</button></span><div><b>Semaine ${w.n}</b></div></div><div class="lst">` +
    [0, 1, 2, 3, 4, 5, 6].map(j => {
      const d = addD(w.ws, j), o = M.S.filter(x => x.d === d && x.id !== s.id);
      const off = !opDeplacement(M, s, d);
      const libre = !off && !o.length;
      return `<button class="bt2${libre ? ' libre' : ''}" data-act="dep-ok" data-d="${d}"${off ? ' disabled' : ''}>${jl(d)} <small>· ${d === s.d ? 'actuellement' : o.length ? o.map(x => esc(x.sp === 'r' ? x.t : x.lab)).join(', ') : '<b>libre</b>'}</small></button>`;
    }).join('') + '</div><div class="act"><button class="bt2" data-act="retour">Retour</button></div>');
}
function dlgIntervertir(s, n) {
  const M = E.M; n = Math.max(0, Math.min(M.W.length - 1, n)); const w = M.W[n];
  const o = M.S.filter(x => x.w === n && opInterversion(M, s, x));
  ouvrir(`<h3 id="fen-titre">Intervertir · ${esc(nomSeance(s))}</h3>` +
    `<div class="titre-vue" style="margin-top:10px"><span class="fl2"><button data-act="int-w" data-n="${n - 1}" aria-label="Semaine précédente"${n <= 0 ? ' disabled' : ''}>‹</button><button data-act="int-w" data-n="${n + 1}" aria-label="Semaine suivante"${n >= M.W.length - 1 ? ' disabled' : ''}>›</button></span><div><b>Semaine ${w.n}</b></div></div><div class="lst">` +
    (o.length ? o.map(x => `<button class="bt2" data-act="int-ok" data-b="${x.id}">${jl(x.d)} · ${esc(nomSeance(x))}</button>`).join('') : '<p class="m">Aucune séance à venir cette semaine.</p>') +
    '</div><div class="act"><button class="bt2" data-act="retour">Retour</button></div>');
}

// ---------- ressenti ----------
async function envoyerRessenti(s) {
  const r = s ? E.saisie : E.saisieJour, date = s ? s.d : E.M.T, sid = s ? s.id : null;
  const com = (r.com || '').trim() || null;
  if (r.rpe || r.legs || r.breath || (com && r.douleur !== 'oui')) {
    await ajouterAction('feeling', { date, rpe: r.rpe ? +r.rpe : null, legs: r.legs ? +r.legs : null, breath: r.breath ? +r.breath : null, comment: com, session_id: sid });
  }
  if (r.douleur === 'oui') await ajouterAction('pain', { date, zone: r.zone || 'autre', intensity: +(r.int ?? 3), comment: com, session_id: sid });
  if (s) { E.saisie = {}; E.edition = false; montrer(E.cur); } else { E.saisieJour = null; E.editionJour = false; dlgJour(true); }
}
function ressentiJour() {
  const env = E.actions.filter(a => a.type === 'feeling' && a.payload && a.payload.session_id == null && a.payload.date === E.M.T).pop();
  if (env) return { ...env.payload, statut: statutEnvoi(env) };
  const loc = E.ressentis['j' + E.M.T];
  return loc ? { ...loc, statut: 'enregistré' } : null;
}
function dlgJour(garder) {
  E.saisieJour = E.saisieJour || {};
  const r = ressentiJour();
  ouvrir(`<h3 id="fen-titre">Ressenti du jour</h3><div class="m">${jl(E.M.T)}</div>` +
    (r && !E.editionJour ? carteRessenti(r, 'res-edit-jour') : formRessenti(E.saisieJour, !!r)), garder);
}
const versSaisie = r => ({ rpe: r.rpe != null ? String(r.rpe) : undefined, legs: r.legs != null ? String(niv3(r.legs)) : undefined, breath: r.breath != null ? String(niv3(r.breath)) : undefined, com: r.comment || '' });

// ---------- muscu ----------
const brouillon = () => E.mu.brouillons.find(b => b.uid === E.mu.cur) || null;
const aujourdhui = () => (E.M && E.M.T) || isoLocal(new Date()).slice(0, 10);
// Séance muscu prévue aujourd'hui, pas encore faite ni saisie : proposée en tête de l'onglet Muscu.
function muscuDuJour() {
  const s = E.M && E.M.S.find(x => x.d === E.M.T && x.sp === 'm' && x.sport === 'strength' && !x.done && !x.saisie);
  return s ? { label: s.lab, i: s.i } : null;
}
function vMuscu() {
  const b = brouillon();
  return b ? MU.editeur(b, E.snap, { ...E.mu, actions: E.actions }) : MU.accueil(E.snap, E.mu.brouillons, { ...E.mu, actions: E.actions, prevu: muscuDuJour() });
}
// Typologie d'une séance muscu du plan : même titre, sinon même partie du corps (« Muscu pecs et épaules » → Pecs).
function typologiePour(s) {
  const T = (MU.bloc(E.snap) || {}).typologies || [];
  return T.find(x => x.title === s.t) || T.find(x => muKind(x.title, '')[0] === muKind(s.t, s.ty)[0]) || null;
}
function saisirSeance(s) {
  const typ = s && typologiePour(s); if (!typ) return;
  fermer();
  E.vue = 'muscu';
  ouvrirBrouillon(MU.nouveau(C.uuid(), s.d <= aujourdhui() ? s.d : aujourdhui(), typ, E.snap));
}
function retouche(b) { b.touche = true; b.modifie = Date.now(); if (b.etat === 'envoye') b.etat = 'local'; b.erreur = null; }
function muRendre(haut) { E.mu.confirmer = false; rendre(true); if (haut) scrollTo({ top: 0 }); }
function ouvrirBrouillon(b) {
  if (!E.mu.brouillons.includes(b)) E.mu.brouillons.unshift(b);
  E.mu.cur = b.uid; E.mu.choix = false; E.mu.libre = false;
  sauverMuscu(); muRendre(true);
}
async function envoyerMuscu(b) {
  const p = MU.payload(b);
  if (!p.exercises.length) return;
  b.etat = 'envoye'; b.erreur = null; E.mu.cur = null;
  // renvoi d'un brouillon dont l'envoi précédent n'est pas parti : la même action, mise à jour
  const r = remplacerOuAjouter(E.actions, { id: C.uuid(), created_at: isoLocal(new Date()), type: 'strength_session', payload: p, etat: 'a_envoyer' });
  E.actions = r.actions;
  b.action_id = r.action.id;
  await sauverActions(); await sauverMuscu();
  modele(); muRendre(true);
  synchroniser();
}
function ajoutExercice(nom) {
  const b = brouillon(); if (!b || !nom) return;
  MU.ajouterExercice(b, nom, E.snap); retouche(b);
  if (!MU.liste(E.snap, b.typ, E.mu.perso).includes(nom)) (E.mu.perso[b.typ] = E.mu.perso[b.typ] || []).push(nom);
  E.mu.libre = false; sauverMuscu(); muRendre();
}
function majEnvoi(b) { const env = $('vue').querySelector('[data-act="mu-env"]'); if (env) env.disabled = MU.vide(b); }
function agirMuscu(a, t) {
  const b = brouillon(), i = +t.dataset.e, j = +t.dataset.s, B = MU.bloc(E.snap) || {};
  switch (a) {
    case 'mu-nouveau': E.mu.choix = true; return muRendre(true);
    case 'mu-commencer': case 'mu-saisir': return saisirSeance(a === 'mu-saisir' ? seanceCourante() : E.M && E.M.S[+t.dataset.i]);
    case 'mu-typ': {
      const typ = (B.typologies || []).find(x => x.title === t.dataset.t); if (!typ) return;
      return ouvrirBrouillon(MU.nouveau(C.uuid(), aujourdhui(), typ, E.snap));
    }
    case 'mu-ouvrir': { const x = E.mu.brouillons.find(y => y.uid === t.dataset.u); return x && ouvrirBrouillon(x); }
    case 'mu-editer': {
      const s = (B.sessions || []).find(x => x.id === +t.dataset.id); if (!s) return;
      if (ouverte) { fermer(); E.vue = 'muscu'; }  // depuis la fiche d'une séance : « Modifier la saisie »
      return ouvrirBrouillon(MU.depuisSeance(s, C.uuid(), B.typologies));
    }
    case 'mu-fermer':
      // séance du PC ouverte puis refermée sans changement : rien à garder sur le téléphone
      if (b && b.session_id != null && !b.touche && b.etat === 'local') { E.mu.brouillons = E.mu.brouillons.filter(x => x !== b); sauverMuscu(); }
      E.mu.cur = null; E.mu.choix = false; return muRendre(true);
    case 'mu-pm': {
      if (!b) return;
      const x = b.ex[i].sets[j], f = t.dataset.f;
      x[f] = MU.pas(b, i, j, f, +t.dataset.d, E.snap);
      retouche(b); sauverMuscu();
      if (f === 'load_kg') return muRendre(); // libellés « charge suivante / précédente » à jour
      const inp = t.parentNode.querySelector('input'); if (inp) inp.value = x[f];
      return majEnvoi(b);
    }
    case 'mu-ok': {
      if (!b) return;
      const x = b.ex[i].sets[j]; x.ok = !MU.cochee(x);
      retouche(b); sauverMuscu(); return muRendre();
    }
    case 'mu-kind': {
      if (!b) return;
      const typ = (B.typologies || []).find(x => x.title === t.dataset.t);
      if (typ) b.typ = typ.title;
      b.title = t.dataset.t; retouche(b); sauverMuscu(); return muRendre();
    }
    case 'mu-s-add': if (b) { MU.ajouterSerie(b, i); retouche(b); sauverMuscu(); muRendre(); } return;
    case 'mu-s-x': if (b) { b.ex[i].sets.splice(j, 1); retouche(b); sauverMuscu(); muRendre(); } return;
    case 'mu-ex-x': if (b) { b.ex.splice(i, 1); retouche(b); sauverMuscu(); muRendre(); } return;
    case 'mu-libre-ok': { const v = ($('vue').querySelector('[data-mu="libre"]') || {}).value; return ajoutExercice((v || '').trim()); }
    case 'mu-env': return b && envoyerMuscu(b);
    case 'mu-suppr': {
      if (!b) return;
      const lib = MU.enregistree(b) ? 'Supprimer la séance' : 'Supprimer le brouillon';
      if (!E.mu.confirmer) { E.mu.confirmer = true; t.textContent = 'Oui, supprimer'; setTimeout(() => { E.mu.confirmer = false; if (t.isConnected) t.textContent = lib; }, 5000); return; }
      E.mu.confirmer = false;
      if (MU.enregistree(b)) return supprimerMuscu(b);
      E.mu.brouillons = E.mu.brouillons.filter(x => x !== b); E.mu.cur = null; sauverMuscu(); return muRendre(true);
    }
  }
}
function saisieMuscu(t, change) {
  const b = brouillon(); if (!b) return;
  const f = t.dataset.mu, i = +t.dataset.e, j = +t.dataset.s;
  if (f === 'libre') return;
  if (f === 'ajout') {
    if (!change || !t.value) return;
    const v = t.value; t.value = '';
    if (v !== '__libre') return ajoutExercice(v);
    E.mu.libre = true; muRendre();
    const l = $('vue').querySelector('[data-mu="libre"]'); if (l) l.focus();
    return;
  }
  if (f === 'typ') {
    if (!change) return;
    const old = (MU.bloc(E.snap).typologies || []).find(x => x.title === b.typ);
    if (!b.title || (old && b.title === old.title)) b.title = t.value;
    b.typ = t.value; retouche(b); sauverMuscu(); return muRendre();
  }
  if (f === 'reps' || f === 'load_kg') b.ex[i].sets[j][f] = MU.lireNombre(t.value);
  else if (f === 'exnote') b.ex[i].note = t.value;
  else if (f === 'title' || f === 'note' || f === 'date') { if (f === 'date' && !t.value) return; b[f] = t.value; }
  retouche(b); sauverMuscu(); majEnvoi(b);
  if (change && (f === 'reps' || f === 'load_kg')) majIgnores(b);
}
// Avertissement « N exercices sans série seront ignorés » tenu à jour sans re-rendu (le clavier reste ouvert).
function majIgnores(b) {
  const n = MU.sansSerie(b), el = $('vue').querySelector('.mu-ign');
  if (!n || MU.vide(b)) { if (el) el.remove(); return; }
  const t = `${n} exercice${n > 1 ? 's' : ''} sans série ${n > 1 ? 'seront ignorés' : 'sera ignoré'} à l’envoi`;
  majNonCochees(b);
  if (el) el.textContent = t;
  else { const act = $('vue').querySelector('.mu-act'); if (act) act.insertAdjacentHTML('beforebegin', `<div class="m mu-ign" role="status">${t}</div>`); }
}

function majNonCochees(b) {
  const el = $('vue').querySelector('.mu-nc'); if (!el) return;
  const n = MU.nonCochees(b);
  el.textContent = n ? `${n} série${n > 1 ? 's' : ''} non cochée${n > 1 ? 's' : ''} : ${n > 1 ? 'elles ne seront pas comptées' : 'elle ne sera pas comptée'}` : MU.vide(b) ? 'Coche les séries faites pour les enregistrer' : '';
}

// ---------- retours sur l'appli (D75) ----------
const ECRANS = ['Aujourd\'hui', 'Planning', 'Fiche de séance', 'Muscu', 'Réglages', 'Autre'];
function statutRetour(r) {
  const a = E.actions.find(x => x.id === r.id);
  return a ? (a.etat === 'a_envoyer' ? 'à partager' : 'partagé, en attente du PC') : 'enregistré sur le PC';
}
function sectionRetours() {
  const r = E.retourSaisie;
  return '<section class="retours"><h2>Retours sur l’appli</h2><p class="m">Ce qui gêne, ce qui manque, une idée : ajouté sur le PC à la liste des retours.</p>' +
    `<div class="fm"><label for="rt-txt">Ton retour</label><textarea id="rt-txt" rows="3" maxlength="4000" data-rt="text">${esc(r.text)}</textarea>` +
    `<label for="rt-scr">Écran concerné (facultatif)</label><select id="rt-scr" data-rt="screen"><option value="">—</option>${ECRANS.map(x => `<option${x === r.screen ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` +
    `<div class="act col"><button class="bt2 pri large" type="button" data-act="rt-env"${r.text.trim() ? '' : ' disabled'}>Envoyer le retour</button></div></div>` +
    (E.retours.length ? '<ul class="acts">' + E.retours.slice().reverse().map(x => `<li><span>${esc(x.text)}<small> · ${jl(x.date)}${x.screen ? ' · ' + esc(x.screen) : ''}</small></span><span class="n">${statutRetour(x)}</span></li>`).join('') + '</ul>' : '') +
    '</section>';
}
async function envoyerRetour() {
  const r = E.retourSaisie, text = r.text.trim(); if (!text) return;
  const a = await ajouterAction('app_feedback', { text, screen: r.screen || null, date: aujourdhui() });
  E.retours.push({ id: a.id, date: aujourdhui(), screen: r.screen || null, text });
  E.retourSaisie = { text: '', screen: '' };
  await store.ecrire('retours', E.retours);
  rendre();
}

// ---------- réglages / premier lancement ----------
function ecranReglages() {
  const c0 = E.cfg || (DEMO ? { owner: 'demo', repo: 'coach-donnees', token: 'demo', phrase: 'demo' } : { owner: Q.get('owner') || '', repo: Q.get('repo') || '' });
  return `<div class="accueil"><h1>${E.cfg ? 'Réglages' : 'Premier lancement'}</h1>` +
    '<p class="m">Le jeton et la phrase secrète restent sur ce téléphone. La phrase n’est jamais envoyée.</p>' +
    '<form class="fm" id="f-cfg" autocomplete="off">' +
    `<label for="f-owner">Propriétaire GitHub</label><input type="text" id="f-owner" value="${esc(c0.owner || '')}" autocapitalize="off" spellcheck="false">` +
    `<label for="f-repo">Dépôt de données (privé)</label><input type="text" id="f-repo" value="${esc(c0.repo || 'coach-donnees')}" autocapitalize="off" spellcheck="false">` +
    `<label for="f-token">Jeton GitHub (fine-grained, Contents lecture et écriture sur ce dépôt seul)</label><input type="password" id="f-token" value="${esc(c0.token || '')}" autocapitalize="off" spellcheck="false">` +
    `<label for="f-phrase">Phrase secrète</label><input type="password" id="f-phrase" value="${esc(c0.phrase || '')}" autocapitalize="off" spellcheck="false">` +
    '<div class="act"><button class="bt2 pri" type="button" data-act="cfg-test">Tester et enregistrer</button>' + (E.cfg ? '<button class="bt2" type="button" data-act="cfg-retour">Retour</button>' : '') + '</div>' +
    '<div class="res" id="cfg-res" role="status"></div></form>' +
    (E.cfg ? sectionRetours() : '') +
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
  Object.assign(E, { cfg: null, gh: null, snap: null, etag: null, M: null, actions: [], conflits: [], debriefs: [], ressentis: {}, mu: { brouillons: [], perso: {}, cur: null, choix: false, libre: false, confirmer: false }, reglages: false, msg: 'Tout est effacé de ce téléphone', msgErr: false });
  rendre();
}

// ---------- clics ----------
let stopClic = false;
async function agir(t) {
  const a = t.dataset.act, s = seanceCourante();
  if (a.startsWith('mu-')) return agirMuscu(a, t);
  if (a.startsWith('an-')) return agirAnalyse(a, t);
  switch (a) {
    case 'prec': return montrer(E.cur - 1);
    case 'suiv': return montrer(E.cur + 1);
    case 'retour': E.pend = null; return s ? montrer(E.cur) : fermer();
    case 'dep': return s && dlgDeplacer(s, s.w);
    case 'dep-w': return s && dlgDeplacer(s, +t.dataset.n);
    case 'dep-ok': { const op = s && opDeplacement(E.M, s, t.dataset.d); return op && deplacerOuApercu(op); }
    case 'dep-annuler': return annulerDeplacement(t.dataset.id);
    case 'int': return s && dlgIntervertir(s, s.w);
    case 'int-w': return s && dlgIntervertir(s, +t.dataset.n);
    case 'int-ok': { const b = E.M.S.find(x => x.id === +t.dataset.b), op = s && b && opInterversion(E.M, s, b); return op && deplacerOuApercu(op); }
    case 'res-direct': return montrer(+t.dataset.i, true);
    case 'leg-sem': { const tt = t.closest('.ptete'); if (tt) tt.classList.toggle('leg'); return; }
    case 'ong': E.onglet = t.dataset.o; return montrer(E.cur);
    case 'valider': { const op = E.pend; E.pend = null; if (!op) return; const id = s ? s.id : null; fermer(); await ajouterAction(op.type, op.payload); if (id != null) { /* la fenêtre est fermée : la vue montre la séance « en attente » */ } return; }
    case 'annuler': E.pend = null; return s ? montrer(E.cur) : fermer();
    case 'res': {
      const r = s ? E.saisie : E.saisieJour; if (!r) return;
      r[t.dataset.f] = String(r[t.dataset.f]) === t.dataset.val ? undefined : t.dataset.val;
      // mise à jour en place (pas de re-rendu, pas de retour en haut) ; la douleur ajoute des champs : re-rendu gardé
      if (t.dataset.f === 'douleur') { if (r.douleur === 'oui' && r.int == null) r.int = '3'; return s ? montrer(E.cur) : dlgJour(true); }
      t.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(r[t.dataset.f]) === b.dataset.val));
      const ok = c.querySelector('[data-act="res-ok"]');
      if (ok) ok.disabled = !(r.rpe || r.legs || r.breath || r.douleur === 'oui' || (r.com || '').trim());
      return;
    }
    case 'res-ok': return envoyerRessenti(s);
    case 'res-edit': { if (!s) return; const r = ressentiSeance(E.M, s, ctxDetail()); E.saisie = r ? versSaisie(r) : {}; E.edition = true; return montrer(E.cur); }
    case 'res-edit-jour': { const r = ressentiJour(); E.saisieJour = r ? versSaisie(r) : {}; E.editionJour = true; return dlgJour(true); }
    case 'res-annuler': if (s) { E.saisie = {}; E.edition = false; return montrer(E.cur); } E.saisieJour = null; E.editionJour = false; return dlgJour(true);
    case 'ressenti-jour': E.editionJour = false; return dlgJour();
    case 'cfl-x': E.conflits = E.conflits.filter(x => x.id !== t.dataset.id); await sauverConflits(); return rendre();
    case 'cfg-test': return testerEtEnregistrer();
    case 'cfg-retour': return basculerReglages(false);
    case 'effacer': return effacer(t);
    case 'suppr': E.confirmSuppr = true; return s && montrer(E.cur);
    case 'suppr-non': E.confirmSuppr = false; return s && montrer(E.cur);
    case 'suppr-ok': return s && supprimerSeance(s);
    case 'edit': return s && ouvrirEdition(s);
    case 'edit-ok': return s && validerEdition(s);
    case 'lien': return ouvrirLien(+t.dataset.a);
    case 'lien-ok': return envoyerLien(+t.dataset.a, t.dataset.s ? +t.dataset.s : null, false);
    case 'lien-auto': return envoyerLien(+t.dataset.a, null, true);
    case 'rt-env': return envoyerRetour();
  }
}

document.addEventListener('click', e => {
  if (stopClic) { e.preventDefault(); e.stopPropagation(); stopClic = false; return; }
  const t = e.target.closest('[data-act],[data-v],[data-i],[data-h]');
  if (!t || t.disabled) return;
  if (t.dataset.act) { e.preventDefault(); agir(t); return; }
  if (t.dataset.v) { E.vue = t.dataset.v; E.planPlace = false; scrollTo({ top: 0 }); rendre(true); return; }
  if (t.dataset.i !== undefined) return montrer(+t.dataset.i);
  if (t.dataset.h !== undefined) { const x = E.M && E.M.H[+t.dataset.h]; if (x) { E.cur = -1; ouvrir(detailHors(E.M, x)); } return; }
});
// Courbe de l'analyse : lecture au doigt (glisser) ou à la souris.
c.addEventListener('pointermove', e => { const sv = e.target.closest && e.target.closest('#an-cv svg'); if (sv) lireCourbe(sv, e.clientX); });
c.addEventListener('pointerdown', e => { const sv = e.target.closest && e.target.closest('#an-cv svg'); if (sv) lireCourbe(sv, e.clientX); });
$('sync').addEventListener('click', () => synchroniser(true));
document.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'f-cfg') testerEtEnregistrer(); });
// Réglages : au retour, la vue reprend là où on l'avait laissée.
let defilAvantReglages = 0;
function basculerReglages(ouvrirR) {
  if (ouvrirR && !E.reglages) defilAvantReglages = scrollY;
  E.reglages = ouvrirR || !E.cfg;
  rendre();
  scrollTo({ top: E.reglages ? 0 : defilAvantReglages });
}
$('reglages').addEventListener('click', () => { fermer(); basculerReglages(!E.reglages); });
document.addEventListener('input', e => { const t = e.target.closest('[data-mu]'); if (t) saisieMuscu(t, false); });
// retour sur l'appli : saisie gardée sans re-rendu (le clavier reste ouvert)
const majRetour = e => {
  const t = e.target.closest('[data-rt]'); if (!t) return;
  E.retourSaisie[t.dataset.rt] = t.value;
  const b = $('vue').querySelector('[data-act="rt-env"]'); if (b) b.disabled = !E.retourSaisie.text.trim();
};
document.addEventListener('input', majRetour);
document.addEventListener('change', majRetour);
document.addEventListener('change', e => { const t = e.target.closest('[data-mu]'); if (t) saisieMuscu(t, true); });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.mu === 'libre') { e.preventDefault(); ajoutExercice(e.target.value.trim()); }
});
document.addEventListener('input', e => {
  const t = e.target.closest('[data-in]'); if (!t) return;
  const r = seanceCourante() ? E.saisie : E.saisieJour; if (!r) return;
  r[t.dataset.in] = t.value;
  if (t.dataset.in === 'int') { const b = $('int-v'); if (b) b.textContent = t.value; }
  const ok = c.querySelector('[data-act="res-ok"]');
  if (ok) ok.disabled = !(r.rpe || r.legs || r.breath || r.douleur === 'oui' || (r.com || '').trim());
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][tabindex]')) { e.preventDefault(); e.target.click(); return; }
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
  if (t.dataset.i !== undefined) { const b = M.S[+t.dataset.i]; return b ? opInterversion(M, s, b) : null; }
  return t.dataset.day ? opDeplacement(M, s, t.dataset.day) : null;
}
function bulle(op) {
  if (op.type === 'swap_sessions') { const b = E.M.S.find(x => x.id === op.payload.b_id); return 'Intervertir avec ' + (b.sp === 'r' ? b.t : b.lab); }
  return 'Déplacer au ' + jlong(op.payload.to_date);
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
  const haut = $('haut').offsetHeight + $('sel').offsetHeight;
  if (y < haut + 30) scrollBy(0, -10); else if (y > innerHeight - 50) scrollBy(0, 10);
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
  if (op) { E.cur = -1; deplacerOuApercu(op); }
});
document.addEventListener('pointercancel', () => finir());
document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if (drag && drag.on && e.key === 'Escape') { e.stopPropagation(); finir(); } }, true);
document.addEventListener('contextmenu', e => { if (drag) e.preventDefault(); });

// ---------- démarrage ----------
async function demarrer() {
  const vueValide = v => (VUES.some(x => x[0] === v) ? v : ANCIENNES[v] || null);
  try { E.vue = vueValide(localStorage.getItem('coach-vue')) || E.vue; } catch (e) { /* rien */ }
  if (Q.get('vue')) E.vue = vueValide(Q.get('vue')) || E.vue;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (DEMO) {
    document.title = 'Coach · démo';
    if (Q.get('reglages') !== '1') await store.ecrire('cfg', { owner: 'demo', repo: 'coach-donnees', token: 'demo', phrase: 'demo' });
  }
  E.cfg = await store.lire('cfg') || null;
  E.actions = await store.lire('actions') || [];
  E.conflits = await store.lire('conflits') || [];
  E.debriefs = await store.lire('debriefs') || [];
  E.ressentis = await store.lire('ressentis') || {};
  E.retours = await store.lire('retours') || [];
  E.partage = await store.lire('partage') || null;
  const mu = await store.lire('muscu');
  if (mu) { E.mu.brouillons = mu.brouillons || []; E.mu.perso = mu.perso || {}; }
  E.snap = await store.lire('snap') || null;
  E.etag = await store.lire('etag') || null;
  if (E.cfg) E.gh = client(E.cfg);
  if (E.snap) traiterAcks();
  modele(); rendre(true);
  if (E.cfg) synchroniser();
  addEventListener('online', () => synchroniser());
  // Saisies gardées hors ligne : nouvel essai toutes les minutes tant que l'appli est affichée (l'événement
  // « online » n'arrive pas toujours dans une PWA installée).
  setInterval(() => {
    if (document.visibilityState === 'visible' && E.cfg && !E.occupe && E.actions.some(a => a.etat === 'a_envoyer')) synchroniser();
  }, 60e3);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !E.cfg) return;
    const d = await store.lire('derniere');
    if (!d || Date.now() - new Date(d) > 60e3 || E.actions.some(a => a.etat === 'a_envoyer')) synchroniser();
  });
}
// Accès de test (démo seulement) : simuler la perte de réseau.
if (DEMO) globalThis.coachDemo = { horsLigne(v) { E.horsLigneForce = !!v; }, etat: () => E, action: (t, p) => ajouterAction(t, p) };
demarrer();
