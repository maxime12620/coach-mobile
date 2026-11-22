// Rendu HTML des vues, repris de la maquette plan-integre (version téléphone d'abord).
import { ZC, ZN, JC, JL, esc, f1, fh, dd, jlong, addD, jour, ecart, muKind, prevuRealise, evaluation, pc, versus, etat, ecartPrevu, ecartAffiche, chiffresSeance, dureeDansTitre, semainePlanning, lignesSemaine, deplacable, titreCourt, allureCible, profilUtile, memeTypologie, statutEnvoi } from './plan.js';
import { vAnalyse } from './analyse.js';
import * as MUS from './muscu.js';

const MU = 'var(--mu)', GB = 'var(--sil)';
export const ICO = {
  run: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="14.5" cy="4" r="2.2"/><path d="M10 21l2.5-6 2.5 2.5V22M8 11.5l2.5-3.5 4 .5 2 3 3 1M12.5 15l-1.5-6.5M6.5 14.5l2.5-1"/></svg>',
  mus: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10"/><rect x="3.5" y="8" width="3.5" height="8" rx="1"/><rect x="17" y="8" width="3.5" height="8" rx="1"/><path d="M2 10.5v3M22 10.5v3"/></svg>',
  route: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20c0-5 14-4 14-10 0-3-3-5-6-4"/><circle cx="5" cy="20" r="1.6"/><path d="M13 6l3-2-1 3.5"/></svg>',
};

// ---------- icônes de muscu : silhouette avec la zone travaillée ----------
function corps(part) {
  const f = p => p === part ? MU : GB;
  return `<svg class="bi" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="3.1" r="2.1" style="fill:${GB}"/>` +
    `<path d="M8.6 6h6.8l-.5 8.3H9.1z" style="fill:${part === 'dos' ? MU : GB}"/>` + (part === 'dos' ? '<path d="M12 6.5v7.4" style="stroke:var(--fond)" stroke-width=".9"/>' : '') +
    (part === 'pecs' ? `<path d="M8.7 6.3h6.6l-.25 3.6H8.95z" style="fill:${MU}"/>` : '') + (part === 'abdos' ? `<path d="M9.4 10.3h5.2l-.25 3.9H9.65z" style="fill:${MU}"/>` : '') +
    `<circle cx="7.3" cy="7" r="1.7" style="fill:${f('epaules')}"/><circle cx="16.7" cy="7" r="1.7" style="fill:${f('epaules')}"/>` +
    `<path d="M6.1 8.8l-.9 6.3M17.9 8.8l.9 6.3" style="stroke:${f('bras')}" stroke-width="2.1" stroke-linecap="round"/>` +
    `<path d="M10.4 15.2v6.8M13.6 15.2v6.8" style="stroke:${f('leg')}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}
const HYROX = `<svg class="bi" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.3 10.2V8.6a3.7 3.7 0 0 1 7.4 0v1.6" fill="none" style="stroke:${MU}" stroke-width="2"/><path d="M6.2 15.2a5.8 5.8 0 1 0 11.6 0 5.8 5.8 0 0 0-11.6 0z" style="fill:${MU}"/><text x="12" y="17.6" text-anchor="middle" style="font:700 6px 'PT Sans';fill:#fff">H</text></svg>`;
const HALT = `<svg class="bi" viewBox="0 0 24 24" aria-hidden="true" fill="none" style="stroke:${MU}" stroke-width="1.8" stroke-linecap="round"><path d="M7 12h10M2 10.5v3M22 10.5v3"/><rect x="3.5" y="8" width="3.5" height="8" rx="1"/><rect x="17" y="8" width="3.5" height="8" rx="1"/></svg>`;
const AUTRE = `<svg class="bi" viewBox="0 0 24 24" aria-hidden="true" fill="none" style="stroke:${MU}" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>`;
export const muIco = s => { if (s.sp === 'x') return AUTRE; const k = muKind(s.t, s.ty)[0]; return k === 'hyrox' ? HYROX : k ? corps(k) : HALT; };
export const muTag = s => `<span class="mt">${muIco(s)}<span>${esc(s.lab)}</span></span>`;
const actCourt = h => (h.km >= 0.5 ? `${f1(h.km)} km · ` : '') + `${Math.round(h.mn)} min`;
const ATT = s => s.attente ? '<span class="att" title="En attente du PC"></span>' : '';
export { statutEnvoi };
const AV = s => s.av ? '<span class="av" title="Avant la course">1<sup>re</sup></span>' : '';

export function mini(p, tref, h) {
  if (!p || !p.length) return '';
  let x = 0, r = '';
  for (const [s, l] of p) { const hh = 18 * l + 10; r += `<rect x="${Math.round(x)}" y="${100 - hh}" width="${Math.max(s, 1)}" height="${hh}" style="fill:${ZC[l]}"/>`; x += s; }
  return `<svg class="mini" viewBox="0 0 ${tref} 100" preserveAspectRatio="none" style="height:${h}px" aria-hidden="true">${r}</svg>`;
}
export function prof(p) {
  if (!p || !p.length) return '';
  const T = p.reduce((a, x) => a + x[0], 0) || 1;
  let x = 0, r = '';
  for (const [sec, l] of p) { const h = 18 * l + 10; r += `<rect x="${x}" y="${100 - h}" width="${Math.max(sec - T * 0.002, T * 0.002)}" height="${h}" style="fill:${ZC[l]}"/>`; x += sec; }
  const used = [...new Set(p.map(q => q[1]))].sort();
  return `<svg class="prof" viewBox="0 0 ${T} 100" preserveAspectRatio="none" aria-hidden="true">${r}</svg><div class="axe"><span>0</span><span>${Math.round(T / 60)} min</span></div>` +
    `<div class="zl">${used.map(l => `<span><i style="background:${ZC[l]}"></i>${ZN[l]}</span>`).join('')}</div>`;
}
// ---------- ligne de séance (planning, aujourd'hui) : icône, titre, chiffres, état ----------
// Écart de volume : vert dans ± 10 %, gris au-dessus, bleu en dessous (l'orange est réservé à l'allure trop rapide).
const ECL = e => (e == null ? '' : Math.abs(e) <= 10 ? 'ec-in' : e > 0 ? 'ec-vol' : 'ec-moins');
export const fEcart = e => (e == null ? '' : (e > 0 ? '+' : e < 0 ? '−' : '') + Math.abs(e) + ' %');
const icone = s => (s.sp === 'r' ? ICO.run : muIco(s));
// Nom affiché : le titre pour la course, le libellé du type pour la muscu (« Jambes », jamais « Muscu leg »).
export const nomSeance = s => (s.sp === 'r' ? s.t : s.lab || s.t);
// Ressenti attendu : séance faite ces 7 derniers jours, sans ressenti connu (envoyé, enregistré ou accusé).
export const sansRessenti = (M, s, ctx) => !!ctx && etat(s, M.T) === 'fait' && s.d >= addD(M.T, -6) && !ressentiSeance(M, s, ctx);
export function ligneSeance(M, s, ctx) {
  const et = etat(s, M.T), e = et === 'fait' ? ecartAffiche(ecartPrevu(s)) : null;
  const ch = esc(chiffresSeance(s));
  const sous = et === 'fait'
    ? `<b>${ch}</b>${e != null ? ` <span class="ec ${ECL(e)}">${fEcart(e)}</span>` : ''}`
    : s.saisie ? `${ch ? ch + ' · ' : ''}<span class="enatt">saisie envoyée · en attente</span>`
    : ch + (et === 'manque' ? ' · non faite' : '');
  const pastille = sansRessenti(M, s, ctx) ? pastilleRessenti(s) : '';
  const droite = et === 'fait' ? '<span class="okc" title="Faite">✓</span>'
    : et === 'manque' ? '<span class="nfc" title="Non faite">✕</span>'
    : s.sp === 'r' ? `<span class="pv">${mini(s.p, M.tref, 22)}</span>` : '';
  return `<button class="ps ${et}${s.sp === 'r' ? ' run' : ' mu'}" data-i="${s.i}" title="${esc(s.t)}">${ATT(s)}` +
    `<span class="psi">${icone(s)}</span><span class="pst"><b>${esc(s.sp === 'r' ? s.t : s.lab || s.t)}${AV(s)}</b><small>${sous}</small></span>${pastille}${droite}</button>`;
}
const pastilleRessenti = s => `<span class="rq" data-act="res-direct" data-i="${s.i}" role="button" tabindex="0" aria-label="Donner le ressenti"><span>ressenti ?</span></span>`;
export function ligneHors(x) {
  if (x.local) {
    return `<div class="ps hors local" title="Saisie muscu envoyée, en attente du PC"><span class="att"></span><span class="psi">${muIco({ sp: 'm', t: x.t, ty: '' })}</span>` +
      `<span class="pst"><b>${esc(x.t)}</b><small>${x.nex} exercice${x.nex > 1 ? 's' : ''} · <span class="enatt">en attente</span></small></span></div>`;
  }
  return `<button class="ps hors" data-h="${x.k}" title="${esc(x.t)} · hors plan"><span class="psi">${x.sp === 'r' ? ICO.run : x.sp === 'm' ? muIco({ sp: 'm', t: x.t, ty: '' }) : AUTRE}</span>` +
    `<span class="pst"><b>${esc(x.t)}</b><small>${actCourt(x)} · hors plan</small></span><span class="okc" title="Faite">✓</span></button>`;
}

// ---------- planning : semaine par semaine, tous les jours (vides compris) ----------
// Une seule barre : le prévu par zone d'intensité (pâle), le réalisé par-dessus en couleur pleine (au-delà du prévu :
// gris foncé). Semaine à venir : le prévu en plein.
function barreSemaine(P, montre) {
  const top = Math.max(P.prevu.km, P.reel.km, 1), pc0 = x => (x / top * 100).toFixed(1);
  const z = P.zk.map((k, i) => (k > 0 ? `<i style="width:${pc0(k)}%;background:${ZC[i + 1]}"></i>` : '')).join('');
  if (!montre) return `<div class="pbar" aria-hidden="true"><div class="pz">${z}</div></div>`;
  const r = P.reel.km / top;
  const plein = r > 0 ? `<div class="pzr" style="width:${(r * 100).toFixed(1)}%"><div class="pz" style="width:${(100 / r).toFixed(1)}%">${z}</div></div>` : '';
  return `<div class="pbar" aria-hidden="true"><div class="pz pale">${z}</div>${plein}</div>`;
}
function legendeSemaine(montre) {
  return `<div class="pleg">${montre ? '<p>Chiffres : réalisé, puis projeté en fin de semaine (réalisé + séances restantes) et prévu. Barre : prévu par intensité en pâle, réalisé en plein (gris au-delà du prévu).</p>' : '<p>Chiffres et barre : prévu, par intensité.</p>'}` +
    `<p class="pleg-i">${ICO.route} km de course · ${ICO.run} temps de course · ${ICO.mus} temps de muscu · séances faites / prévues</p><div class="zl">${[1, 2, 3, 4, 5].map(l => `<span><i style="background:${ZC[l]}"></i>${ZN[l]}</span>`).join('')}</div></div>`;
}
function teteSemaine(P) {
  const w = P.w, montre = P.passee || P.encours;
  const L = lignesSemaine(P), ic = { km: ICO.route, course: ICO.run, muscu: ICO.mus, seances: '' };
  const tt = { km: 'Km de course', course: 'Temps de course', muscu: 'Temps de muscu', seances: 'Séances faites' };
  return `<div class="ptete" data-act="leg-sem" role="button" tabindex="0" aria-label="Afficher la légende de la semaine"><div class="pt1"><b>S${w.n}</b><span>${dd(w.ws)} → ${dd(w.we)}</span>${w.ph ? `<span class="ph">${esc(w.ph)}</span>` : ''}${w.rec ? '<span class="ph">allégée</span>' : ''}${P.encours ? '<span class="enc">cette semaine</span>' : ''}</div>` +
    `<div class="pt2">${L.map(l => `<span title="${tt[l.cle]}">${ic[l.cle]}<b>${l.main}</b><small>${l.tail}</small></span>`).join('')}</div>${barreSemaine(P, montre)}${legendeSemaine(montre)}</div>`;
}
export function vPlanning(M, ctx) {
  let h = '<div class="planning">';
  M.W.forEach((w, n) => {
    const P = semainePlanning(M, n);
    h += `<section class="psem${P.encours ? ' encours' : ''}${P.passee ? ' passee' : ''}" id="pw-${n}">${teteSemaine(P)}`;
    for (const J of P.jours) {
      const items = J.S.map(s => ligneSeance(M, s, ctx)).join('') + J.H.map(ligneHors).join('');
      h += `<div class="pj${J.auj ? ' auj' : ''}${J.passe ? ' passe' : ''}" data-day="${J.d}"><div class="pjd">${JC[J.j]}<b>${jour(J.d).getDate()}</b></div>` +
        `<div class="pjl">${items || '<span class="pvide"></span>'}</div></div>`;
    }
    h += '</section>';
  });
  return h + '</div>';
}

// ---------- aujourd'hui : séances du jour, hier, prochaine séance si repos ; indicateurs en pied ----------
// Carte d'une séance du jour : div au rôle de bouton, car elle porte ses propres boutons (ressenti, « Commencer »).
function carteJour(M, s, ctx) {
  const et = etat(s, M.T), e = et === 'fait' ? ecartAffiche(ecartPrevu(s)) : null;
  const al = et !== 'fait' ? allureCible(s) : '';
  const commencer = s.sp === 'm' && s.sport === 'strength' && et === 'jour' && !s.saisie;
  return `<div class="nx" data-i="${s.i}" role="button" tabindex="0">${ATT(s)}<div class="nxh"><span class="psi">${icone(s)}</span><h2>${esc(nomSeance(s))}</h2>${sansRessenti(M, s, ctx) ? pastilleRessenti(s) : ''}${et === 'fait' ? '<span class="okc">✓</span>' : ''}</div>` +
    (et === 'fait'
      ? `<div class="chf"><div><b>${esc(chiffresSeance(s))}</b></div>${e != null ? `<div><b class="ec ${ECL(e)}">${fEcart(e)}</b></div>` : ''}</div>`
      : `<div class="chf">${s.km ? `<div><b>${f1(s.km)}</b> <span>km</span></div>` : ''}${s.mn && !dureeDansTitre(s) ? `<div><b>${Math.round(s.mn)}</b> <span>min</span></div>` : ''}${al ? `<div><b>${esc(al.replace(' /km', ''))}</b> <span>/km</span></div>` : ''}</div>` +
        (s.saisie ? '<div class="m enatt">Saisie muscu envoyée · en attente du PC</div>' : '') + (s.sp === 'r' && profilUtile(s) ? prof(s.p) : '') +
        (commencer ? `<div class="act"><button type="button" class="bt2 pri large" data-act="mu-commencer" data-i="${s.i}">Commencer</button></div>` : '')) + '</div>';
}
export function vAujourdhui(M, ctx) {
  const ss = M.S.filter(s => s.d === M.T), hs = (M.H || []).filter(x => x.d === M.T);
  let h = `<h2>Aujourd’hui<small>${jlong(M.T)}</small></h2><div class="auj-s">`;
  if (ss.length) h += ss.map(s => carteJour(M, s, ctx)).join('');
  else {
    const nx = M.S.find(s => s.d > M.T);
    h += `<div class="repos"><b>Repos</b>${nx ? `<span class="m">Prochaine séance · ${ecart(M.T, nx.d) === 1 ? 'demain' : jlong(nx.d)}</span>` : ''}</div>`;
    if (nx) h += ligneSeance(M, nx, ctx);
  }
  h += hs.map(ligneHors).join('') + '</div>';
  const hier = addD(M.T, -1), sh = M.S.filter(s => s.d === hier), hh = (M.H || []).filter(x => x.d === hier);
  h += `<h2 class="sous-titre">Hier<small>${jlong(hier)}</small></h2><div class="auj-l">` +
    (sh.length || hh.length ? sh.map(s => ligneSeance(M, s, ctx)).join('') + hh.map(ligneHors).join('') : '<p class="m">Repos</p>') + '</div>';
  // séance faite sans ressenti, d'aujourd'hui d'abord (le soir après la course), sinon d'hier : le bouton mène
  // directement à son formulaire ; « Ressenti du jour » seulement s'il n'y en a aucune
  const oubli = ressentiAttendu(M, ctx);
  h += '<div class="act">' + (oubli ? `<button class="bt2 pri large" data-act="res-direct" data-i="${oubli.i}">Ressenti · ${esc(titreCourt(oubli))}${oubli.d === M.T ? '' : ' d’hier'}</button>` : '<button class="bt2 large" data-act="ressenti-jour">Ressenti du jour</button>') + '</div>';
  return h + tuilesJour(M);
}
export function ressentiAttendu(M, ctx) {
  if (!ctx) return null;
  const hier = addD(M.T, -1);
  return M.S.find(s => s.d === M.T && sansRessenti(M, s, ctx)) || M.S.find(s => s.d === hier && sansRessenti(M, s, ctx)) || null;
}
function tuilesJour(M) {
  const t = M.today;
  if (!t) return '';
  const tu = (n, val, unite, sous, extra) => `<div class="tu"><div class="n">${n}</div><b>${val ?? '—'}${val != null && unite ? `<small>${unite}</small>` : ''}</b>${sous ? `<div class="s">${sous}</div>` : ''}${extra || ''}</div>`;
  const jauge = (v, lo, hi, max) => {
    if (v == null || !max) return '';
    const p = x => Math.min(100, x / max * 100).toFixed(1);
    const col = hi != null && v > hi ? 'var(--rouge)' : lo != null && v < lo ? 'var(--z2)' : 'var(--accent)';
    return `<div class="jauge"><i style="width:${p(v)}%;background:${col}"></i>${hi != null ? `<u style="left:${p(hi)}%"></u>` : ''}</div>`;
  };
  const HRV = { balanced: 'équilibrée', unbalanced: 'déséquilibrée', low: 'basse', poor: 'faible' };
  let h = `<h2 class="sous-titre">Forme${t.date !== M.T ? `<small>${jlong(t.date)}</small>` : ''}</h2><div class="tuiles">`;
  if (t.hrv) h += tu('VFC nocturne', t.hrv.value, 'ms', [HRV[t.hrv.status] || t.hrv.status, t.hrv.baseline_low != null ? `réf. ${t.hrv.baseline_low}-${t.hrv.baseline_high}` : ''].filter(Boolean).join(' · '));
  if (t.resting_hr != null) h += tu('FC repos', t.resting_hr, 'bpm');
  if (t.sleep) h += tu('Sommeil', t.sleep.duration_s ? fh(t.sleep.duration_s / 3600) : null, '', t.sleep.score != null ? `score ${t.sleep.score}` : '');
  if (t.body_battery != null) h += tu('Body Battery', t.body_battery, '/100', '', jauge(t.body_battery, null, null, 100));
  if (t.acute_load) h += tu('Charge aiguë', Math.round(t.acute_load.value), '', t.acute_load.range_low != null ? `cible ${Math.round(t.acute_load.range_low)}-${Math.round(t.acute_load.range_high)}` : '', jauge(t.acute_load.value, t.acute_load.range_low, t.acute_load.range_high, Math.max(t.acute_load.value, t.acute_load.range_high || 0) * 1.15));
  if (t.mechanical_load) { const m = t.mechanical_load; h += tu('Charge osseuse (7 j)', Math.round(m.load_7d), m.max_tolerated ? '/ ' + Math.round(m.max_tolerated) : '', m.max_tolerated ? Math.round(m.load_7d / m.max_tolerated * 100) + ' % du max' : '', jauge(m.load_7d, null, m.max_tolerated, Math.max(m.load_7d, m.max_tolerated || 0) * 1.15)); }
  return h + '</div>';
}
const jl2 = d => JL[jour(d).getDay()];

// ---------- fenêtre de détail d'une séance ----------
const SC = { in: 'dans la cible', fast: 'plus rapide', slow: 'plus lente' };
function gauge(l, lab) { l = l || 1; let h = '<div class="g">'; for (let k = 1; k <= 5; k++) h += `<i style="${k <= l ? 'background:' + ZC[l] : ''}"></i>`; return h + `</div><div class="gl">${lab || ZN[l]}</div>`; }
function profAt(p, T) {
  let x = 0, r = '';
  for (const [s, l] of p) { const h = 18 * l + 10; r += `<rect x="${x}" y="${100 - h}" width="${Math.max(s - T * 0.002, T * 0.002)}" height="${h}" style="fill:${ZC[l]}"/>`; x += s; }
  return `<svg viewBox="0 0 ${T} 100" preserveAspectRatio="none" aria-hidden="true">${r}</svg>`;
}

// ---------- fiche de séance : Prévu / Réalisé / Analyse, puis ressenti et actions ----------
const ORD = k => (k === 0 ? '1re' : k + 1 + 'e');
const heureDe = iso => { const m = /T(\d\d):(\d\d)/.exec(iso || ''); return m ? m[1] + ' h ' + m[2] : ''; };
// Onglets disponibles : une séance faite a les trois (la muscu n'a pas d'analyse), les autres le prévu seul.
export function onglets(s) {
  if (!s.done) return ['prevu'];
  return s.sp === 'r' ? ['prevu', 'real', 'an'] : ['prevu', 'real'];
}
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NOMS = { prevu: 'Prévu', real: 'Réalisé', an: 'Analyse' };

function partiePrevu(M, s) {
  let h = s.it ? `<p class="it">${esc(s.it)}</p>` : '';
  const pp = s.sp === 'r' && s.km && s.mn ? s.mn * 60 / s.km : null;
  h += `<div class="cf">${s.km ? `<div><b>${f1(s.km)} km</b>distance</div>` : ''}${s.mn ? `<div><b>${Math.round(s.mn)} min</b>durée</div>` : ''}${pp ? `<div><b>${pc(pp)}</b>/km moyen</div>` : ''}</div>`;
  if (s.sp !== 'r') return h + `<div>${muTag(s)}</div>`;
  return h + prof(s.p) +
    (s.sx.length ? `<ul class="et">${s.sx.map(([q, l, al, nm, no, rc, zl]) => `<li><div class="q">${esc(q)}</div><div>${gauge(l, zl)}</div><div class="dt">${al ? `<span class="al">${esc(al)}</span>` : ''}${rc ? `<span class="rc">${esc(rc)}</span>` : ''}<span class="nm">${esc(nm)}${no ? ' · ' + esc(no) : ''}</span></div></li>`).join('')}</ul>` : '');
}

export function muscuFaite(M, s) {
  const B = MUS.bloc(M.snap); if (!B) return null;
  const ids = s.real ? s.real.activity_ids || [] : [];
  const L = B.sessions || [], sid = s.real && s.real.strength_session_id;
  const duJour = L.filter(x => x.date === s.d && memeTypologie(x.title, s));
  return (sid != null && L.find(x => x.id === sid)) || L.find(x => x.activity_id != null && ids.includes(x.activity_id)) || (duJour.length === 1 ? duJour[0] : null);
}
function partieRealise(M, s) {
  const vs = versus(s);
  if (!vs) return '<p class="m">Pas de chiffres réalisés.</p>';
  const RST = { in: 'ec-in', fast: 'ec-plus', slow: 'ec-moins' }; // allure : orange = trop rapide
  let h = '<div class="rl">' + vs.rows.map(([l, a, b, e, st]) => {
    e = ecartAffiche(e);
    return `<div><span>${l}</span><b${st ? ` class="ec ${RST[st]}"` : ''}>${b}</b><small>${a === '—' ? '' : /^cible/.test(a) ? a : 'prévu ' + a}${e != null ? ` <em class="ec ${ECL(e)}">${fEcart(e)}</em>` : ''}</small></div>`;
  }).join('') + '</div>';
  if (s.parts.length) {
    h += `<h4>Activité${s.parts.length > 1 ? 's' : ''} rattachée${s.parts.length > 1 ? 's' : ''}</h4><ul class="acts">` + s.parts.map((a, k) =>
      `<li>${s.parts.length > 1 ? `<b>${ORD(k)}</b>` : ''}<span>${esc(a.display_name || '')}${heureDe(a.start) ? ` <small>${heureDe(a.start)}</small>` : ''}${a.plan_link === 'manual' ? ' <small class="lien">rattachée à la main</small>' : ''}</span><span class="n">${a.distance_m ? f1(a.distance_m / 1000) + ' km · ' : ''}${Math.round((a.duration_s || 0) / 60)} min${a.avg_hr ? ' · ' + Math.round(a.avg_hr) + ' bpm' : ''}</span>` +
      `<button type="button" class="bt2 petit" data-act="lien" data-a="${a.id}">Rattachement</button></li>`).join('') + '</ul>';
  }
  if (s.sp === 'm') {
    const m = muscuFaite(M, s);
    if (m && m.exercises && m.exercises.length) {
      h += '<h4>Exercices</h4><ul class="acts">' + m.exercises.map(e => `<li><span>${esc(MUS.libelle(M.snap, e.exercise))}</span><span class="n">${esc(MUS.resume(e.sets))}</span></li>`).join('') + '</ul>';
    }
  }
  return h;
}
function partieAnalyse(s) {
  if (s.an) return vAnalyse(s.an);
  const pr = s.act ? prevuRealise(s) : null;
  if (!pr || !pr.rows.length) return '<p class="m">Pas d’analyse pour cette séance (calculée sur le PC pour les 14 derniers jours).</p>';
  let h = pr.nCible ? `<div class="cf"><div><b>${pr.nIn}/${pr.nCible}</b>dans la cible</div></div>` : '';
  if (pr.rp.length && s.p.length) {
    const Tp = s.p.reduce((q, y) => q + y[0], 0), Tr = pr.rp.reduce((q, y) => q + y[0], 0), T = Math.max(Tp, Tr);
    h += `<div class="pr"><span>Prévu</span>${profAt(s.p, T)}<span>Réalisé</span>${profAt(pr.rp, T)}<span></span><div class="axe"><span>0</span><span>${Math.round(T / 60)} min</span></div></div>`;
  }
  h += '<div class="tbw"><table class="tb"><tr><th>Étape</th><th>Cible</th><th>Réel</th><th>Écart</th><th>Fait</th><th>FC</th></tr>' +
    pr.rows.map(r => `<tr class="${r.hp ? 'hp' : ''}"><td>${esc(r.lab)}</td><td>${esc(r.tgt)}</td><td class="${r.st}">${esc(r.p)}</td><td class="${r.st}" title="${SC[r.st] || ''}">${r.st ? (r.dl ? (r.dl > 0 ? '+' : '') + r.dl + ' s' : '✓') : ''}</td><td>${esc(r.rq)}</td><td>${r.hr || ''}</td></tr>`).join('') +
    '</table></div>' + (pr.nCible ? '<div class="leg3"><b class="in">● cible</b><b class="fast">● plus vite</b><b class="slow">● plus lent</b>écart en s/km</div>' : '');
  const ev = evaluation(s, pr);
  return h + (ev.length ? '<ul class="ev">' + ev.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>' : '<p class="ok2">Séance conforme</p>');
}

export function detail(M, s, ctx) {
  const et = etat(s, M.T), O = onglets(s), o = O.includes(ctx.onglet) ? ctx.onglet : O.includes('real') ? 'real' : 'prevu';
  let h = `<h3 id="fen-titre">${s.sp === 'r' ? '' : `<span class="psi">${muIco(s)}</span>`}${esc(nomSeance(s))}${s.attente ? '<span class="badge att2">en attente du PC</span>' : ''}${et === 'fait' ? '<span class="badge fait">✓ faite</span>' : et === 'manque' ? '<span class="badge hp2">non faite</span>' : ''}</h3>` +
    `<div class="m">${jlong(s.d)} ${MOIS[jour(s.d).getMonth()]} · S${M.W[s.w] ? M.W[s.w].n : ''}${nomSeance(s) !== s.t && !/^muscu \S+$/i.test(s.t) ? ' · ' + esc(s.t) : ''}</div>`;
  if (O.length > 1) h += `<div class="ong" role="tablist">${O.map(k => `<button type="button" role="tab" data-act="ong" data-o="${k}" class="${k === o ? 'on' : ''}" aria-selected="${k === o}">${NOMS[k]}</button>`).join('')}</div>`;
  else h += '<h4 class="h-prevu">Prévu</h4>';
  h += `<div class="ong-c">${o === 'real' ? partieRealise(M, s) : o === 'an' ? partieAnalyse(s) : partiePrevu(M, s)}</div>`;

  // ressenti : en bas du Réalisé (pas répété sous l'Analyse ni le Prévu d'une séance faite) ; une fois envoyé ou
  // enregistré, un résumé et un crayon ; le formulaire seulement s'il n'y a rien
  if (s.d <= M.T && (o === 'real' || !O.includes('real'))) {
    h += '<h4 id="ressenti">Ressenti</h4>';
    const r = ressentiSeance(M, s, ctx);
    ctx.envoyes.filter(a => a.payload && a.payload.session_id === s.id && a.type === 'pain').forEach(a => {
      h += `<div class="dejafait">${resumeRessenti({ kind: 'pain', ...a.payload })}<span class="statut">${statutEnvoi(a)}</span></div>`;
    });
    if (r && !ctx.edition) h += carteRessenti(r);
    else h += formRessenti(ctx.saisie, !!r);
  }

  // le coach se sollicite sur le PC (bouton de l'en-tête) : plus de « Demander l'avis du coach » ici (D75)
  const mf = s.sp === 'm' && s.done ? muscuFaite(M, s) : null;
  h += '<div class="act">' +
    (s.sp === 'm' && !s.done && !s.saisie ? '<button class="bt2 pri" data-act="mu-saisir">Saisir cette séance</button>' : '') +
    (mf ? `<button class="bt2" data-act="mu-editer" data-id="${mf.id}">Modifier la saisie</button>` : '') +
    (deplacable(M, s) ? '<button class="bt2" data-act="dep">Déplacer</button><button class="bt2" data-act="int">Intervertir</button>' : '') +
    '<button class="bt2" data-act="edit">Intitulé et type</button>' +
    (ctx.confirmSuppr ? '<span class="confirme">Supprimer cette séance ?<button class="bt2 rouge" data-act="suppr-ok">Oui, supprimer</button><button class="bt2" data-act="suppr-non">Non</button></span>'
      : '<button class="bt2 rouge" data-act="suppr">Supprimer</button>') +
    '</div>';
  h += `<div class="nav"><button class="bt2" data-act="prec"${s.i <= 0 ? ' disabled' : ''}>‹ Précédente</button><button class="bt2" data-act="suiv"${s.i >= M.S.length - 1 ? ' disabled' : ''}>Suivante ›</button></div>`;
  return h;
}
// Libellés du PC (DoneTabs.tsx) : jambes lourdes / normales / légères, souffle court / normal / facile,
// stockés 1 / 3 / 5 (contrat `feeling`). Une valeur intermédiaire (ancienne échelle 1-5) est ramenée au plus proche.
export const JAMBES = [['lourdes', 1], ['normales', 3], ['légères', 5]], SOUFFLE = [['court', 1], ['normal', 3], ['facile', 5]];
export const niv3 = v => (v == null ? null : v <= 2 ? 1 : v >= 4 ? 5 : 3);
const lib3 = (L, v) => { const x = L.find(([, n]) => n === niv3(v)); return x ? x[0] : null; };

// Ressenti connu d'une séance : envoyé (action en file) > enregistré sur le PC (instantané) > accusé localement.
export function ressentiSeance(M, s, ctx) {
  const env = ctx.envoyes.filter(a => a.type === 'feeling' && a.payload && a.payload.session_id === s.id).pop();
  if (env) return { ...env.payload, statut: statutEnvoi(env) };
  const ids = s.real ? s.real.activity_ids || [] : [];
  const w = s.fb || M.wellness.find(x => x.kind === 'session' && (x.session_id === s.id || ids.includes(x.activity_id)));
  if (w) return { rpe: w.rpe, legs: w.legs, breath: w.breath, comment: w.comment, statut: 'enregistré' };
  const loc = ctx.ressentis && ctx.ressentis['s' + s.id];
  return loc ? { ...loc, statut: 'enregistré' } : null;
}
export function carteRessenti(r, act = 'res-edit') {
  const n = (v, max) => v != null ? `<b>${v}</b>${max ? `<small>/${max}</small>` : ''}` : '<b>—</b>';
  const l = (L, v) => `<b class="mot">${lib3(L, v) || '—'}</b>`;
  return `<div class="ress"><div class="ress-c"><div><span>RPE</span>${n(r.rpe, 10)}</div><div><span>Jambes</span>${l(JAMBES, r.legs)}</div><div><span>Souffle</span>${l(SOUFFLE, r.breath)}</div>` +
    `<button type="button" class="crayon" data-act="${act}" aria-label="Modifier le ressenti" title="Modifier"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg></button></div>` +
    (r.comment ? `<p class="ress-com">${esc(r.comment)}</p>` : '') + `<div class="statut${r.statut === 'enregistré' ? ' ok-t' : ''}">${r.statut === 'enregistré' ? '✓ ' : ''}${r.statut}</div></div>`;
}

export function detailHors(M, x) {
  const a = x.raw;
  let h = `<h3 id="fen-titre">${esc(x.t)}<span class="badge hp2">hors plan</span></h3><div class="m">${jl2(x.d)} ${dd(x.d)}</div><div class="cf">` +
    (x.km >= 0.5 ? `<div><b>${f1(x.km)} km</b>distance</div>` : '') + `<div><b>${Math.round(x.mn)} min</b>durée</div>` +
    (x.pace && x.sp === 'r' ? `<div><b>${pc(x.pace)}</b>/km</div>` : '') + (x.hr ? `<div><b>${x.hr}</b>bpm moyen</div>` : '') + '</div>';
  if (a.elevation_gain_m) h += `<div class="m">D+ ${Math.round(a.elevation_gain_m)} m</div>`;
  return h + `<p class="m">Activité non rattachée à une séance du plan${a.plan_link === 'none' ? ' (laissée hors plan à la main)' : ''}.</p>` +
    `<div class="act"><button class="bt2" data-act="lien" data-a="${a.id}">Rattacher à une séance</button></div>`;
}

// ---------- D75 : intitulé et type, rattachement d'une activité ----------
export const TYPES_COURSE = [['easy', 'Footing'], ['long', 'Sortie longue'], ['recovery', 'Récupération'], ['threshold', 'Seuil'], ['tempo', 'Tempo'],
  ['intervals_short', 'Fractionné court'], ['intervals_long', 'Fractionné long'], ['hills', 'Côtes'], ['progressive', 'Progressif'], ['fartlek', 'Fartlek'], ['race', 'Course'], ['test', 'Test']];
export const TYPES_MUSCU = [['dos', 'Dos', 'Muscu dos'], ['leg', 'Jambes', 'Muscu leg'], ['pecs', 'Pecs', 'Muscu pecs'], ['epaules', 'Épaules', 'Muscu épaules'],
  ['bras', 'Bras', 'Muscu bras'], ['abdos', 'Abdos', 'Muscu abdos'], ['hyrox', 'Hyrox', 'Hyrox']];
/** Fenêtre « Intitulé et type » : liste des types (course ou partie du corps pour la muscu) et saisie libre. */
export function dlgEdition(s) {
  const run = s.sp === 'r', k0 = run ? s.ty : (muKind(s.t, s.ty)[0] || 'dos');
  const opts = run ? TYPES_COURSE : TYPES_MUSCU;
  return `<h3 id="fen-titre">Intitulé et type</h3><div class="m">${esc(nomSeance(s))} · ${jl2(s.d)} ${dd(s.d)}</div><div class="fm">` +
    `<label for="ed-ty">Type</label><select id="ed-ty" data-ed="ty">${opts.map(([v, l]) => `<option value="${v}"${v === k0 ? ' selected' : ''}>${l}</option>`).join('')}${run && !opts.some(([v]) => v === k0) ? `<option value="${esc(k0)}" selected>${esc(k0)}</option>` : ''}</select>` +
    `<label for="ed-ti">Intitulé</label><input type="text" id="ed-ti" data-ed="ti" maxlength="200" value="${esc(s.t)}">` +
    '<div class="act col"><button class="bt2 pri large" data-act="edit-ok">Enregistrer</button><button class="bt2 large" data-act="retour">Retour</button></div></div>';
}
/** Séances auxquelles rattacher une activité à la main : même jour ou ± 1 jour (règle du PC, D75). */
export const seancesProches = (M, a) => M.S.filter(s => Math.abs(ecart(a.date, s.d)) <= 1);
export function dlgLien(M, a, enAttente) {
  const cur = M.S.find(s => s.parts.some(p => p.id === a.id));
  const cand = seancesProches(M, a).filter(s => s !== cur);
  return `<h3 id="fen-titre">Rattachement</h3><div class="m">${esc(a.display_name || 'Activité')} · ${jl2(a.date)} ${dd(a.date)}</div>` +
    `<p class="m">${cur ? `Compte pour « ${esc(nomSeance(cur))} » (${jl2(cur.d)})` : 'Hors plan'}${a.plan_link === 'manual' ? ' · rattachée à la main' : a.plan_link === 'none' ? ' · laissée hors plan à la main' : ' · rattachement automatique'}</p>` +
    (enAttente ? '<p class="m enatt">Correction envoyée · en attente du PC</p>' : '') +
    '<div class="lst">' + cand.map(s => `<button class="bt2" data-act="lien-ok" data-a="${a.id}" data-s="${s.id}">Rattacher à « ${esc(nomSeance(s))} » <small>· ${jl2(s.d)} ${dd(s.d)}</small></button>`).join('') +
    (cur ? `<button class="bt2" data-act="lien-ok" data-a="${a.id}" data-s="">Détacher : laisser hors plan</button>` : '') +
    (a.plan_link ? `<button class="bt2" data-act="lien-auto" data-a="${a.id}">Revenir au rattachement automatique</button>` : '') +
    '</div><p class="m">Ton choix prime sur la règle automatique et reste en place.</p><div class="act"><button class="bt2" data-act="retour">Retour</button></div>';
}

export function resumeRessenti(x) {
  if (x.kind === 'pain') return `Douleur ${esc(x.zone || '')} <b>${x.intensity ?? '—'}/10</b>${x.comment ? ' · ' + esc(x.comment) : ''}`;
  return [x.rpe != null ? `RPE <b>${x.rpe}</b>` : '', x.legs != null ? `jambes <b>${lib3(JAMBES, x.legs)}</b>` : '', x.breath != null ? `souffle <b>${lib3(SOUFFLE, x.breath)}</b>` : '', x.comment ? esc(x.comment) : ''].filter(Boolean).join(' · ');
}

export function formRessenti(r, edition) {
  const seg = (f, vals, cls) => `<div class="seg${cls ? ' ' + cls : ''}">${vals.map(v => { const [lab, val] = Array.isArray(v) ? v : [v, v]; return `<button type="button" data-act="res" data-f="${f}" data-val="${val}" class="${String(r[f]) === String(val) ? 'on' : ''}">${lab}</button>`; }).join('')}</div>`;
  // RPE en deux rangées de 5, « non / oui » et envoi pleine largeur : tout au pouce (≥ 44 px)
  return '<div class="fm" id="f-ressenti"><label>Effort perçu (RPE 1-10)</label>' + seg('rpe', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'n10') +
    '<label>Jambes</label>' + seg('legs', JAMBES, 'mots') + '<label>Souffle</label>' + seg('breath', SOUFFLE, 'mots') +
    '<label>Douleur</label>' + seg('douleur', ['non', 'oui'], 'mots deux') +
    (r.douleur === 'oui' ? '<div class="ln"><div><label>Zone</label>' + seg('zone', ['tibia', 'cuisse', 'autre']) + `</div><div><label>Intensité <b id="int-v">${r.int ?? 3}</b>/10</label><input type="range" min="0" max="10" value="${r.int ?? 3}" data-in="int"></div></div>` : '') +
    `<label>Commentaire</label><textarea rows="2" data-in="com" maxlength="500">${esc(r.com || '')}</textarea>` +
    `<div class="act col"><button class="bt2 pri large" data-act="res-ok"${(r.rpe || r.legs || r.breath || r.douleur === 'oui' || r.com) ? '' : ' disabled'}>${edition ? 'Envoyer la correction' : 'Envoyer le ressenti'}</button>${edition ? '<button class="bt2 large" data-act="res-annuler">Annuler</button>' : ''}</div></div>`;
}
