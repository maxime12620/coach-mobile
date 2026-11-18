// Analyse d'une séance réalisée (D67, D69), version téléphone de la fenêtre du PC : verdict dépliable, déroulé par
// phase, répétitions (allure, ▲/▼/✓, FC), courbe d'allure simplifiée et tactile (répétitions numérotées et colorées,
// FC en dessous), tours repliables. Données : `sessions[].analysis` de l'instantané (docs/mobile.md), déjà allégées
// par le PC. Couleurs : orange = trop rapide, bleu = trop lente, vert sobre = dans la cible.
import { esc } from './plan.js';

export const pace = p => { if (p == null || !isFinite(p)) return '—'; const s = Math.round(p); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function dmin(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}
export const dround = sec => (sec == null ? '—' : sec < 60 ? `${Math.round(sec)} s` : dmin(Math.round(sec / 60) * 60));
export const km = m => (m == null ? '—' : String(Math.round(m / 100) / 10).replace('.', ','));
export const dist = m => (m == null ? '—' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${km(m)} km`);
const hr = h => (h == null ? '—' : String(Math.round(h)));
const LV = { bad: '✕', warn: '!', info: 'i', ok: '✓' };
const ST = { in: 'dans la cible', fast: 'trop rapide', slow: 'trop lente' };
const MK = { in: '✓', fast: '▲', slow: '▼' };
const PH = { warmup: 'Échauffement', core: 'Cœur de séance', cooldown: 'Retour au calme' };
const ord = k => (k === 1 ? '1re' : `${k}e`);

export function lapLabel(ph, sets) {
  ph = ph || '';
  if (ph.startsWith('rep:')) { const [, s, r] = ph.split(':'); return sets > 1 ? `Série ${s} · rép. ${r}` : `rép. ${r}`; }
  return { warmup: 'échauffement', recovery: 'récup', inter: 'récup entre séries', cooldown: 'retour au calme', core: 'cœur', main: '', extra: 'effort en plus', stub: 'fin, ignorée' }[ph] ?? '';
}

/** Points de la courbe [t, allure, FC] quel que soit le format reçu (pas régulier ou points explicites). */
export function points(c) {
  if (!c) return [];
  if (Array.isArray(c.points)) return c.points;
  const st = c.step_s || 5, p = c.pace || [], h = c.hr || [];
  return p.map((v, k) => [k * st, v, h[k] ?? null]);
}

export function repLine(x, sets) {
  const head = sets > 1 ? `Série ${x.set} · rép. ${x.rep}` : `Rép. ${x.rep}`;
  if (!x.done) return `${head} : non trouvée`;
  const tgt = x.pace_lo != null ? ` (cible ${pace(x.pace_lo)}–${pace(x.pace_hi)}${x.tol_s ? `, ± ${x.tol_s} s` : ''})` : '';
  return `${head} : ${dmin(x.duration_s)} · ${dist(x.distance_m)} · ${pace(x.pace_s_km)}/km${tgt}${x.status ? ' · ' + ST[x.status] : ''} · FC ${hr(x.avg_hr)} (max ${hr(x.max_hr)})`;
}

let A = null, zoom = false;

export function vAnalyse(an) {
  if (!an || !an.available) return '';
  A = an;
  const core = (an.curve && an.curve.phases || []).find(x => x.code === 'core' && x.t0 != null);
  zoom = an.mode === 'intervals' && !!core;
  const reps = an.reps || [], sets = an.sets || [], p = an.planned || {};
  const li = f => `<li><span class="an-lv lv-${f.level}" aria-hidden="true">${LV[f.level] || ''}</span><span>${esc(f.text)}</span></li>`;
  let h = '<div class="an">';
  h += `<div class="cf"><div><b>${km(an.total && an.total.distance_m)} km</b>${p.distance_m ? 'prévu ' + km(p.distance_m) : 'réalisés'}</div><div><b>${dround(an.total && an.total.duration_s)}</b>${p.duration_s ? 'prévu ' + dround(p.duration_s) : 'durée'}</div><div><b>${hr(an.total && an.total.avg_hr)}</b>FC moy.</div>` +
    (an.mode === 'intervals' ? `<div><b>${reps.filter(x => x.status === 'in').length}/${reps.length}</b>dans la cible</div>` : '') + '</div>';
  h += `<div class="an-vd ${an.state}"><div class="an-et">${esc(an.label)}</div><ul>${an.highlights.length ? an.highlights.map(li).join('') : '<li>Rien à signaler.</li>'}</ul>` +
    (an.checks.length > an.highlights.length ? `<details><summary>Tous les constats (${an.checks.length})</summary><ul>${an.checks.map(li).join('')}</ul></details>` : '') + '</div>';
  const ph = an.phases || [], tot = ph.reduce((a, x) => a + (x.duration_s || 0), 0) || 1;
  if (ph.length > 1) {
    h += '<div class="an-ph">' + ph.map((x, k) => `<button type="button" data-act="an-ph" data-k="${k}" style="flex:${Math.max(0.22, (x.duration_s || 0) / tot)}"><b>${esc(x.code === 'main' ? x.label : PH[x.code] || x.label)}</b><span>${dround(x.duration_s)}</span><span>${pace(x.pace_s_km)}/km · FC ${hr(x.avg_hr)}</span></button>`).join('') + '</div><div class="an-det" id="an-phd"></div>';
  }
  if (an.mode === 'intervals') {
    for (const sm of sets) {
      const rs = reps.map((x, i) => [x, i]).filter(([x]) => x.set === sm.set);
      h += `<div class="an-set"><b>${sets.length > 1 ? 'Série ' + sm.set : 'Répétitions'} · ${sm.done}/${sm.planned} × ${esc(rs[0] ? rs[0][0].planned || '' : '')}</b>` +
        `<div class="m">moyenne ${pace(sm.mean_pace)}/km (cible ${pace(sm.pace_lo)}–${pace(sm.pace_hi)}) · ${sm.n_in} dans la cible${sm.n_fast ? `, <span class="an-c fast">${sm.n_fast} ▲</span>` : ''}${sm.n_slow ? `, <span class="an-c slow">${sm.n_slow} ▼</span>` : ''}${sm.drift_s != null ? ` · dérive ${sm.drift_s > 0 ? '+' : ''}${sm.drift_s} s/km` : ''} · FC ${hr(sm.avg_hr)}</div>` +
        '<div class="an-chips">' + rs.map(([x, i]) => x.done
          ? `<button type="button" class="an-chip ${x.status || ''}" data-act="an-rep" data-k="${i}"><i>${x.rep}</i><b>${pace(x.pace_s_km)}</b><span>${x.status ? MK[x.status] : ''}</span><i>${hr(x.avg_hr)}</i></button>`
          : `<button type="button" class="an-chip miss" data-act="an-rep" data-k="${i}"><i>${x.rep}</i>—</button>`).join('') + `</div><div class="an-det" id="an-rd-${sm.set}"></div></div>`;
    }
    const intra = (an.recoveries || []).filter(x => !x.between_sets && x.duration_s);
    if (intra.length) {
      const m = k => intra.reduce((a, x) => a + (x[k] || 0), 0) / intra.length;
      h += `<div class="m">Récupérations : ${intra.length} × ${dmin(m('duration_s'))}${intra[0].planned_s ? ` (prévu ${dmin(intra[0].planned_s)})` : ''}, ${pace(m('pace_s_km'))}/km, FC ${hr(m('avg_hr'))}</div>`;
    }
  } else if (an.main && an.main.pace_s_km) {
    const m = an.main;
    h += `<div class="m">Allure ${pace(m.pace_s_km)}/km${m.pace_lo != null ? ` (cible ${pace(m.pace_lo)}–${pace(m.pace_hi)})` : ''}${m.status ? ` · <span class="an-c ${m.status}">${ST[m.status]}</span>` : ''} · FC ${hr(m.avg_hr)} (max ${hr(m.max_hr)})</div>`;
  }
  if (points(an.curve).length) {
    h += `<div class="an-hd"><b>Allure et FC</b>${core ? `<span class="seg"><button type="button" data-act="an-zoom" data-z="0" class="${zoom ? '' : 'on'}">Séance</button><button type="button" data-act="an-zoom" data-z="1" class="${zoom ? 'on' : ''}">Cœur</button></span>` : ''}</div>` +
      `<div class="an-cv" id="an-cv">${courbe(an, zoom)}</div><div class="an-lu" id="an-lu">Toucher la courbe pour lire l’allure et la FC.</div>` +
      `<div class="an-leg"><span><i class="in"></i>dans la cible</span><span><i class="fast"></i>trop rapide</span><span><i class="slow"></i>trop lente</span><span><i class="hr"></i>FC</span></div>`;
  }
  const laps = an.laps || [];
  if (laps.length) {
    const multi = (an.activities || []).length > 1, ns = sets.length || 1;
    h += `<details class="an-laps"><summary>Tours enregistrés (${laps.length})</summary><div class="tbw"><table class="tb"><tr><th>n°</th>${multi ? '<th>Act.</th>' : ''}<th>Phase</th><th>Temps</th><th>Dist.</th><th>Allure</th><th>FC</th></tr>` +
      laps.map((l, k) => `<tr class="${l.phase === 'stub' ? 'an-stub' : ''}"><td>${k + 1}</td>${multi ? `<td>${ord(l.act)}</td>` : ''}<td>${esc(lapLabel(l.phase, ns))}</td><td>${dmin(l.duration_s)}</td><td>${dist(l.distance_m)}</td><td>${l.pace_s_km ? pace(l.pace_s_km) : '—'}</td><td>${hr(l.avg_hr)}</td></tr>`).join('') +
      '</table></div></details>';
  }
  return h + '</div>';
}

const W = 340, L = 30, R = 4, TOP = 32, H1 = 130, GAP = 20, H2 = 44, AX = 14;
let G = null;

export function courbe(an, z) {
  const c = an.curve, pts = points(c);
  const T = c.total_s || (pts.length ? pts[pts.length - 1][0] : 1);
  const core = (c.phases || []).find(x => x.code === 'core' && x.t0 != null);
  const x0 = z && core ? Math.max(0, core.t0 - 30) : 0, x1 = z && core ? Math.min(T, core.t1 + 30) : T;
  const vis = pts.filter(p => p[0] >= x0 && p[0] <= x1);
  const ps = vis.map(p => p[1]).filter(v => v != null).sort((a, b) => a - b);
  const bl = (c.bands || []).filter(b => b.t1 >= x0 && b.t0 <= x1).flatMap(b => [b.lo, b.hi]);
  const pmin = Math.min(ps.length ? ps[Math.floor(ps.length * 0.01)] : 300, ...bl) - 8;
  const pmax = Math.min(Math.max(ps.length ? ps[Math.floor(ps.length * 0.97)] : 360, ...bl) + 12, 600);
  const hs = vis.map(p => p[2]).filter(Boolean);
  const hlo = hs.length ? Math.floor((Math.min(...hs) - 3) / 10) * 10 : 100, hhi = hs.length ? Math.ceil((Math.max(...hs) + 3) / 10) * 10 : 190;
  const X = t => L + (t - x0) / (x1 - x0 || 1) * (W - L - R);
  const Y = p => TOP + (Math.min(pmax, Math.max(pmin, p)) - pmin) / (pmax - pmin) * H1;
  const HT = TOP + H1 + GAP, Yh = v => HT + (1 - (v - hlo) / (hhi - hlo || 1)) * H2;
  G = { vis, X, x0, x1, HT };
  const path = (f, yf) => { let d = '', pen = false; for (const p of vis) { const v = f(p); if (v == null) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${X(p[0]).toFixed(1)},${yf(v).toFixed(1)}`; pen = true; } return d; };
  let s = `<svg viewBox="0 0 ${W} ${HT + H2 + AX}" role="img" aria-label="Courbe d’allure et de FC">`;
  s += `<text class="t" x="${L}" y="9">Allure (min:s/km) · plus haut = plus rapide</text>`;
  const step = pmax - pmin > 150 ? 60 : pmax - pmin > 60 ? 30 : 15;
  for (let q = Math.ceil(pmin / step) * step; q <= pmax; q += step) s += `<line class="gr" x1="${L}" x2="${W - R}" y1="${Y(q)}" y2="${Y(q)}"/><text x="${L - 3}" y="${Y(q) + 3}" text-anchor="end">${pace(q)}</text>`;
  for (const b of (c.bands || []).filter(b => b.kind !== 'rep' && b.t1 >= x0 && b.t0 <= x1)) s += `<rect class="be" x="${X(Math.max(x0, b.t0))}" y="${Y(b.lo)}" width="${Math.max(1, X(Math.min(x1, b.t1)) - X(Math.max(x0, b.t0)))}" height="${Math.max(2, Y(b.hi) - Y(b.lo))}"/>`;
  const reps = (an.reps || []).filter(x => x.done && x.t0 != null && x.t1 >= x0 && x.t0 <= x1);
  const cs = reps.map(x => (X(x.t0) + X(x.t1)) / 2), pitch = cs.length > 1 ? Math.min(...cs.slice(1).map((v, k) => v - cs[k])) : 99;
  for (const x of reps) s += `<rect class="col ${x.status || ''}" x="${X(x.t0)}" y="${TOP}" width="${Math.max(1.5, X(x.t1) - X(x.t0))}" height="${H1}"/>`;
  for (const [k, a] of (c.starts || []).entries()) if (k > 0 && a >= x0 && a <= x1) s += `<line class="ac" x1="${X(a)}" x2="${X(a)}" y1="${TOP}" y2="${HT + H2}"/><text x="${X(a) + 3}" y="${TOP + H1 - 4}">${ord(k + 1)} activité</text>`;
  s += `<path class="ln" d="${path(p => p[1], Y)}"/>`;
  for (const x of reps) s += `<path class="rl ${x.status || ''}" d="${path(p => (p[0] >= x.t0 - 2 && p[0] <= x.t1 + 2 ? p[1] : null), Y)}"/>`;
  for (const [k, x] of reps.entries()) s += pitch >= 11
    ? `<g class="pl ${x.status || ''}"><rect x="${cs[k] - 5.5}" y="${TOP - 13}" width="11" height="11" rx="2"/><text x="${cs[k]}" y="${TOP - 4.5}" text-anchor="middle">${x.rep}</text></g>`
    : `<g class="pl ${x.status || ''}"><rect x="${cs[k] - 2}" y="${TOP - 11}" width="4" height="8" rx="1"/></g>`;
  s += `<text class="t" x="${L}" y="${HT - 6}">FC (bpm)</text><line class="gr" x1="${L}" x2="${W - R}" y1="${Yh(hhi)}" y2="${Yh(hhi)}"/><line class="gr" x1="${L}" x2="${W - R}" y1="${Yh(hlo)}" y2="${Yh(hlo)}"/>` +
    `<text x="${L - 3}" y="${Yh(hhi) + 3}" text-anchor="end">${hhi}</text><text x="${L - 3}" y="${Yh(hlo) + 3}" text-anchor="end">${hlo}</text><path class="hr" d="${path(p => p[2], Yh)}"/>`;
  const span = x1 - x0, ts = span > 4800 ? 1200 : span > 2400 ? 600 : span > 1200 ? 300 : 120;
  for (let t = Math.ceil(x0 / ts) * ts; t <= x1; t += ts) s += `<text x="${X(t)}" y="${HT + H2 + AX - 2}" text-anchor="middle">${Math.round(t / 60)} min</text>`;
  s += `<line id="an-x" class="cx" x1="0" x2="0" y1="${TOP}" y2="${HT + H2}" visibility="hidden"/></svg>`;
  return s;
}

/** Lecture tactile : la position touchée donne le temps, l'allure, la FC et la répétition en cours. */
export function lire(svg, clientX) {
  if (!G || !A || !G.vis.length) return;
  const bb = svg.getBoundingClientRect(), vx = (clientX - bb.left) / bb.width * W;
  const t = G.x0 + (vx - L) / (W - L - R) * (G.x1 - G.x0);
  let k = 0; for (let i = 0; i < G.vis.length; i++) if (Math.abs(G.vis[i][0] - t) < Math.abs(G.vis[k][0] - t)) k = i;
  const p = G.vis[k], x = svg.querySelector('#an-x');
  x.setAttribute('x1', G.X(p[0])); x.setAttribute('x2', G.X(p[0])); x.setAttribute('visibility', 'visible');
  const ns = (A.sets || []).length;
  const r = (A.reps || []).find(y => y.t0 != null && p[0] >= y.t0 && p[0] <= y.t1);
  const lu = document.getElementById('an-lu');
  if (lu) lu.innerHTML = `<b>${dmin(p[0])}</b> · ${p[1] ? pace(p[1]) + '/km' : 'arrêt ou marche'} · FC ${hr(p[2])}` + (r ? ` · <span class="an-c ${r.status || ''}">${ns > 1 ? `Série ${r.set} · ` : ''}rép. ${r.rep} : ${pace(r.pace_s_km)}/km${r.status ? ' ' + MK[r.status] : ''}</span>` : '');
}

/** Actions `an-*` de la fenêtre de détail (mises à jour en place, sans re-rendu). */
export function agirAnalyse(a, t) {
  if (!A) return;
  if (a === 'an-zoom') {
    zoom = t.dataset.z === '1';
    t.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t));
    const cv = document.getElementById('an-cv'); if (cv) cv.innerHTML = courbe(A, zoom);
    const lu = document.getElementById('an-lu'); if (lu) lu.textContent = 'Toucher la courbe pour lire l’allure et la FC.';
  } else if (a === 'an-rep') {
    const x = A.reps[+t.dataset.k]; if (!x) return;
    document.querySelectorAll('.an-chip').forEach(b => b.classList.toggle('on', b === t));
    const d = document.getElementById('an-rd-' + x.set); if (d) d.textContent = repLine(x, (A.sets || []).length);
  } else if (a === 'an-ph') {
    const x = A.phases[+t.dataset.k]; if (!x) return;
    document.querySelectorAll('.an-ph button').forEach(b => b.classList.toggle('on', b === t));
    const d = document.getElementById('an-phd');
    if (d) d.textContent = `${x.label} : prévu ${x.planned_s ? dround(x.planned_s) : '—'}${x.pace_lo != null ? ` à ${pace(x.pace_lo)}–${pace(x.pace_hi)}/km` : ''} · réalisé ${dmin(x.duration_s)}, ${km(x.distance_m)} km, ${pace(x.pace_s_km)}/km, FC ${hr(x.avg_hr)} (max ${hr(x.max_hr)})`;
  }
}
