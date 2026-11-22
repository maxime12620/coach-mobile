// Passage de l'instantané (contrat docs/mobile.md) au modèle d'affichage, et calculs repris de la maquette validée
// (profils, zones, étapes sur 3 colonnes, prévu vs réalisé).

// Couleurs des zones : variables CSS (échelle de bleus puis orange et rouge, thème clair et sombre, D66).
export const ZC = ['', 'var(--z1)', 'var(--z2)', 'var(--z3)', 'var(--z4)', 'var(--z5)'];
export const ZN = ['', 'Récup', 'Endurance', 'Marathon · semi', 'Seuil · 10 km', 'VMA'];
export const JC = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const QUAL = new Set(['intervals_short', 'intervals_long', 'threshold', 'tempo', 'hills', 'fartlek', 'test', 'race', 'race_pace', 'vo2max']);

// ---------- dates (jour local, sans heure) ----------
export const jour = d => new Date(d + 'T12:00');
export const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
export const addD = (s, k) => { const d = jour(s); d.setDate(d.getDate() + k); return iso(d); };
export const lundi = s => addD(s, -((jour(s).getDay() + 6) % 7));
export const ecart = (a, b) => Math.round((jour(b) - jour(a)) / 864e5);
export const aujourdhui = () => iso(new Date());

// ---------- formats ----------
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const fk = x => String(Math.round(x || 0));
export const f1 = x => (Math.round((x || 0) * 10) / 10).toFixed(1).replace('.', ',');
// Durée : « 59 min » sous l'heure, « 1 h 05 » au-delà (jamais « 0 h 59 »).
export const fh = h => { const m = Math.round((h || 0) * 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
export const dd = s => { const d = jour(s); return d.getDate() + '/' + (d.getMonth() + 1); };
export const JL = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const jl = d => JL[jour(d).getDay()] + ' ' + dd(d);
const JLONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const jlong = d => { const x = jour(d); return JLONG[x.getDay()] + ' ' + x.getDate(); };
export const pc = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ---------- niveaux d'intensité ----------
// Seuils d'allure tirés des allures de référence de l'instantané ; à défaut, ceux de la maquette.
let BORNES = [215, 255, 280, 345];
export function reglerBornes(ref) {
  if (!ref) return;
  const { easy, marathon, threshold, interval, repetition } = ref;
  const b = BORNES.slice();
  if (interval && threshold) b[0] = (interval + threshold) / 2; else if (repetition) b[0] = repetition + 10;
  if (threshold && marathon) b[1] = (threshold + marathon) / 2;
  if (marathon && easy) b[2] = (marathon + easy) / 2;
  if (easy) b[3] = easy + 15;
  if (b.every((x, k) => !k || x > b[k - 1])) BORNES = b;
}
export const lvAllure = p => p <= BORNES[0] ? 5 : p <= BORNES[1] ? 4 : p <= BORNES[2] ? 3 : p <= BORNES[3] ? 2 : 1;
const mp = t => t && t.type === 'pace' ? (t.min_s_per_km + t.max_s_per_km) / 2 : 360;
const lvP = t => (!t || t.type !== 'pace') ? 1 : lvAllure(mp(t));
const hill = x => { const t = ((x.label || '') + ' ' + (x.notes || '')).toLowerCase(); return x.kind === 'active' && (t.includes('côte') || t.includes('cote')); };
function slv(x) {
  const t = x.target;
  if (t && t.type === 'pace') return lvP(t);
  if (hill(x)) { const d = x.duration || {}; return d.type !== 'time' || (d.seconds || 0) <= 60 ? 5 : 4; }
  const l = (x.label || '').toLowerCase();
  if (x.kind === 'recovery' || x.kind === 'rest' || l.includes('trot')) return 1;
  return x.kind === 'active' && t && t.type === 'hr' ? 3 : 2;
}
const dm = d => d.meters || d.m || d.distance_m || 0;
const ssec = x => { const d = x.duration || {}; return d.type === 'time' ? d.seconds : d.type === 'distance' ? dm(d) / 1000 * mp(x.target) : 60; };
const smet = x => { const d = x.duration || {}; return d.type === 'distance' ? dm(d) : ssec(x) / mp(x.target) * 1000; };
export const flat = xs => xs.flatMap(x => x.kind === 'repeat' ? flat(x.steps) : [x]);
const each = (xs, f, m = 1) => xs.forEach(x => x.kind === 'repeat' ? each(x.steps, f, m * (x.count || 1)) : f(x, m));
export function dur(d) {
  if (!d) return '';
  if (d.type === 'time') { const s = Math.round(d.seconds); if (s >= 60 && s % 60 === 0) return s / 60 + ' min'; if (s >= 60) return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0'); return s + ' s'; }
  if (d.type === 'distance') { const m = dm(d); return m >= 1000 ? String(m / 1000).replace('.', ',') + ' km' : Math.round(m) + ' m'; }
  return '';
}
function qty(x, rep) {
  if (x.kind === 'repeat') return (x.count || 1) + ' × ' + x.steps.map(y => qty(y, true)).join(' / ');
  const d = x.duration || {};
  if (d.type === 'distance') { const m = dm(d); if (rep && m < 5000) return Math.round(m) + ' m'; if (m >= 1000) return String(m / 1000).replace('.', ',') + ' km'; }
  return dur(d) || 'libre';
}
const ptx = t => t && t.type === 'pace' ? pc(t.min_s_per_km) + '-' + pc(t.max_s_per_km) + ' /km' : t && t.type === 'hr' ? t.min_bpm + '-' + t.max_bpm + ' bpm' : '';
const llv = x => x.kind === 'repeat' ? Math.max(...x.steps.map(llv)) : slv(x);
const fastOf = xs => xs.reduce((a, b) => { const la = slv(a), lb = slv(b); return lb > la || (lb === la && b.kind === 'active' && a.kind !== 'active') ? b : a; });
function zlab(x) {
  if (x.kind === 'repeat') return zlab(fastOf(flat(x.steps)));
  if (hill(x) && !(x.target && x.target.type === 'pace')) return slv(x) === 5 ? 'Côte · VMA' : 'Côte · seuil';
  return '';
}
const LIB = { warmup: 'Échauffement', cooldown: 'Retour au calme', recovery: 'Récup', rest: 'Repos', active: 'Effort' };
// Une étape sur 3 colonnes : [quantité, niveau, allure, libellé, consigne, récup, libellé de zone]
function cols(x) {
  if (x.kind !== 'repeat') return [qty(x), slv(x), ptx(x.target), x.label || LIB[x.kind] || '', x.notes || '', '', zlab(x)];
  const inner = flat(x.steps), f = fastOf(inner);
  const rec = inner.filter(y => y !== f).map(y => {
    const lab = y.label || LIB[y.kind] || '', d = dur(y.duration);
    let t = lab + (d && !lab.includes(d) ? ' ' + d : '');
    if (ptx(y.target)) t += ' à ' + ptx(y.target);
    if ((y.kind === 'recovery' || y.kind === 'rest') && !lab.toLowerCase().startsWith('récup')) t = 'récup ' + t[0].toLowerCase() + t.slice(1);
    return t;
  });
  return [qty(x), llv(x), ptx(f.target), x.label || f.label || LIB[f.kind] || '', [x.notes, ...inner.map(y => y.notes)].filter(Boolean).join(' ; '), rec.join(' · '), zlab(x)];
}
const pf = xs => xs.flatMap(x => x.kind === 'repeat' ? Array.from({ length: x.count || 1 }, () => pf(x.steps)).flat() : [[Math.round(ssec(x)), slv(x)]]);

// ---------- normalisation des étapes (tolère les variantes de l'exemple du contrat) ----------
function etape(x) {
  if (!x || typeof x !== 'object') return null;
  const kind = x.kind === 'work' ? 'active' : x.kind;
  if (kind === 'repeat') return { kind, count: x.count || 1, label: x.label, notes: x.notes, steps: (x.steps || []).map(etape).filter(Boolean) };
  let d = x.duration;
  if (!d || typeof d !== 'object') d = x.duration_s ? { type: 'time', seconds: x.duration_s } : x.distance_m ? { type: 'distance', meters: x.distance_m } : { type: 'open' };
  let t = x.target;
  if (!t && (x.pace_min_s_km || x.target_pace_min)) t = { type: 'pace', min_s_per_km: x.pace_min_s_km || x.target_pace_min, max_s_per_km: x.pace_max_s_km || x.target_pace_max };
  return { kind: kind || 'active', label: x.label || null, notes: x.notes || null, duration: d, target: t || { type: 'open' } };
}

// ---------- muscu : partie du corps ----------
const MU_LAB = { dos: 'Dos', leg: 'Jambes', pecs: 'Pecs', epaules: 'Épaules', bras: 'Bras', abdos: 'Abdos', hyrox: 'Hyrox' };
export function muKind(t, ty) {
  const s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/hyrox/.test(s)) return ['hyrox', 'Hyrox'];
  if (/\bdos\b/.test(s)) return ['dos', 'Dos'];
  if (/pec/.test(s)) return ['pecs', 'Pecs'];
  if (/epaule/.test(s)) return ['epaules', 'Épaules'];
  if (/bras|biceps|triceps/.test(s)) return ['bras', 'Bras'];
  if (/\bleg|jambe|cuisse|fessier|squat/.test(s)) return ['leg', 'Jambes'];
  if (/abdo|gainage|core/.test(s)) return ['abdos', 'Abdos'];
  if (ty === 'strength_legs') return ['leg', 'Jambes'];
  if (ty === 'mobility') return ['abdos', 'Gainage'];
  if (ty === 'strength_upper') return ['pecs', 'Haut'];
  return ['', 'Muscu'];
}
const SPORT = { cycling: 'Vélo', walking: 'Marche', hiking: 'Rando', swimming: 'Natation', cardio: 'Cardio', other: 'Autre' };

// ---------- séance ----------
export function deriver(s) {
  const z = [0, 1, 2, 3, 4, 5].map(() => [0, 0]);
  each(s.x, (x, m) => { const l = slv(x); z[l][0] += ssec(x) * m; z[l][1] += smet(x) * m; });
  s.zm = [1, 2, 3, 4, 5].map(k => z[k][0] / 60);
  s.zk = [1, 2, 3, 4, 5].map(k => z[k][1] / 1000);
  s.key = Math.max(1, ...[1, 2, 3, 4, 5].filter(k => z[k][0] >= 240));
  s.p = pf(s.x); s.sx = s.x.map(cols); s.lv = s.x.map(llv);
}

function seance(r) {
  const sport = r.sport || 'running';
  const s = {
    id: r.id, d: r.date, o: r.order || 1, ty: r.type || '', t: r.title || '', it: r.intent || '',
    sp: sport === 'running' ? 'r' : (sport === 'strength' || r.type === 'mobility') ? 'm' : 'x',
    sport, status: r.status || 'planned', actId: r.activity_id ?? null, x: [],
    real: r.realized || null, fb: r.feedback || null, an: r.analysis && r.analysis.available ? r.analysis : null,
  };
  const st = r.structure && Array.isArray(r.structure.steps) ? r.structure.steps.map(etape).filter(Boolean) : [];
  if (s.sp === 'r') {
    s.x = st.length ? st : [{ kind: 'active', label: s.t, duration: r.est_duration_s ? { type: 'time', seconds: r.est_duration_s } : r.est_distance_m ? { type: 'distance', meters: r.est_distance_m } : { type: 'time', seconds: 2400 }, target: { type: 'open' } }];
    deriver(s);
    const km0 = s.zk.reduce((a, b) => a + b, 0), mn0 = s.zm.reduce((a, b) => a + b, 0);
    // Les estimations du PC font foi pour les totaux ; la répartition par zone garde les proportions calculées.
    s.km = r.est_distance_m ? r.est_distance_m / 1000 : km0;
    s.mn = r.est_duration_s ? r.est_duration_s / 60 : mn0;
    if (km0 > 0) s.zk = s.zk.map(k => k * s.km / km0);
    if (mn0 > 0) s.zm = s.zm.map(m => m * s.mn / mn0);
  } else {
    s.x = st; s.p = []; s.sx = []; s.lv = []; s.key = 1;
    s.km = sport === 'strength' ? 0 : (r.est_distance_m || 0) / 1000;
    s.mn = (r.est_duration_s || 0) / 60;
    s.zm = [0, 0, 0, 0, 0]; s.zk = [0, 0, 0, 0, 0];
    s.lab = s.sp === 'm' ? muKind(s.t, s.ty)[1] : (SPORT[sport] || 'Autre');
  }
  s.est = [s.km ? f1(s.km) + ' km' : '', s.mn ? Math.round(s.mn) + ' min' : ''].filter(Boolean).join(' · ');
  return s;
}

// ---------- modèle complet ----------
// pend : actions locales non encore accusées par le PC, appliquées par-dessus l'instantané.
export function construire(snap, pend = [], opts = {}) {
  reglerBornes(snap.athlete && snap.athlete.reference_paces);
  const T = opts.T || aujourdhui();
  const S = (snap.sessions || []).filter(r => r && r.date).map(seance);
  const conflitsLocaux = [], muLoc = [];
  // muscu dont la suppression est en attente (D75) : sa saisie en file n'est plus montrée
  const muSuppr = new Set(pend.filter(a => a.type === 'delete_strength_session').map(a => a.payload && a.payload.uid).filter(Boolean));
  for (const a of pend) {
    const p = a.payload || {};
    if (a.type === 'strength_session') { if (p.date && p.session_id == null && !muSuppr.has(p.uid)) muLoc.push(a); continue; }
    // D75 : suppression et intitulé / type d'une séance, appliqués tout de suite en attendant l'accusé du PC
    if (a.type === 'delete_session') { const k = S.findIndex(x => x.id === p.session_id); if (k >= 0) S.splice(k, 1); continue; }
    if (a.type === 'edit_session') {
      const s = S.find(x => x.id === p.session_id); if (!s) continue;
      if (p.title) s.t = p.title;
      if (p.type) s.ty = p.type;
      if (s.sp === 'm') s.lab = p.kind ? (MU_LAB[p.kind] || s.lab) : muKind(s.t, s.ty)[1] || s.lab;
      s.attente = a.id;
      continue;
    }
    if (a.type === 'move_session') {
      const s = S.find(x => x.id === p.session_id);
      if (!s || s.d !== p.from_date) { if (s && s.d === p.to_date) continue; conflitsLocaux.push(a.id); continue; }
      const autres = S.filter(x => x.d === p.to_date && x !== s).sort((x, y) => x.o - y.o);
      autres.splice(Math.max(0, (p.position || autres.length + 1) - 1), 0, s);
      s.d = p.to_date; autres.forEach((x, k) => { x.o = k + 1; });
      s.attente = a.id;
    } else if (a.type === 'swap_sessions') {
      const x = S.find(z => z.id === p.a_id), y = S.find(z => z.id === p.b_id);
      if (!x || !y) { conflitsLocaux.push(a.id); continue; }
      [x.d, y.d] = [y.d, x.d]; [x.o, y.o] = [y.o, x.o];
      x.attente = y.attente = a.id;
    }
  }
  S.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.o - b.o));

  // activités : rattachement du PC (règle unique D69 : toutes les activités rattachées portent session_id ;
  // `realized` les cumule, `activity_id` reste l'activité principale)
  const A = snap.activities || [];
  const parSeance = new Map(A.filter(a => a.session_id != null).map(a => [a.session_id, a]));
  const parId = new Map(A.map(a => [a.id, a]));
  const absorbees = new Set();
  S.forEach((s, i) => {
    s.i = i;
    s.act = (s.actId != null ? parId.get(s.actId) : null) || parSeance.get(s.id) || null;
    if (!s.real && s.act) s.real = { activity_ids: [s.act.id], distance_m: s.act.distance_m, duration_s: s.act.duration_s, pace_s_km: s.act.pace_s_km, avg_hr: s.act.avg_hr };
    if (s.real) (s.real.activity_ids || []).forEach(id => absorbees.add(id));
    s.parts = s.real ? (s.real.activity_ids || []).map(id => parId.get(id)).filter(Boolean) : [];
    s.done = s.status === 'done' || s.status === 'partial' || s.status === 'exceeded' || s.status === 'below' || !!s.act || !!s.real;
    s.passe = s.d < T;
  });
  // réalisé hors plan : activités ni appariées ni cumulées à une séance
  const H = A.filter(a => a.session_id == null && !absorbees.has(a.id) && a.date).map(horsPlan);
  // muscu saisie sur le téléphone, pas encore accusée : sur la séance muscu prévue ce jour-là, sinon à part
  const typs = (snap.strength && snap.strength.typologies) || [];
  for (const a of muLoc) {
    const p = a.payload, lab = (typs.find(t => t.title === p.title) || {}).label || muKind(p.title, '')[1];
    const cand = S.filter(s => s.d === p.date && s.sp === 'm' && !s.done && !s.saisie);
    const s = cand.find(x => muKind(x.t, x.ty)[0] === muKind(p.title, '')[0]) || cand[0];
    if (s) { s.saisie = a.id; s.attente = s.attente || a.id; continue; }
    H.push({ id: 'loc-' + a.id, d: p.date, start: '', sp: 'm', type: 'strength', t: lab, km: 0, mn: 0, local: true, attente: a.id, nex: (p.exercises || []).length, raw: {} });
  }
  H.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.start || '') < (b.start || '') ? -1 : 1));
  // muscu placée avant la course du même jour
  S.forEach(s => { if (s.sp === 'm') { const r = S.filter(x => x.d === s.d && x.sp === 'r'); s.av = r.length > 0 && r.every(x => x.o > s.o); } });

  // semaines : du lundi de la première séance (ou du plan) au dimanche de la dernière
  const plan = snap.plan || {};
  const debuts = [...S.map(s => lundi(s.d)), ...(plan.weeks || []).map(w => lundi(w.week_start))].sort();
  const W = [];
  if (debuts.length) {
    const premier = debuts[0], dernier = debuts[debuts.length - 1];
    const PW = new Map((plan.weeks || []).map(w => [lundi(w.week_start), w]));
    const phases = plan.phases || [];
    for (let ws = premier, n = 0; ws <= dernier; ws = addD(ws, 7), n++) {
      const pw = PW.get(ws) || {};
      const ph = phases.find(p => p.start <= addD(ws, 6) && (!p.end || p.end >= ws));
      W.push({ n: n + 1, ws, we: addD(ws, 6), rec: !!pw.is_light, tgt: pw.target_km ?? null, ph: pw.phase || (ph && ph.name) || '' });
    }
  }
  if (W.length) [...S, ...H].forEach(s => { const k = ecart(W[0].ws, s.d); s.w = Math.floor(k / 7); s.j = ((k % 7) + 7) % 7; });
  H.forEach((h, k) => { h.k = k; });
  W.forEach((w, n) => {
    const ss = S.filter(s => s.w === n), r = ss.filter(s => s.sp === 'r');
    w.km = r.reduce((a, s) => a + s.km, 0);
    w.hr = r.reduce((a, s) => a + s.mn, 0) / 60;
    w.hm = ss.filter(s => s.sp !== 'r').reduce((a, s) => a + s.mn, 0) / 60;
    w.nr = r.length; w.nm = ss.length - r.length;
    w.zk = [0, 1, 2, 3, 4].map(k => r.reduce((a, s) => a + s.zk[k], 0));
    w.zm = [0, 1, 2, 3, 4].map(k => Math.round(r.reduce((a, s) => a + s.zm[k], 0)));
    w.sl = Math.max(0, ...r.filter(s => /^long/.test(s.ty)).map(s => s.km));
    w.passee = w.we < T; w.encours = w.ws <= T && T <= w.we;
  });

  // réel : semaines passées de weekly (km réels) ; celles d'avant le plan affiché sont tracées en gris
  const reel = (snap.weekly || []).filter(x => !x.future).map(x => ({ ws: lundi(x.week_start), km: x.km || 0, hm: x.strength_hours || 0, sl: x.long_run_km || 0, zmin: x.zone_minutes || {} }));
  const reelPar = new Map(reel.map(x => [x.ws, x]));
  W.forEach(w => { const x = reelPar.get(w.ws); if (x && w.passee) w.reel = x; });
  const avant = W.length ? reel.filter(x => x.ws < W[0].ws).sort((a, b) => (a.ws < b.ws ? -1 : 1)) : reel;

  const tref = Math.max(1, ...S.filter(s => s.sp === 'r').map(s => s.p.reduce((a, x) => a + x[0], 0)));
  return { S, H, W, avant, T, tref, plan, snap, conflitsLocaux, today: snap.today || null, wellness: snap.wellness || [], sources: snap.sources || {} };
}

const TYPES = { running: 'Course', strength: 'Muscu', cycling: 'Vélo', walking: 'Marche', hiking: 'Rando', swimming: 'Natation', cardio: 'Cardio' };
function horsPlan(a) {
  const run = a.type === 'running';
  return {
    id: a.id, d: a.date, start: a.start, sp: run ? 'r' : a.type === 'strength' ? 'm' : 'x', type: a.type,
    t: a.display_name || TYPES[a.type] || 'Activité', km: (a.distance_m || 0) / 1000, mn: (a.duration_s || 0) / 60,
    pace: a.pace_s_km || null, hr: a.avg_hr || null, raw: a,
  };
}

// ---------- prévu vs réalisé : chiffres clés ----------
// Lignes [libellé, prévu, réalisé, écart] ; seulement les grandeurs connues d'un côté au moins.
export function versus(s) {
  const r = s.real; if (!r) return null;
  const km = (r.distance_m || 0) / 1000, mn = (r.duration_s || 0) / 60;
  const ecartPc = (a, b) => (a && b ? Math.round((b / a - 1) * 100) : null);
  const rows = [];
  if (s.sp === 'r' || km >= 0.5) rows.push(['Distance', s.km ? f1(s.km) + ' km' : '—', km ? f1(km) + ' km' : '—', ecartPc(s.km, km)]);
  if (s.sp === 'm' && !mn && r.exercises) rows.push(['Exercices', '—', String(r.exercises), null]);
  else rows.push(['Durée', s.mn ? Math.round(s.mn) + ' min' : '—', mn ? Math.round(mn) + ' min' : '—', ecartPc(s.mn, mn)]);
  const rp = s.sp === 'r' ? allureReps(s) : null;
  if (rp) rows.push(['Allure des répétitions', 'cible ' + pc(rp.lo) + '-' + pc(rp.hi), pc(rp.p) + ' /km', null, rp.st]);
  else if (s.sp === 'r') {
    const pp = s.km && s.mn ? s.mn * 60 / s.km : null;
    rows.push(['Allure', pp ? pc(pp) + ' /km' : '—', r.pace_s_km ? pc(r.pace_s_km) + ' /km' : '—', null]);
  }
  if (r.avg_hr) rows.push(['FC moyenne', '—', r.avg_hr + ' bpm', null]);
  return { rows, km, mn, n: (r.activity_ids || []).length };
}
// Fractionné analysé (D69) : allure moyenne des répétitions faites face à la cible, au lieu de la moyenne globale
// (échauffement et récupérations compris) qui ne dit rien de la séance.
export function allureReps(s) {
  const an = s.an; if (!an || an.mode !== 'intervals') return null;
  const R = (an.reps || []).filter(x => x.done && x.pace_s_km);
  const lo = Math.min(...R.filter(x => x.pace_lo != null).map(x => x.pace_lo)), hi = Math.max(...R.filter(x => x.pace_hi != null).map(x => x.pace_hi));
  if (!R.length || !isFinite(lo) || !isFinite(hi)) return null;
  const d = R.reduce((a, x) => a + (x.distance_m || 0), 0), t = R.reduce((a, x) => a + (x.duration_s || 0), 0);
  const p = d > 0 && t > 0 ? t / d * 1000 : R.reduce((a, x) => a + x.pace_s_km, 0) / R.length;
  const tol = R[0].tol_s || 0;
  return { p, lo, hi, n: R.length, st: p < lo - tol ? 'fast' : p > hi + tol ? 'slow' : 'in' };
}
// Résumé d'une ligne : « 8,5 → 12,9 km » (course) ou « 45 → 34 min ».
export function versusCourt(s) {
  const v = versus(s); if (!v) return '';
  if (s.sp === 'r' && v.km) return (s.km ? f1(s.km) + ' → ' : '') + f1(v.km) + ' km';
  return (s.mn ? Math.round(s.mn) + ' → ' : '') + Math.round(v.mn) + ' min';
}

export function semaineCourante(M) {
  const k = M.W.findIndex(w => w.we >= M.T);
  return k < 0 ? Math.max(0, M.W.length - 1) : k;
}

// ---------- prévu vs réalisé ----------
// Les tours (laps) sont comparés aux étapes prévues dépliées, dans l'ordre, quand leur nombre correspond ;
// sinon chaque tour est affiché seul, avec le niveau de son allure.
export function prevuRealise(s) {
  const a = s.act; if (!a) return null;
  const laps = (a.laps || []).slice().sort((x, y) => (x.index || 0) - (y.index || 0));
  const prev = [];
  const deplie = (xs) => xs.forEach(x => x.kind === 'repeat' ? Array.from({ length: x.count || 1 }, (_, k) => deplie(x.steps.map(y => ({ ...y, rep: k + 1 })))) : prev.push(x));
  deplie(s.x || []);
  const aligne = laps.length && laps.length === prev.length;
  const rows = [];
  let nIn = 0, nCible = 0;
  laps.forEach((l, k) => {
    const e = aligne ? prev[k] : null;
    const t = e && e.target && e.target.type === 'pace' ? e.target : null;
    let st = '', dl = 0;
    if (t && l.pace_s_km && e.kind === 'active') {
      nCible++;
      if (l.pace_s_km < t.min_s_per_km - 2) { st = 'fast'; dl = Math.round(l.pace_s_km - t.min_s_per_km); }
      else if (l.pace_s_km > t.max_s_per_km + 2) { st = 'slow'; dl = Math.round(l.pace_s_km - t.max_s_per_km); }
      else { st = 'in'; nIn++; }
    }
    rows.push({
      lab: e ? (e.label || LIB[e.kind] || '') + (e.rep ? ' ' + e.rep : '') : 'Tour ' + (l.index || k + 1),
      q: e ? qty(e) : '', tgt: t ? ptx(t) : '', p: l.pace_s_km ? pc(l.pace_s_km) : '',
      rq: l.distance_m ? (l.distance_m >= 1000 ? f1(l.distance_m / 1000) + ' km' : Math.round(l.distance_m) + ' m') : dur({ type: 'time', seconds: l.duration_s || 0 }),
      st, dl, hr: l.avg_hr || null, hp: e && e.kind !== 'active',
    });
  });
  const rp = laps.map(l => [l.duration_s || 0, l.pace_s_km ? lvAllure(l.pace_s_km) : 1]);
  const r = s.real || a;
  const realKm = (r.distance_m || 0) / 1000;
  const vol = s.km ? Math.round(realKm / s.km * 100) : null;
  return { rows, rp, realKm, vol, nIn, nCible, sec: r.duration_s || 0, aligne };
}

// 0 à 3 lignes : volume, allures, régularité. Rien si la séance est conforme.
export function evaluation(s, pr) {
  if (!pr) return [];
  const e = [];
  if (pr.vol != null && (pr.vol < 85 || pr.vol > 115)) e.push(`Volume ${pr.vol} % du prévu (${f1(pr.realKm)} / ${f1(s.km)} km)`);
  if (pr.nCible) {
    const fast = pr.rows.filter(r => r.st === 'fast').length, slow = pr.rows.filter(r => r.st === 'slow').length;
    if (pr.nIn < pr.nCible) e.push(`${pr.nIn}/${pr.nCible} répétitions dans la cible` + (fast ? ` · ${fast} trop vite` : '') + (slow ? ` · ${slow} trop lente${slow > 1 ? 's' : ''}` : ''));
    const r = pr.rows.filter(x => x.st);
    if (r.length >= 3 && r[0].st === 'fast' && r[r.length - 1].st === 'slow') e.push('Départ trop rapide, fin en dessous de la cible');
  }
  return e.slice(0, 3);
}

// ---------- planning (D70) : semaine par semaine, tous les jours, état et écart de chaque séance ----------
// État d'une séance prévue : faite, manquée (passée sans activité, ou sautée), du jour, à venir.
export function etat(s, T) {
  if (s.done) return 'fait';
  if (s.status === 'skipped' || s.d < T) return 'manque';
  return s.d === T ? 'jour' : 'avenir';
}
// Écart du réalisé au prévu en % : km pour la course, minutes sinon ; null si l'un des deux manque.
export function ecartPrevu(s) {
  const r = s.real; if (!r) return null;
  const a = s.sp === 'r' ? s.km : s.mn, b = s.sp === 'r' ? (r.distance_m || 0) / 1000 : (r.duration_s || 0) / 60;
  return a && b ? Math.round((b / a - 1) * 100) : null;
}
// Écart affiché : masqué sous 5 % (bruit de mesure), sinon la valeur.
export const ecartAffiche = e => (e == null || Math.abs(e) < 5 ? null : e);
// La durée est déjà dans le titre (« Footing 36 min… ») : ne pas la répéter dans la ligne de chiffres.
export const dureeDansTitre = s => /\d\s*(min|h)\b/i.test(s.t || '');
// Ligne courte d'une séance : « 9,8 → 12,9 km » (faite, écart visible), « 9,9 km » (faite, écart masqué sous 5 % :
// le réalisé seul, le ✓ dit le reste), « 9,8 km · 49 min » (prévue, km seuls si la durée est dans le titre), muscu en
// minutes ; muscu saisie sans activité : « 5 exercices ».
export function chiffresSeance(s) {
  const r = s.done ? s.real : null;
  const avant = ecartAffiche(ecartPrevu(s)) != null;
  if (s.sp === 'r') {
    if (r && r.distance_m) return (s.km && avant ? f1(s.km) + ' → ' : '') + f1(r.distance_m / 1000) + ' km';
    return [s.km ? f1(s.km) + ' km' : '', s.mn && !dureeDansTitre(s) ? Math.round(s.mn) + ' min' : ''].filter(Boolean).join(' · ');
  }
  if (r && r.duration_s) return (s.mn && avant ? Math.round(s.mn) + ' → ' : '') + Math.round(r.duration_s / 60) + ' min';
  if (r && r.exercises) return r.exercises + ' exercice' + (r.exercises > 1 ? 's' : '');
  return s.mn ? Math.round(s.mn) + ' min' : '';
}
// Allure cible principale d'une course : celle de l'effort qui dure le plus (« 5:20-5:45 /km »), '' sinon.
export function allureCible(s) {
  if (s.sp !== 'r') return '';
  let best = null, bt = 0;
  each(s.x || [], (x, m) => {
    if (x.kind !== 'active' || !x.target || x.target.type !== 'pace') return;
    const d = ssec(x) * m;
    if (d > bt) { bt = d; best = x.target; }
  });
  return best ? ptx(best) : '';
}
// Le profil d'intensité n'apprend rien quand la séance n'a qu'une zone.
export const profilUtile = s => new Set((s.p || []).map(x => x[1])).size > 1;
// Même typologie de muscu : même intitulé, sinon même partie du corps (« Muscu leg » ↔ « Muscu jambes »).
export const memeTypologie = (titre, s) => titre === s.t || (!!muKind(titre, '')[0] && muKind(titre, '')[0] === muKind(s.t, s.ty)[0]);

// Statut d'une action locale : pas encore partie (hors ligne) ou partie, en attente de l'accusé du PC.
export const statutEnvoi = (a, fem) => (a && a.etat === 'a_envoyer' ? `gardé${fem ? 'e' : ''} sur le téléphone, envoi au retour du réseau` : `envoyé${fem ? 'e' : ''}, en attente du PC`);
// Correction d'une saisie encore en file (pas partie) : elle remplace l'action de la même séance au lieu de s'ajouter.
// Ressenti et douleur : même séance (ou même jour pour le ressenti du jour) ; muscu : même brouillon (uid).
const cleAction = a => {
  const p = a.payload || {};
  if (a.type === 'feeling' || a.type === 'pain') return a.type + ':' + (p.session_id != null ? 's' + p.session_id : 'j' + p.date);
  if (a.type === 'strength_session') return a.type + ':' + p.uid;
  return null;
};
export function remplacerOuAjouter(actions, a) {
  const k = cleAction(a);
  const i = k ? actions.findIndex(x => x.etat === 'a_envoyer' && !x.retenu && cleAction(x) === k) : -1;
  if (i < 0) return { actions: [...actions, a], action: a };
  const b = { ...actions[i], payload: a.payload, created_at: a.created_at };
  return { actions: actions.map((x, j) => (j === i ? b : x)), action: b };
}
// Totaux d'une semaine, même règle que le PC (lib/planning.ts, weekTotals). Prévu : séances du plan (hors sautées).
// Réalisé : séances faites (activités rattachées, muscu saisie) + activités hors plan. Projeté : réalisé + prévu des
// séances restantes (aujourd'hui et à venir, ni faites ni sautées) ; une séance passée non faite compte 0.
export function totauxSemaine(S, Hw, T) {
  const somme = (xs, f) => xs.reduce((a, x) => a + (f(x) || 0), 0);
  const plan = S.filter(s => s.status !== 'skipped');
  const run = xs => xs.filter(s => s.sp === 'r'), mus = xs => xs.filter(s => s.sp !== 'r');
  const prev = xs => ({ km: somme(run(xs), s => s.km), hr: somme(run(xs), s => s.mn) / 60, hm: somme(mus(xs), s => s.mn) / 60, n: xs.length });
  const faites = plan.filter(s => s.done);
  const reel = {
    km: somme(run(faites), s => s.real && s.real.distance_m) / 1000 + somme(Hw.filter(h => h.sp === 'r'), h => h.km),
    hr: (somme(run(faites), s => s.real && s.real.duration_s) / 60 + somme(Hw.filter(h => h.sp === 'r'), h => h.mn)) / 60,
    hm: (somme(mus(faites), s => s.real && s.real.duration_s) / 60 + somme(Hw.filter(h => h.sp === 'm'), h => h.mn)) / 60,
    n: faites.length + Hw.filter(h => h.sp === 'r' || h.sp === 'm').length,
  };
  const reste = prev(plan.filter(s => !s.done && s.d >= T));
  return { prevu: prev(plan), reel, proj: { km: reel.km + reste.km, hr: reel.hr + reste.hr, hm: reel.hm + reste.hm, n: reel.n + reste.n } };
}
// Chiffres de l'en-tête de semaine, même présentation que le PC (weekLines) : passée = réalisé et prévu ; en cours =
// réalisé → projeté (prévu) ; à venir = prévu seul. `cle` : km, course, muscu, seances.
export function lignesSemaine(P) {
  const { prevu: p, reel: r, proj: j } = P, enc = P.encours;
  if (!P.passee && !enc) return [
    { cle: 'km', main: f1(p.km), tail: ' km prévus' }, { cle: 'course', main: fh(p.hr), tail: '' },
    { cle: 'muscu', main: fh(p.hm), tail: '' }, { cle: 'seances', main: String(p.n), tail: ' séances' }];
  return [
    { cle: 'km', main: f1(r.km), tail: enc ? ` → ${f1(j.km)} km (prévu ${f1(p.km)})` : ` km · prévu ${f1(p.km)}` },
    { cle: 'course', main: fh(r.hr), tail: enc ? ` → ${fh(j.hr)}` : ` / ${fh(p.hr)}` },
    { cle: 'muscu', main: fh(r.hm), tail: enc ? ` → ${fh(j.hm)}` : ` / ${fh(p.hm)}` },
    { cle: 'seances', main: String(r.n), tail: ` / ${p.n}` }];
}
// Une semaine du planning : les 7 jours (vides compris) et le volume prévu / réalisé.
// Réalisé : séances faites (cumul des activités rattachées) plus activités hors plan de la semaine.
export function semainePlanning(M, n) {
  const w = M.W[n], H = M.H || [];
  const jours = [0, 1, 2, 3, 4, 5, 6].map(j => {
    const d = addD(w.ws, j);
    return { d, j, auj: d === M.T, passe: d < M.T, S: M.S.filter(s => s.d === d), H: H.filter(h => h.d === d) };
  });
  const S = M.S.filter(s => s.w === n), Hw = H.filter(h => h.w === n);
  const { prevu, reel, proj } = totauxSemaine(S, Hw, M.T);
  return { w, n, jours, prevu, reel, proj, zk: w.zk, nPrevu: S.length, nFait: S.filter(s => s.done).length, passee: w.passee, encours: w.encours };
}
// Déplacement d'une séance : seulement une séance à venir non faite, vers un autre jour à venir (vide ou non).
export const deplacable = (M, s) => !!s && !s.done && s.d >= M.T;
export function opDeplacement(M, s, d) {
  if (!deplacable(M, s) || !d || d < M.T || d === s.d) return null;
  const autres = M.S.filter(x => x.d === d && x.id !== s.id);
  return { type: 'move_session', payload: { session_id: s.id, from_date: s.d, to_date: d, position: autres.length + 1 } };
}
export function opInterversion(M, a, b) {
  if (!deplacable(M, a) || !deplacable(M, b) || a.id === b.id) return null;
  return { type: 'swap_sessions', payload: { a_id: a.id, b_id: b.id } };
}
// Annulation d'un déplacement déjà parti : le mouvement inverse (une interversion s'annule par elle-même).
export function opInverse(op) {
  if (!op) return null;
  if (op.type === 'swap_sessions') return { type: 'swap_sessions', payload: { ...op.payload } };
  const p = op.payload;
  return { type: 'move_session', payload: { session_id: p.session_id, from_date: p.to_date, to_date: p.from_date } };
}

// Garde-fous simples recalculés sur le téléphone (le PC refait les siens) : deux qualités de suite, muscu jambes la
// veille d'une séance clé. Sert à décider si un déplacement mérite une fenêtre d'aperçu.
export function alertes(M) {
  const out = [], by = {};
  M.S.forEach(s => (by[s.d] = by[s.d] || []).push(s));
  const q = s => s.sp === 'r' && (QUAL.has(s.ty) || (/^long/.test(s.ty) && s.key >= 3)), cle = s => s.sp === 'r' && (QUAL.has(s.ty) || /^long/.test(s.ty));
  Object.keys(by).sort().forEach(d => {
    if (d < M.T) return;
    const n = by[addD(d, 1)] || [];
    if (by[d].some(q) && n.some(q)) out.push(`Deux séances de qualité de suite : ${jl(d)} et ${jl(addD(d, 1))}`);
    if (by[d].some(s => s.sp === 'm' && muKind(s.t, s.ty)[0] === 'leg') && n.some(cle)) out.push(`Muscu jambes la veille d'une séance clé (${jl(addD(d, 1))})`);
  });
  return out;
}
export const nouvellesAlertes = (M0, M1) => { const a0 = alertes(M0); return alertes(M1).filter(x => !a0.includes(x)); };

// Titre court d'une séance (« Footing », « 30/30 », « Pecs ») pour un bouton.
export function titreCourt(s) {
  if (s.sp !== 'r') return s.lab || s.t;
  const m = (s.t || '').split(/\s+/), k = m.findIndex(w => /\d/.test(w));
  return k === 0 ? m[0] : k > 0 ? m.slice(0, k).join(' ') : s.t;
}
