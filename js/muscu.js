// Saisie muscu (D68) : brouillons gardés sur le téléphone, envoyés au PC par l'action `strength_session`.
// Fonctions pures (testées par tests/muscu.test.mjs) puis rendu HTML ; les clics sont gérés par app.js.
import { esc, jl } from './plan.js';

const nb = v => (v == null || v === '' ? null : +v);
const kg = v => String(Math.round(v * 100) / 100).replace('.', ',');

/** « 4 × 10 à 60 kg », « 10, 8, 8 à 60 kg », « 10 à 60 kg, 8 à 65 kg » ; poids du corps : sans « à ». */
export function resume(sets) {
  const s = (sets || []).map(x => (Array.isArray(x) ? { reps: x[0], load_kg: x[1] } : x)).filter(x => x.reps != null || x.load_kg);
  if (!s.length) return '';
  const r = x => (x.reps == null ? '?' : String(x.reps)), c = x => (x.load_kg ? ` à ${kg(x.load_kg)} kg` : '');
  const memeC = s.every(x => (x.load_kg || 0) === (s[0].load_kg || 0)), memeR = s.every(x => x.reps === s[0].reps);
  if (memeC && memeR) return (s.length > 1 ? `${s.length} × ` : '') + r(s[0]) + c(s[0]);
  if (memeC) return s.map(r).join(', ') + c(s[0]);
  return s.map(x => r(x) + c(x)).join(', ');
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

export function nouveau(uid, date, typ) {
  return { uid, session_id: null, date, typ: typ.title, title: typ.title, note: '', ex: [], etat: 'local', modifie: Date.now() };
}

/** Brouillon à partir d'une séance de l'instantané (édition d'une séance déjà sur le PC). */
export function depuisSeance(s, uid, typs) {
  const t = (typs || []).find(x => x.title === s.title);
  return {
    uid: s.uid || uid, session_id: s.id, date: s.date, typ: t ? t.title : (typs && typs[0] ? typs[0].title : s.title),
    title: s.title || '', note: s.note || '', etat: 'local', modifie: Date.now(),
    ex: (s.exercises || []).map(e => ({ k: e.exercise, note: e.note || '', sets: e.sets.map(x => ({ ...x })) })),
  };
}

export function ajouterSerie(b, i) {
  const e = b.ex[i], p = e.sets[e.sets.length - 1];
  e.sets.push(p ? { reps: p.reps, load_kg: p.load_kg } : { reps: null, load_kg: null });
}

/** Ajoute un exercice, prérempli comme la dernière fois (mêmes répétitions et charge pour la première série). */
export function ajouterExercice(b, k, snap) {
  const d = derniere(snap, k, b.date), p = d && d.sets && d.sets[0];
  b.ex.push({ k, note: '', sets: [{ reps: p ? p[0] : null, load_kg: p ? p[1] : null }] });
}

export function payload(b) {
  return {
    uid: b.uid, session_id: b.session_id, date: b.date, title: (b.title || '').trim() || b.typ, note: (b.note || '').trim() || null,
    exercises: b.ex.map(e => ({
      exercise: e.k, note: (e.note || '').trim() || null,
      sets: e.sets.map(x => ({ ...x, reps: nb(x.reps), load_kg: nb(x.load_kg) })).filter(x => x.reps != null || x.load_kg != null || x.duration_s != null || x.distance_m != null),
    })).filter(e => e.sets.length || e.note),
  };
}

export const vide = b => !payload(b).exercises.some(e => e.sets.length);

// ---------- rendu ----------
const TYPE = { warmup: 'échauff.', rest_pause: 'rest-pause', dropset: 'dégressive', stretch: 'étirement', cardio: 'cardio' };

function serie(x, i, j) {
  const pm = (f, d, lib) => `<button type="button" class="mu-pm" data-act="mu-pm" data-e="${i}" data-s="${j}" data-f="${f}" data-d="${d}" aria-label="${lib}">${d > 0 ? '+' : '−'}</button>`;
  const champ = (f, v, mode, lib) => `<input type="number" inputmode="${mode}" step="any" min="0" data-mu="${f}" data-e="${i}" data-s="${j}" value="${v == null ? '' : esc(String(v))}" aria-label="${lib} série ${j + 1}">`;
  const extra = [x.set_type && TYPE[x.set_type], x.duration_s ? Math.round(x.duration_s) + ' s' : '', x.distance_m ? Math.round(x.distance_m) + ' m' : ''].filter(Boolean).join(' · ');
  return `<div class="mu-s"><span class="mu-n">${j + 1}</span>` +
    `<div class="mu-st">${pm('reps', -1, 'Une répétition de moins')}${champ('reps', x.reps, 'numeric', 'Répétitions')}${pm('reps', 1, 'Une répétition de plus')}</div>` +
    `<div class="mu-st">${pm('load_kg', -2.5, '2,5 kg de moins')}${champ('load_kg', x.load_kg, 'decimal', 'Charge')}${pm('load_kg', 2.5, '2,5 kg de plus')}</div>` +
    `<button type="button" class="mu-x" data-act="mu-s-x" data-e="${i}" data-s="${j}" aria-label="Retirer la série ${j + 1}">×</button>` +
    (extra ? `<small class="mu-t">${esc(extra)}</small>` : '') + '</div>';
}

export function editeur(b, snap, ctx) {
  const B = bloc(snap) || { typologies: [] };
  const typs = B.typologies || [];
  const deja = new Set(b.ex.map(e => e.k));
  const props = liste(snap, b.typ, ctx.perso).filter(k => !deja.has(k));
  const statut = b.etat === 'envoye' ? 'Envoyée, en attente du PC' : b.erreur ? 'Refusée par le PC : ' + b.erreur : 'Gardée sur ce téléphone · pas encore envoyée';
  return `<div class="mu-ed">` +
    `<div class="titre-vue"><button type="button" class="bt2" data-act="mu-fermer">‹ Séances</button><div class="m mu-etat${b.erreur ? ' err' : ''}">${esc(statut)}</div></div>` +
    `<div class="mu-tete"><select data-mu="typ" aria-label="Type de séance">${typs.map(t => `<option value="${esc(t.title)}"${t.title === b.typ ? ' selected' : ''}>${esc(t.label)}</option>`).join('')}</select>` +
    `<input type="date" data-mu="date" value="${esc(b.date)}" aria-label="Date"></div>` +
    `<input type="text" class="mu-titre" data-mu="title" value="${esc(b.title)}" aria-label="Titre de la séance">` +
    b.ex.map((e, i) => {
      const d = derniere(snap, e.k, b.date);
      return `<section class="mu-ex"><div class="mu-exh"><b>${esc(libelle(snap, e.k))}</b>` +
        `<button type="button" class="mu-x" data-act="mu-ex-x" data-e="${i}" aria-label="Retirer l’exercice">×</button></div>` +
        (d ? `<div class="m">La dernière fois : ${esc(resume(d.sets))} <small>(${jl(d.date)})</small></div>` : '') +
        (e.sets.length ? '<div class="mu-col"><span>rép.</span><span>kg</span></div>' : '') +
        e.sets.map((x, j) => serie(x, i, j)).join('') +
        `<div class="mu-bas"><button type="button" class="bt2" data-act="mu-s-add" data-e="${i}">+ Série</button>` +
        `<input type="text" data-mu="exnote" data-e="${i}" value="${esc(e.note || '')}" placeholder="Note" aria-label="Note sur l’exercice"></div></section>`;
    }).join('') +
    `<div class="mu-aj"><select data-mu="ajout" aria-label="Ajouter un exercice"><option value="">+ Ajouter un exercice</option>` +
    props.map(k => `<option value="${esc(k)}">${esc(libelle(snap, k))}</option>`).join('') +
    `<option value="__libre">Autre exercice…</option></select>` +
    (ctx.libre ? `<div class="mu-libre"><input type="text" data-mu="libre" placeholder="Nom de l’exercice" aria-label="Nom du nouvel exercice"><button type="button" class="bt2 pri" data-act="mu-libre-ok">Ajouter</button></div>` : '') +
    `</div><textarea data-mu="note" rows="2" placeholder="Note de séance" aria-label="Note de séance">${esc(b.note || '')}</textarea>` +
    `<div class="act mu-act"><button type="button" class="bt2 pri mu-gros" data-act="mu-env"${vide(b) ? ' disabled' : ''}>${b.etat === 'envoye' ? 'Renvoyer au PC' : 'Envoyer au PC'}</button>` +
    `<button type="button" class="bt2 rouge" data-act="mu-suppr">${ctx.confirmer ? 'Confirmer' : 'Supprimer le brouillon'}</button></div></div>`;
}

export function accueil(snap, brouillons, ctx) {
  const B = bloc(snap);
  if (!B) return '<p class="m">Le PC doit être mis à jour pour la saisie muscu (instantané sans bloc muscu).</p>';
  if (ctx.choix) {
    return `<div class="titre-vue"><button type="button" class="bt2" data-act="mu-fermer">‹ Séances</button><h2>Nouvelle séance</h2></div>` +
      `<div class="mu-typs">${B.typologies.map(t => `<button type="button" class="bt2" data-act="mu-typ" data-t="${esc(t.title)}">${esc(t.label)}</button>`).join('')}</div>`;
  }
  const uids = new Set(brouillons.map(b => b.uid)), ids = new Set(brouillons.map(b => b.session_id).filter(x => x != null));
  const pc = (B.sessions || []).filter(s => !ids.has(s.id) && !(s.uid && uids.has(s.uid))).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  const nex = s => { const n = (s.exercises || s.ex || []).length; return n + ' exercice' + (n > 1 ? 's' : ''); };
  return `<div class="act"><button type="button" class="bt2 pri mu-gros" data-act="mu-nouveau">+ Nouvelle séance muscu</button></div>` +
    (brouillons.length ? '<h2 class="mu-h">Sur ce téléphone</h2><div class="lst">' + brouillons.map(b =>
      `<button type="button" class="bt2" data-act="mu-ouvrir" data-u="${esc(b.uid)}">${jl(b.date)} · ${esc(b.title || b.typ)} <small>· ${nex(b)} · ${b.etat === 'envoye' ? 'envoyée, en attente du PC' : b.erreur ? 'refusée' : 'pas encore envoyée'}</small></button>`).join('') + '</div>' : '') +
    '<h2 class="mu-h">Séances récentes</h2>' +
    (pc.length ? '<div class="lst">' + pc.map(s => `<button type="button" class="bt2" data-act="mu-editer" data-id="${s.id}">${jl(s.date)} · ${esc(s.title || 'Muscu')} <small>· ${nex(s)}</small></button>`).join('') + '</div>'
      : '<p class="m">Aucune séance muscu ces trois dernières semaines.</p>');
}
