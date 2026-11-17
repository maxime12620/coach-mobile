// Passage de l'instantané (contrat docs/mobile.md) au modèle d'affichage, et calculs repris de la maquette validée
// (profils, zones, étapes sur 3 colonnes, prévu vs réalisé).

export const ZC = ['', '#c9d6f5', '#79B63E', '#739DF1', '#F08100', '#C30A1D'];
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
export const f1 = x => String(Math.round((x || 0) * 10) / 10).replace('.', ',');
export const fh = h => { const m = Math.round((h || 0) * 60); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
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
export function muKind(t, ty) {
  const s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/hyrox/.test(s)) return ['hyrox', 'Hyrox'];
  if (/\bdos\b/.test(s)) return ['dos', 'Dos'];
  if (/pec/.test(s)) return ['pecs', 'Pecs'];
  if (/epaule/.test(s)) return ['epaules', 'Épaules'];
  if (/bras|biceps|triceps/.test(s)) return ['bras', 'Bras'];
  if (/\bleg|jambe|cuisse|fessier|squat/.test(s)) return ['leg', 'Leg'];
  if (/abdo|gainage|core/.test(s)) return ['abdos', 'Abdos'];
  if (ty === 'strength_legs') return ['leg', 'Leg'];
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
  const conflitsLocaux = [];
  for (const a of pend) {
    const p = a.payload || {};
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

  // activités : rattachement aux séances
  const A = snap.activities || [];
  const parSeance = new Map(A.filter(a => a.session_id != null).map(a => [a.session_id, a]));
  const parId = new Map(A.map(a => [a.id, a]));
  S.forEach((s, i) => {
    s.i = i;
    s.act = parSeance.get(s.id) || (s.actId != null ? parId.get(s.actId) : null) || null;
    s.done = s.status === 'done' || s.status === 'partial' || s.status === 'exceeded' || s.status === 'below' || !!s.act;
    s.passe = s.d < T;
  });
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
  if (W.length) S.forEach(s => { const k = ecart(W[0].ws, s.d); s.w = Math.floor(k / 7); s.j = ((k % 7) + 7) % 7; });
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
  return { S, W, avant, T, tref, plan, snap, conflitsLocaux, today: snap.today || null, wellness: snap.wellness || [] };
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
  const realKm = (a.distance_m || 0) / 1000;
  const vol = s.km ? Math.round(realKm / s.km * 100) : null;
  return { rows, rp, realKm, vol, nIn, nCible, sec: a.duration_s || 0, aligne };
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
