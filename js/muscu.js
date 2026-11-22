// Saisie muscu (D68) : brouillons gardés sur le téléphone, envoyés au PC par l'action `strength_session`.
// Fonctions pures (testées par tests/muscu.test.mjs) puis rendu HTML ; les clics sont gérés par app.js.
import { esc, jl, statutEnvoi } from './plan.js';

const nb = v => (v == null || v === '' ? null : +v);
const kg = v => String(Math.round(v * 100) / 100).replace('.', ',');
/** Nombre tapé au clavier (« 102,5 » ou « 102.5 ») ; null si vide ou illisible. */
export function lireNombre(v) {
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s || !/^\d*\.?\d*$/.test(s) || s === '.') return null;
  return +s;
}
/** Charge affichée dans le champ : « 102,5 » ; vide pour le poids du corps (0) ou une case vide. */
export const champKg = v => (v ? kg(v) : '');
/** Statut d'un brouillon envoyé : action encore sur le téléphone (hors ligne) ou partie, en attente du PC. */
export function statutBrouillon(b, actions) {
  if (b.erreur) return 'refusée par le PC : ' + b.erreur;
  if (b.etat !== 'envoye') return 'gardée sur ce téléphone · pas encore envoyée';
  return statutEnvoi((actions || []).find(a => a.id === b.action_id) || { etat: 'envoyee' }, true);
}

/** Charge avant répétitions (D75) : « 60 kg × 10 · 4 séries », « 60 kg × 10, 8, 8 », « 60 kg × 10, 62,5 kg × 8 » ;
 * poids du corps : « 4 × 10 », « 10, 8 ». */
export function resume(sets) {
  const s = (sets || []).map(x => (Array.isArray(x) ? { reps: x[0], load_kg: x[1] } : x)).filter(x => x.reps != null || x.load_kg);
  if (!s.length) return '';
  const r = x => (x.reps == null ? '?' : String(x.reps)), c = x => (x.load_kg ? `${kg(x.load_kg)} kg × ` : '');
  const memeC = s.every(x => (x.load_kg || 0) === (s[0].load_kg || 0)), memeR = s.every(x => x.reps === s[0].reps);
  if (memeC && memeR) return s[0].load_kg ? c(s[0]) + r(s[0]) + (s.length > 1 ? ` · ${s.length} séries` : '') : (s.length > 1 ? `${s.length} × ` : '') + r(s[0]);
  if (memeC) return c(s[0]) + s.map(r).join(', ');
  return s.map(x => c(x) + r(x)).join(', ');
}

// ---------- échelle de charge et type déduit des exercices (D75, mêmes règles que le PC : analytics/strength_kind.py)
const PAS_DEFAUT = 2.5;
/** Charge suivante (+1) ou précédente (−1) sur l'échelle des charges réellement utilisées pour l'exercice (calculée
 * par le PC : `exercises[k].loads` et `step`) ; au-delà de l'échelle, au pas ; repli 2,5 kg ; jamais sous 0. */
export function chargeSuivante(snap, k, cur, dir) {
  const b = bloc(snap), e = b && b.exercises && (b.exercises[k] || b.exercises[cle(k)]);
  const vals = (e && e.loads) || [], step = (e && e.step) || PAS_DEFAUT;
  if (cur == null) return dir > 0 ? (vals[0] ?? step) : 0;
  if (dir > 0) { const up = vals.find(v => v > cur + 1e-9); return up ?? Math.round((cur + step) * 100) / 100; }
  const down = vals.filter(v => v < cur - 1e-9);
  return down.length ? down[down.length - 1] : Math.max(0, Math.round((cur - step) * 100) / 100);
}
const KIND_LAB = { dos: 'Dos', leg: 'Jambes', pecs: 'Pecs', epaules: 'Épaules', bras: 'Bras', abdos: 'Abdos', hyrox: 'Hyrox' };
const KIND_RE = [['hyrox', /hyrox/], ['dos', /\bdos\b/], ['pecs', /pec/], ['epaules', /epaule/], ['bras', /bras|biceps|triceps/], ['leg', /\bleg|jambe|cuisse|fessier|squat/], ['abdos', /abdo|gainage|core/]];
export const typesDuTitre = t => { const s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return KIND_RE.filter(([, re]) => re.test(s)).map(([k]) => k); };
/** Type déduit des exercices d'un brouillon face à son intitulé : null si moins de deux exercices classés ou aucun type
 * à 60 % ; `mismatch` quand l'intitulé ne nomme pas ce type ; `title` = typologie vers laquelle basculer. */
export function typeDesExercices(b, snap) {
  const B = bloc(snap), kinds = (B && B.kinds) || {};
  const classes = [...new Set(b.ex.map(e => e.k))].map(k => kinds[k] || kinds[cle(k)]).filter(Boolean);
  if (classes.length < 2) return null;
  const n = {}; classes.forEach(k => { n[k] = (n[k] || 0) + 1; });
  const [k, c] = Object.entries(n).sort((x, y) => y[1] - x[1])[0];
  if (c / classes.length < 0.6) return null;
  const tk = typesDuTitre((b.title || '').trim() || b.typ);
  const typs = (B && B.typologies) || [];
  const title = (B && B.kind_titles && B.kind_titles[k]) || (typs.find(t => typesDuTitre(t.title).join() === k) || {}).title || null;
  return { kind: k, label: KIND_LAB[k] || k, part: c / classes.length, mismatch: tk.length > 0 && !tk.includes(k), title };
}

/** Clé normalisée approchée (comme coach.analytics.strength.key_of) pour retrouver un exercice saisi librement. */
export const cle = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const bloc = snap => (snap && snap.strength) || null;

export function libelle(snap, k) {
  const b = bloc(snap), e = b && b.exercises && b.exercises[k];
  return e ? e.label : String(k).replace(/_/g, ' ');
}

/** Dernière performance connue d'un exercice, avant la date de la séance en cours. */
export function derniere(snap, k, avant) {
  const b = bloc(snap); if (!b || !b.exercises) return null;
  const e = b.exercises[k] || b.exercises[cle(k)];
  return e && e.last && (!avant || e.last.date < avant) ? e.last : null;
}

/** Exercices proposés pour une typologie : ceux du PC (fréquence décroissante) puis ceux ajoutés sur ce téléphone. */
export function liste(snap, typ, perso) {
  const b = bloc(snap), base = (b && b.lists && b.lists[typ]) || [];
  const ajout = ((perso || {})[typ] || []).filter(n => !base.includes(n) && !base.includes(cle(n)));
  return [...base, ...ajout];
}

/** Libellé affiché d'une typologie (« Jambes ») ; la donnée stockée reste son titre (« Muscu leg »). */
export function libTyp(snap, title) {
  const b = bloc(snap), t = b && (b.typologies || []).find(x => x.title === title);
  return t ? t.label : title || 'Muscu';
}

const copieSets = sets => (sets || []).map(x => (Array.isArray(x) ? { reps: x[0], load_kg: x[1] } : { ...x }));

/** Nouveau brouillon : reprend les exercices et toutes les séries de la dernière séance de ce type ; à défaut, les
 * exercices du type déjà faits (dernière performance connue). */
export function nouveau(uid, date, typ, snap) {
  const b = { uid, session_id: null, date, typ: typ.title, title: typ.title, note: '', ex: [], etat: 'local', modifie: Date.now() };
  const B = bloc(snap); if (!B) return b;
  const der = (B.sessions || []).filter(x => x.title === typ.title && x.date <= date).sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id))[0];
  if (der) {
    const vus = new Set();
    for (const e of der.exercises || []) {
      if (vus.has(e.exercise)) continue; vus.add(e.exercise);
      b.ex.push({ k: e.exercise, note: '', sets: copieSets(e.sets).filter(x => !x.set_type || x.set_type === 'normal').map(x => ({ reps: x.reps ?? null, load_kg: x.load_kg ?? null, ok: false })) });
    }
  } else {
    for (const k of liste(snap, typ.title)) { if (derniere(snap, k, date)) ajouterExercice(b, k, snap); }
  }
  return b;
}

/** Brouillon à partir d'une séance de l'instantané (édition d'une séance déjà sur le PC). */
export function depuisSeance(s, uid, typs) {
  const t = (typs || []).find(x => x.title === s.title);
  return {
    uid: s.uid || uid, session_id: s.id, date: s.date, typ: t ? t.title : (typs && typs[0] ? typs[0].title : s.title),
    title: s.title || '', note: s.note || '', etat: 'local', modifie: Date.now(),
    ex: (s.exercises || []).map(e => ({ k: e.exercise, note: e.note || '', sets: e.sets.map(x => ({ ...x, ok: true })) })),
  };
}

export function ajouterSerie(b, i) {
  const e = b.ex[i], p = e.sets[e.sets.length - 1];
  e.sets.push(p ? { reps: p.reps, load_kg: p.load_kg, ok: false } : { reps: null, load_kg: null, ok: false });
}

/** Valeur après un appui sur − / + : une case vide part de la série précédente (ou de 10 répétitions) ; la charge
 * suit l'échelle des charges réellement utilisées pour l'exercice (chargeSuivante) quand `snap` est donné. */
export function pas(b, i, j, f, d, snap) {
  const sets = b.ex[i].sets, v = nb(sets[j][f]);
  if (v == null) {
    const prec = j > 0 ? nb(sets[j - 1][f]) : null;
    if (prec != null) return prec;
    if (f === 'reps') return 10;
    return snap ? chargeSuivante(snap, b.ex[i].k, null, d) : Math.max(0, d);
  }
  if (f === 'load_kg' && snap) return chargeSuivante(snap, b.ex[i].k, v, d);
  return Math.max(0, Math.round((v + d) * 100) / 100);
}

/** Ajoute un exercice, prérempli comme la dernière fois (toutes les séries, mêmes répétitions et charges). */
export function ajouterExercice(b, k, snap) {
  const d = derniere(snap, k, b.date), sets = d && d.sets && d.sets.length ? copieSets(d.sets) : [{ reps: null, load_kg: null }];
  b.ex.push({ k, note: '', sets: sets.map(x => ({ reps: x.reps ?? null, load_kg: x.load_kg ?? null, ok: false })) });
}

/** Exercices sans aucune série remplie : ignorés à l'envoi (prévenir avant). */
export const sansSerie = b => b.ex.filter(e => !e.sets.some(remplie)).length;

const remplie = x => nb(x.reps) != null || nb(x.load_kg) != null || x.duration_s != null || x.distance_m != null;
/** Série validée en salle : cochée (`ok`), ou d'un ancien brouillon sans coche. Seules les cochées partent au PC. */
export const cochee = x => x.ok !== false;
/** Séries remplies mais non cochées : ignorées à l'enregistrement (prévenir sans bloquer). */
export const nonCochees = b => b.ex.reduce((n, e) => n + e.sets.filter(x => remplie(x) && !cochee(x)).length, 0);

export function payload(b) {
  return {
    uid: b.uid, session_id: b.session_id, date: b.date, title: (b.title || '').trim() || b.typ, note: (b.note || '').trim() || null,
    exercises: b.ex.map(e => ({
      exercise: e.k, note: (e.note || '').trim() || null,
      sets: e.sets.filter(cochee).map(({ ok, ...x }) => ({ ...x, reps: nb(x.reps), load_kg: nb(x.load_kg) })).filter(x => x.reps != null || x.load_kg != null || x.duration_s != null || x.distance_m != null),
    })).filter(e => e.sets.length || e.note),
  };
}

export const vide = b => !payload(b).exercises.some(e => e.sets.length);

// ---------- rendu ----------
const TYPE = { warmup: 'échauff.', rest_pause: 'rest-pause', dropset: 'dégressive', stretch: 'étirement', cardio: 'cardio' };

function serie(x, i, j, snap, k) {
  const pm = (f, d, lib) => `<button type="button" class="mu-pm ${d > 0 ? 'pl' : 'mo'}" data-act="mu-pm" data-e="${i}" data-s="${j}" data-f="${f}" data-d="${d}" aria-label="${lib}">${d > 0 ? '+' : '−'}</button>`;
  // charge : champ texte au clavier décimal (virgule ou point acceptés, « 102,5 » affiché ; vide au poids du corps)
  const champ = (f, v, mode, lib) => (f === 'load_kg'
    ? `<input type="text" inputmode="decimal" autocomplete="off" data-mu="${f}" data-e="${i}" data-s="${j}" value="${esc(champKg(v))}" aria-label="${lib} série ${j + 1}">`
    : `<input type="number" inputmode="${mode}" step="1" min="0" data-mu="${f}" data-e="${i}" data-s="${j}" value="${v == null ? '' : esc(String(v))}" aria-label="${lib} série ${j + 1}">`);
  const extra = [x.set_type && TYPE[x.set_type], x.duration_s ? Math.round(x.duration_s) + ' s' : '', x.distance_m ? Math.round(x.distance_m) + ' m' : ''].filter(Boolean).join(' · ');
  const cur = nb(x.load_kg), moins = chargeSuivante(snap, k, cur, -1), plus = chargeSuivante(snap, k, cur, 1);
  const ok = cochee(x);
  return `<div class="mu-s${ok ? ' fait' : ''}"><button type="button" class="mu-ok${ok ? ' on' : ''}" data-act="mu-ok" data-e="${i}" data-s="${j}" aria-pressed="${ok}" aria-label="Série ${j + 1} ${ok ? 'faite' : 'à valider'}">${ok ? '✓' : j + 1}</button>` +
    `<div class="mu-st">${pm('load_kg', -1, cur != null ? `Charge précédente : ${kg(moins)} kg` : 'Charge de moins')}${champ('load_kg', x.load_kg, 'decimal', 'Charge')}${pm('load_kg', 1, cur != null ? `Charge suivante : ${kg(plus)} kg` : 'Charge de plus')}</div>` +
    `<div class="mu-st">${pm('reps', -1, 'Une répétition de moins')}${champ('reps', x.reps, 'numeric', 'Répétitions')}${pm('reps', 1, 'Une répétition de plus')}</div>` +
    `<button type="button" class="mu-x" data-act="mu-s-x" data-e="${i}" data-s="${j}" aria-label="Retirer la série ${j + 1}">×</button>` +
    (extra ? `<small class="mu-t">${esc(extra)}</small>` : '') + '</div>';
}

export function editeur(b, snap, ctx) {
  const B = bloc(snap) || { typologies: [] };
  const typs = B.typologies || [];
  const deja = new Set(b.ex.map(e => e.k));
  const props = liste(snap, b.typ, ctx.perso).filter(k => !deja.has(k));
  const statut = b.erreur ? 'Refusée par le PC : ' + b.erreur : b.session_id != null || b.etat === 'envoye' ? 'Enregistrée' : 'Brouillon sur ce téléphone';
  const ty = typeDesExercices(b, snap), nc = nonCochees(b);
  return `<div class="mu-ed">` +
    `<div class="titre-vue"><button type="button" class="bt2" data-act="mu-fermer">‹ Séances</button><div class="m mu-etat${b.erreur ? ' err' : ''}">${esc(statut)}</div></div>` +
    `<div class="mu-tete"><select data-mu="typ" aria-label="Type de séance">${typs.map(t => `<option value="${esc(t.title)}"${t.title === b.typ ? ' selected' : ''}>${esc(t.label)}</option>`).join('')}</select>` +
    `<input type="date" data-mu="date" value="${esc(b.date)}" aria-label="Date"></div>` +
    (ty && ty.mismatch ? `<div class="mu-kind" role="note"><span>Exercices plutôt <b>${esc(ty.label)}</b> : le type ne correspond pas.</span>${ty.title ? `<button type="button" class="bt2" data-act="mu-kind" data-t="${esc(ty.title)}">Passer en ${esc(ty.label)}</button>` : ''}</div>` : '') +
    `<input type="text" class="mu-titre" data-mu="title" value="${esc(b.title === b.typ ? '' : b.title)}" placeholder="Titre (facultatif) · ${esc(libTyp(snap, b.typ))}" aria-label="Titre de la séance">` +
    b.ex.map((e, i) => {
      const d = derniere(snap, e.k, b.date);
      return `<section class="mu-ex"><div class="mu-exh"><b>${esc(libelle(snap, e.k))}</b>` +
        `<button type="button" class="mu-x" data-act="mu-ex-x" data-e="${i}" aria-label="Retirer l’exercice">×</button></div>` +
        (d ? `<div class="m">La dernière fois : ${esc(resume(d.sets))} <small>(${jl(d.date)})</small></div>` : '') +
        (e.sets.length ? '<div class="mu-col"><span>kg</span><span>rép.</span></div>' : '') +
        e.sets.map((x, j) => serie(x, i, j, snap, e.k)).join('') +
        `<div class="mu-bas"><button type="button" class="bt2" data-act="mu-s-add" data-e="${i}">+ Série</button>` +
        `<input type="text" data-mu="exnote" data-e="${i}" value="${esc(e.note || '')}" placeholder="Note" aria-label="Note sur l’exercice"></div></section>`;
    }).join('') +
    `<div class="mu-aj"><select data-mu="ajout" aria-label="Ajouter un exercice"><option value="">+ Ajouter un exercice</option>` +
    props.map(k => `<option value="${esc(k)}">${esc(libelle(snap, k))}</option>`).join('') +
    `<option value="__libre">Autre exercice…</option></select>` +
    (ctx.libre ? `<div class="mu-libre"><input type="text" data-mu="libre" placeholder="Nom de l’exercice" aria-label="Nom du nouvel exercice"><button type="button" class="bt2 pri" data-act="mu-libre-ok">Ajouter</button></div>` : '') +
    `</div><textarea data-mu="note" rows="2" placeholder="Note de séance" aria-label="Note de séance">${esc(b.note || '')}</textarea>` +
    (sansSerie(b) && !vide(b) ? `<div class="m mu-ign" role="status">${sansSerie(b)} exercice${sansSerie(b) > 1 ? 's' : ''} sans série ${sansSerie(b) > 1 ? 'seront ignorés' : 'sera ignoré'} à l’envoi</div>` : '') +
    `<div class="m mu-nc" role="status">${nc ? `${nc} série${nc > 1 ? 's' : ''} non cochée${nc > 1 ? 's' : ''} : ${nc > 1 ? 'elles ne seront pas comptées' : 'elle ne sera pas comptée'}` : vide(b) ? 'Coche les séries faites pour les enregistrer' : ''}</div>` +
    `<div class="act mu-act"><button type="button" class="bt2 pri mu-gros" data-act="mu-env"${vide(b) ? ' disabled' : ''}>Enregistrer</button>` +
    `<button type="button" class="bt2 rouge" data-act="mu-suppr">${ctx.confirmer ? 'Oui, supprimer' : enregistree(b) ? 'Supprimer la séance' : 'Supprimer le brouillon'}</button></div></div>`;
}

/** Séance déjà connue du PC (ouverte depuis le PC ou déjà envoyée) : la supprimer passe par le PC. */
export const enregistree = b => b.session_id != null || b.etat === 'envoye' || !!b.action_id;

export function accueil(snap, brouillons, ctx) {
  const B = bloc(snap);
  if (!B) return '<p class="m">Le PC doit être mis à jour pour la saisie muscu (instantané sans bloc muscu).</p>';
  if (ctx.choix) {
    return `<div class="titre-vue"><button type="button" class="bt2" data-act="mu-fermer">‹ Séances</button><h2>Nouvelle séance</h2></div>` +
      `<div class="mu-typs">${B.typologies.map(t => `<button type="button" class="bt2" data-act="mu-typ" data-t="${esc(t.title)}">${esc(t.label)}</button>`).join('')}</div>`;
  }
  const uids = new Set(brouillons.map(b => b.uid)), ids = new Set(brouillons.map(b => b.session_id).filter(x => x != null));
  const supp = new Set((ctx.actions || []).filter(a => a.type === 'delete_strength_session').map(a => a.payload.session_id ?? a.payload.uid));
  const pc = (B.sessions || []).filter(s => !ids.has(s.id) && !(s.uid && uids.has(s.uid)) && !supp.has(s.id) && !(s.uid && supp.has(s.uid))).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  const nex = s => { const n = (s.exercises || s.ex || []).length; return n + ' exercice' + (n > 1 ? 's' : ''); };
  const titre = x => (x.title && x.title !== (x.typ || x.title) ? x.title : libTyp(snap, x.typ || x.title));
  const pv = ctx.prevu;
  return (pv ? `<div class="mu-prevu"><span>Prévu aujourd’hui : <b>${esc(pv.label)}</b></span><button type="button" class="bt2 pri" data-act="mu-commencer" data-i="${pv.i}">Commencer</button></div>` : '') +
    `<div class="act"><button type="button" class="bt2${pv ? '' : ' pri'} mu-gros" data-act="mu-nouveau">+ Nouvelle séance muscu</button></div>` +
    (brouillons.length ? '<h2 class="mu-h">Sur ce téléphone</h2><div class="lst">' + brouillons.map(b =>
      `<button type="button" class="bt2" data-act="mu-ouvrir" data-u="${esc(b.uid)}">${jl(b.date)} · ${esc(titre(b))} <small>· ${nex(b)} · ${b.erreur ? 'refusée' : b.etat === 'envoye' ? 'enregistrée' : 'brouillon'}</small></button>`).join('') + '</div>' : '') +
    '<h2 class="mu-h">Séances récentes</h2>' +
    (pc.length ? '<div class="lst">' + pc.map(s => `<button type="button" class="bt2" data-act="mu-editer" data-id="${s.id}">${jl(s.date)} · ${esc(libTyp(snap, s.title))} <small>· ${nex(s)}${s.kind_check && s.kind_check.mismatch ? ` · <span class="enatt">exercices plutôt ${esc(s.kind_check.label)}</span>` : ''}</small></button>`).join('') + '</div>'
      : '<p class="m">Aucune séance muscu ces trois dernières semaines.</p>');
}
