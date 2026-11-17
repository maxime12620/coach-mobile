// Rendu HTML des vues, repris de la maquette plan-integre (version téléphone d'abord).
import { ZC, ZN, JC, JL, esc, fk, f1, fh, dd, addD, jour, ecart, muKind, prevuRealise, evaluation, pc, semaineCourante, versus, versusCourt } from './plan.js';

const MU = 'var(--mu)', GB = 'var(--gb)';
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
const OK = s => s.done ? '<span class="ok" title="Faite">✓</span>' : '';
// Sous-titre d'une séance : réalisé face au prévu quand elle est faite, estimation sinon.
const SOUS = s => s.done && s.real ? `<span class="vs">${esc(versusCourt(s))}</span>` : esc(s.est);
const HP = '<span class="hp" title="Hors plan">hors plan</span>';
const actCourt = h => h.sp === 'r' && h.km >= 0.5 ? `${f1(h.km)} km · ${Math.round(h.mn)} min` : h.km >= 1 ? `${f1(h.km)} km` : `${Math.round(h.mn)} min`;
const ATT = s => s.attente ? '<span class="att" title="En attente du PC"></span>' : '';
const AV = s => s.av ? '<span class="av" title="Avant la course">1<sup>re</sup></span>' : '';

export function leg(extra) { return '<div class="zl">' + [1, 2, 3, 4, 5].map(l => `<span><i style="background:${ZC[l]}"></i>${ZN[l]}</span>`).join('') + (extra || '') + '</div>'; }
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
function tot(w) {
  return `<span class="tot"><span title="Km de course">${ICO.route}<b>${fk(w.km)}</b> km</span><span title="${w.nr} sorties">${ICO.run}<b>${fh(w.hr)}</b></span><span title="${w.nm} séances de muscu">${ICO.mus}<b>${fh(w.hm)}</b></span></span>`;
}

// ---------- rangées alignées : dans une semaine, autant de cases course puis muscu chaque jour ----------
function slots(M, n) {
  const a = M.S.filter(s => s.w === n), hh = (M.H || []).filter(x => x.w === n); let r = 0, m = 0, x = 0;
  for (let j = 0; j < 7; j++) {
    const d = a.filter(s => s.j === j);
    r = Math.max(r, d.filter(s => s.sp === 'r').length); m = Math.max(m, d.filter(s => s.sp !== 'r').length);
    x = Math.max(x, hh.filter(y => y.j === j).length);
  }
  return [r, m, x];
}
function dayCell(M, n, j, h) {
  const ss = M.S.filter(s => s.w === n && s.j === j), [nr, nm, nx] = slots(M, n), Rr = ss.filter(s => s.sp === 'r'), Mm = ss.filter(s => s.sp !== 'r');
  const Hh = (M.H || []).filter(x => x.w === n && x.j === j);
  let o = '';
  for (let k = 0; k < nr; k++) {
    const s = Rr[k];
    o += s ? `<button class="dr" style="height:${h + 38}px" data-i="${s.i}" title="${esc(s.t)}">${OK(s)}${ATT(s)}${mini(s.p, M.tref, h)}<span class="t">${esc(s.t)}</span><span class="k">${s.done && s.real ? SOUS(s) : `${f1(s.km)} km · ${Math.round(s.mn)} min`}</span></button>` : `<span class="vide" style="height:${h + 38}px"></span>`;
  }
  for (let k = 0; k < nm; k++) {
    const s = Mm[k];
    o += s ? `<button class="dm" data-i="${s.i}" title="${esc(s.t)}">${OK(s)}${ATT(s)}${AV(s)}${muTag(s)}<span class="k">${s.done && s.real ? SOUS(s) : Math.round(s.mn) + ' min'}</span></button>` : '<span class="vide" style="height:38px"></span>';
  }
  for (let k = 0; k < nx; k++) {
    const x = Hh[k];
    o += x ? `<button class="dh" data-h="${x.k}" title="${esc(x.t)} · hors plan"><span class="t">${esc(x.t)}</span><span class="k">${actCourt(x)}</span></button>` : '<span class="vide" style="height:34px"></span>';
  }
  return o;
}

// ---------- graphique : volume décomposé par zone, km toujours écrits ----------
export function vVolume(M, selW, etroit) {
  const P = M.avant, W = M.W, N = P.length + W.length;
  if (!N) return '';
  const bw = etroit ? 34 : 46, L = 30, T = 24, H = etroit ? 140 : 190;
  const kmW = w => w.reel ? w.reel.km : w.km;
  const maxKm = Math.max(10, ...W.map(kmW), ...P.map(p => p.km));
  const top = Math.ceil(maxKm / 20) * 20, y = k => T + H - k / top * H, y0 = T + H;
  const mh = Math.max(0.1, ...W.map(w => w.hm), ...P.map(p => p.hm)), my = y0 + 40, mH = 28;
  const Wd = L + N * bw + 8, Ht = my + mH + 18;
  const pad = etroit ? 6 : 9;
  let g = '', hit = '';
  for (let k = 20; k <= top; k += 20) g += `<line x1="${L}" x2="${Wd - 6}" y1="${y(k)}" y2="${y(k)}" class="gr"/><text x="${L - 5}" y="${y(k) + 4}" text-anchor="end">${k}</text>`;
  const xs = L + P.length * bw;
  if (selW != null) g += `<rect x="${xs + selW * bw + 1}" y="16" width="${bw - 2}" height="${my + mH - 14}" style="fill:var(--sel)" rx="4"/>`;
  const barreReelle = (x, km, hm, lab) => {
    g += `<rect x="${x + pad}" y="${y(km)}" width="${bw - 2 * pad}" height="${y0 - y(km)}" style="fill:var(--reel)"/><text x="${x + bw / 2}" y="${y(km) - 4}" text-anchor="middle" class="b">${fk(km)}</text><text x="${x + bw / 2}" y="${y0 + 14}" text-anchor="middle">${lab}</text>`;
    if (hm) g += `<rect x="${x + pad}" y="${my}" width="${bw - 2 * pad}" height="${hm / mh * mH}" style="fill:${MU}" opacity=".35"/>`;
  };
  P.forEach((p, k) => barreReelle(L + k * bw, p.km, p.hm, dd(p.ws)));
  W.forEach((w, n) => {
    const x = xs + n * bw;
    if (w.reel) barreReelle(x, w.reel.km, w.reel.hm || w.hm, 'S' + w.n);
    else {
      let b = 0;
      w.zk.forEach((k, z) => { if (!k) return; g += `<rect x="${x + pad}" y="${y(b + k).toFixed(1)}" width="${bw - 2 * pad}" height="${(k / top * H).toFixed(1)}" style="fill:${ZC[z + 1]}"/>`; b += k; });
      g += `<text x="${x + bw / 2}" y="${y(w.km) - 4}" text-anchor="middle" class="b">${fk(w.km)}</text><text x="${x + bw / 2}" y="${y0 + 14}" text-anchor="middle"${n === selW ? ' class="b"' : ''}>S${w.n}</text>`;
      if (w.hm) g += `<rect x="${x + pad}" y="${my}" width="${bw - 2 * pad}" height="${w.hm / mh * mH}" style="fill:${MU}"/>`;
    }
    if (w.sl) g += `<text x="${x + bw / 2}" y="${y0 + 28}" text-anchor="middle" class="sl">${fk(w.sl)}</text>`;
    hit += `<rect data-w="${n}" x="${x}" y="0" width="${bw}" height="${Ht}" fill="transparent"><title>Semaine ${w.n}</title></rect>`;
  });
  const T0 = W.findIndex(w => !w.passee);
  if (T0 > 0) g += `<line x1="${xs + T0 * bw}" x2="${xs + T0 * bw}" y1="6" y2="${my + mH + 4}" style="stroke:var(--trait)" stroke-dasharray="3 3"/>`;
  else if (P.length) g += `<line x1="${xs}" x2="${xs}" y1="6" y2="${my + mH + 4}" style="stroke:var(--trait)" stroke-dasharray="3 3"/>`;
  g += `<text x="${L - 5}" y="${y0 + 28}" text-anchor="end" class="sl">SL</text><text x="${L - 5}" y="${my + 12}" text-anchor="end">h</text>`;
  return `<div class="vol">${leg(`<span><i style="background:var(--reel)"></i>réel</span><span><i style="background:${MU}"></i>muscu</span>`)}<div class="sc" id="sc-vol"><svg width="${Wd}" height="${Ht}" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="Volume par semaine">${g}${hit}</svg></div></div>`;
}

// ---------- 1. à venir ----------
export function vFil(M, selW) {
  const up = M.S.filter(s => s.d >= M.T), L = up.length ? up : M.S;
  if (!L.length) return '<p class="m">Aucune séance dans l’instantané.</p>';
  const nx = L.find(s => s.sp === 'r' && !s.done) || L.find(s => !s.done) || L[0];
  const rel = d => { const k = ecart(M.T, d); return k === 0 ? 'aujourd’hui' : k === 1 ? 'demain' : JL[jour(d).getDay()] + ' ' + dd(d); };
  const recents = M.S.filter(s => s.done && s.real && s.d <= M.T && ecart(s.d, M.T) <= 2), der = recents.filter(s => s.sp === 'r').pop() || recents.pop();
  let h = '<div class="fil">' + (der ? `<button class="der" data-i="${der.i}"><span class="m">${ecart(der.d, M.T) === 0 ? 'Aujourd’hui' : ecart(der.d, M.T) === 1 ? 'Hier' : jl2(der.d)}</span><b>${esc(der.t)}</b>${SOUS(der)}</button>` : '') +
    `<button class="nx" data-i="${nx.i}">${ATT(nx)}<div class="m">Prochaine sortie · ${rel(nx.d)}</div><h2>${esc(nx.t)}</h2>` +
    `<div class="chf">${nx.km ? `<div><b>${f1(nx.km)}</b> <span>km</span></div>` : ''}<div><b>${Math.round(nx.mn)}</b> <span>min</span></div></div>${prof(nx.p)}</button>`;
  let cw = -1, cd = '';
  for (const s of L) {
    if (s.w !== cw) {
      h += cd ? '</div></div>' : ''; cw = s.w; cd = '';
      const w = M.W[cw];
      h += `<div class="fw${cw === selW ? ' sw' : ''}" id="v-w${cw}"><h2>S${w.n}${w.rec ? '<small>allégée</small>' : ''}</h2>${tot(w)}</div>`;
    }
    if (s.d !== cd) {
      h += (cd ? '</div></div>' : '') + `<div class="fr${s.d === M.T ? ' auj' : ''}" data-day="${s.d}"><div class="fd">${JC[s.j]}<b>${jour(s.d).getDate()}</b></div><div class="fl">`;
      cd = s.d;
    }
    h += s.sp === 'r'
      ? `<button class="fi run" data-i="${s.i}" title="${esc(s.t)}">${OK(s)}${ATT(s)}<span class="ft"><b>${esc(s.t)}</b><small>${SOUS(s)}</small></span><span class="pv">${mini(s.p, M.tref, 26)}</span></button>`
      : `<button class="fi mu" data-i="${s.i}" title="${esc(s.t)}">${OK(s)}${ATT(s)}${AV(s)}${muTag(s)}<span class="ft"><small>${SOUS(s)}</small></span></button>`;
  }
  return h + (cd ? '</div></div>' : '') + '</div>';
}

function titreVue(M, n, sous) {
  const w = M.W[n];
  return `<div class="titre-vue"><span class="fl2"><button data-nav="-1" aria-label="Semaine précédente"${n <= 0 ? ' disabled' : ''}>‹</button><button data-nav="1" aria-label="Semaine suivante"${n >= M.W.length - 1 ? ' disabled' : ''}>›</button></span>` +
    `<div><h2>Semaine ${w.n}<small>${dd(w.ws)} → ${dd(w.we)}</small></h2>${sous ? `<div class="m">${sous}</div>` : ''}</div></div>`;
}

// ---------- 2. agenda ----------
export function vAgenda(M, selW) {
  const n0 = selW != null ? selW : semaineCourante(M);
  let h = titreVue(M, n0, '') + `<div class="agh"><span></span>${JC.map(j => `<span>${j}</span>`).join('')}</div>`;
  M.W.forEach((w, n) => {
    if (!n || M.W[n - 1].ph !== w.ph) h += `<div class="mxp">${esc(w.ph || 'Plan')}</div>`;
    h += `<div class="agr${n === selW ? ' sw' : ''}" id="v-w${n}"><div class="agt"><b>S${w.n}</b><span class="kmv">${fk(w.km)}<small> km</small></span><span class="u">${ICO.run}${fh(w.hr)}</span><span class="u">${ICO.mus}${fh(w.hm)}</span></div>`;
    for (let j = 0; j < 7; j++) { const d = addD(w.ws, j); h += `<div class="agc" data-day="${d}"><div class="dn">${JC[j]} ${dd(d)}</div><div>${dayCell(M, n, j, 30)}</div></div>`; }
    h += '</div>';
  });
  return h;
}

// ---------- 3. semaine en grand ----------
export function vFocus(M, n) {
  const w = M.W[n];
  let h = titreVue(M, n, esc(w.ph) + (w.rec ? ' · semaine allégée' : ''));
  h += `<div class="st3"><div>${ICO.route}<b>${fk(w.km)}</b>km</div><div>${ICO.run}<b>${fh(w.hr)}</b>${w.nr}</div><div>${ICO.mus}<b>${fh(w.hm)}</b>${w.nm}</div></div>`;
  const t = w.zm.reduce((a, b) => a + b, 0);
  if (t) {
    h += `<div class="bt">Intensités <small>${fh(t / 60)} de course</small></div><div class="rep">` +
      w.zm.map((m, z) => m ? `<i style="flex:${m};background:${ZC[z + 1]};${z ? '' : 'color:var(--texte)'}" title="${ZN[z + 1]} · ${m} min">${m / t >= 0.08 ? Math.round(m / t * 100) + ' %' : ''}</i>` : '').join('') +
      '</div><div class="zl">' + w.zm.map((m, z) => m ? `<span><i style="background:${ZC[z + 1]}"></i>${ZN[z + 1]} ${m} min</span>` : '').join('') + '</div>';
  }
  h += '<div class="wr">';
  for (let j = 0; j < 7; j++) { const d = addD(w.ws, j); h += `<div class="dc" data-day="${d}"><div class="dn">${JC[j]} ${dd(d)}</div><div>${dayCell(M, n, j, 64)}</div></div>`; }
  return h + '</div>';
}

// ---------- 4. aujourd'hui : indicateurs du jour ----------
export function vAujourdhui(M) {
  const t = M.today;
  if (!t) return '<p class="m">Pas d’indicateurs dans l’instantané.</p>';
  const tu = (n, val, unite, sous, extra) => `<div class="tu"><div class="n">${n}</div><b>${val ?? '—'}${val != null && unite ? `<small>${unite}</small>` : ''}</b>${sous ? `<div class="s">${sous}</div>` : ''}${extra || ''}</div>`;
  const jauge = (v, lo, hi, max) => {
    if (v == null || !max) return '';
    const p = x => Math.min(100, x / max * 100).toFixed(1);
    const col = hi != null && v > hi ? 'var(--rouge)' : lo != null && v < lo ? 'var(--z2)' : 'var(--accent)';
    return `<div class="jauge"><i style="width:${p(v)}%;background:${col}"></i>${hi != null ? `<u style="left:${p(hi)}%"></u>` : ''}</div>`;
  };
  const HRV = { balanced: 'équilibrée', unbalanced: 'déséquilibrée', low: 'basse', poor: 'faible' };
  let h = `<h2>${t.date === M.T ? 'Aujourd’hui' : jl2(t.date)}<small>${dd(t.date)}</small></h2><div class="tuiles">`;
  if (t.hrv) h += tu('VFC nocturne', t.hrv.value, 'ms', [HRV[t.hrv.status] || t.hrv.status, t.hrv.baseline_low != null ? `réf. ${t.hrv.baseline_low}-${t.hrv.baseline_high}` : ''].filter(Boolean).join(' · '));
  if (t.resting_hr != null) h += tu('FC repos', t.resting_hr, 'bpm');
  if (t.sleep) h += tu('Sommeil', t.sleep.duration_s ? fh(t.sleep.duration_s / 3600) : null, '', t.sleep.score != null ? `score ${t.sleep.score}` : '');
  if (t.body_battery != null) h += tu('Body Battery', t.body_battery, '/100', '', jauge(t.body_battery, null, null, 100));
  if (t.acute_load) h += tu('Charge aiguë', Math.round(t.acute_load.value), '', t.acute_load.range_low != null ? `cible ${Math.round(t.acute_load.range_low)}-${Math.round(t.acute_load.range_high)}` : '', jauge(t.acute_load.value, t.acute_load.range_low, t.acute_load.range_high, Math.max(t.acute_load.value, t.acute_load.range_high || 0) * 1.15));
  if (t.mechanical_load) { const m = t.mechanical_load; h += tu('Charge os 7 j', Math.round(m.load_7d), m.max_tolerated ? '/ ' + Math.round(m.max_tolerated) : '', m.max_tolerated ? Math.round(m.load_7d / m.max_tolerated * 100) + ' % du max' : '', jauge(m.load_7d, null, m.max_tolerated, Math.max(m.load_7d, m.max_tolerated || 0) * 1.15)); }
  h += '</div>';
  const ligneS = s => s.sp === 'r'
    ? `<button class="fi run" data-i="${s.i}">${OK(s)}${ATT(s)}<span class="ft"><b>${esc(s.t)}</b><small>${SOUS(s)}</small></span><span class="pv">${mini(s.p, M.tref, 26)}</span></button>`
    : `<button class="fi mu" data-i="${s.i}">${OK(s)}${ATT(s)}${muTag(s)}<span class="ft"><small>${SOUS(s)}</small></span></button>`;
  const ligneH = x => `<button class="fi hpi" data-h="${x.k}"><span class="ft"><b>${esc(x.t)} ${HP}</b><small>${actCourt(x)}${x.pace && x.sp === 'r' ? ' · ' + pc(x.pace) + ' /km' : ''}</small></span></button>`;
  const ss = M.S.filter(s => s.d === M.T), hs = (M.H || []).filter(x => x.d === M.T);
  h += '<div class="seances-jour fil">' + (ss.length || hs.length ? ss.map(ligneS).join('') + hs.map(ligneH).join('') : '<p class="m">Repos</p>') + '</div>';
  h += '<div class="act"><button class="bt2" data-act="ressenti-jour">Ressenti du jour</button></div>';
  let dj = '';
  for (let k = 1; k <= 3; k++) {
    const d = addD(M.T, -k), a = M.S.filter(s => s.d === d && (s.done || s.passe)), b = (M.H || []).filter(x => x.d === d);
    if (a.length || b.length) dj += `<div class="fr"><div class="fd">${JC[(jour(d).getDay() + 6) % 7]}<b>${jour(d).getDate()}</b></div><div class="fl">${a.map(ligneS).join('')}${b.map(ligneH).join('')}</div></div>`;
  }
  if (dj) h += `<h2 class="sous-titre">Derniers jours</h2><div class="fil">${dj}</div>`;
  return h;
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

export function detail(M, s, ctx) {
  const d = jour(s.d);
  let h = `<h3 id="fen-titre">${esc(s.t)}${s.attente ? '<span class="badge att2">en attente du PC</span>' : ''}${s.done ? '<span class="badge fait">faite</span>' : ''}</h3>` +
    `<div class="m">${JL[d.getDay()]} ${dd(s.d)} · S${M.W[s.w] ? M.W[s.w].n : ''}${s.est ? ' · ' + esc(s.est) : ''}</div>` +
    (s.sp !== 'r' ? `<div>${muTag(s)}</div>` : '') + (s.it ? `<p>${esc(s.it)}</p>` : '') + prof(s.p) +
    (s.sx.length ? `<ul class="et">${s.sx.map(([q, l, al, nm, no, rc, zl]) => `<li><div class="q">${esc(q)}</div><div>${gauge(l, zl)}</div><div class="dt">${al ? `<span class="al">${esc(al)}</span>` : ''}${rc ? `<span class="rc">${esc(rc)}</span>` : ''}<span class="nm">${esc(nm)}${no ? ' · ' + esc(no) : ''}</span></div></li>`).join('')}</ul>` : '');

  const vs = s.done ? versus(s) : null;
  if (vs) {
    h += '<h4>Prévu vs réalisé</h4><table class="vsx"><tr><th></th><th>Prévu</th><th>Réalisé</th></tr>' +
      vs.rows.map(([l, a, b, e]) => `<tr><td>${l}</td><td>${a}</td><td><b>${b}</b>${e != null && Math.abs(e) >= 5 ? `<small class="${e > 0 ? 'plus' : 'moins'}">${e > 0 ? '+' : ''}${e} %</small>` : ''}</td></tr>`).join('') + '</table>';
    if (s.parts.length > 1) h += `<div class="m">${s.parts.length} activités cumulées : ${s.parts.map(a => a.distance_m ? f1(a.distance_m / 1000) + ' km' : Math.round((a.duration_s || 0) / 60) + ' min').join(' + ')}</div>`;
  }
  const pr = s.done && s.act ? prevuRealise(s) : null;
  if (pr) {
    if (pr.nCible) h += `<div class="cf"><div><b>${pr.nIn}/${pr.nCible}</b>dans la cible</div></div>`;
    if (pr.rp.length && s.p.length) {
      const Tp = s.p.reduce((q, y) => q + y[0], 0), Tr = pr.rp.reduce((q, y) => q + y[0], 0), T = Math.max(Tp, Tr);
      h += `<div class="pr"><span>Prévu</span>${profAt(s.p, T)}<span>Réalisé</span>${profAt(pr.rp, T)}<span></span><div class="axe"><span>0</span><span>${Math.round(T / 60)} min</span></div></div>`;
    }
    if (pr.rows.length) {
      h += '<div class="tbw"><table class="tb"><tr><th>Étape</th><th>Cible</th><th>Réel</th><th>Écart</th><th>Fait</th><th>FC</th></tr>' +
        pr.rows.map(r => `<tr class="${r.hp ? 'hp' : ''}"><td>${esc(r.lab)}</td><td>${esc(r.tgt)}</td><td class="${r.st}">${esc(r.p)}</td><td class="${r.st}" title="${SC[r.st] || ''}">${r.st ? (r.dl ? (r.dl > 0 ? '+' : '') + r.dl + ' s' : '✓') : ''}</td><td>${esc(r.rq)}</td><td>${r.hr || ''}</td></tr>`).join('') +
        '</table></div>' + (pr.nCible ? '<div class="leg3"><b class="in">● cible</b><b class="fast">● plus vite</b><b class="slow">● plus lent</b>écart en s/km</div>' : '');
    }
    const ev = evaluation(s, pr);
    h += ev.length ? '<ul class="ev">' + ev.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>' : '<p class="ok2">Séance conforme</p>';
  }

  // ressenti : une fois envoyé ou enregistré, un résumé et un crayon ; le formulaire seulement s'il n'y a rien
  if (s.d <= M.T) {
    h += '<h4>Ressenti</h4>';
    const r = ressentiSeance(M, s, ctx);
    ctx.envoyes.filter(a => a.payload && a.payload.session_id === s.id && a.type === 'pain').forEach(a => {
      h += `<div class="dejafait">${resumeRessenti({ kind: 'pain', ...a.payload })}<span class="statut">envoyé, en attente du PC</span></div>`;
    });
    if (r && !ctx.edition) h += carteRessenti(r);
    else h += formRessenti(ctx.saisie, !!r);
  }

  // actions
  const futur = s.d >= M.T && !s.done;
  const debriefEnAttente = ctx.envoyes.some(a => a.type === 'debrief_todo' && a.payload.session_id === s.id) || ctx.debriefs.includes(s.id);
  h += '<div class="act">' +
    (futur ? '<button class="bt2" data-act="dep">Déplacer</button><button class="bt2" data-act="int">Intervertir</button>' : '') +
    (s.d <= M.T ? `<button class="bt2" data-act="debrief"${debriefEnAttente ? ' disabled' : ''}>${debriefEnAttente ? 'Débrief noté' : 'Débrief à faire'}</button>` : '') +
    '</div>';
  h += `<div class="nav"><span class="fl2"><button data-act="prec" aria-label="Séance précédente"${s.i <= 0 ? ' disabled' : ''}>‹</button><button data-act="suiv" aria-label="Séance suivante"${s.i >= M.S.length - 1 ? ' disabled' : ''}>›</button></span></div>`;
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
  if (env) return { ...env.payload, statut: 'envoyé, en attente du PC' };
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
  return h + '<p class="m">Activité non rattachée à une séance du plan.</p>';
}

export function resumeRessenti(x) {
  if (x.kind === 'pain') return `Douleur ${esc(x.zone || '')} <b>${x.intensity ?? '—'}/10</b>${x.comment ? ' · ' + esc(x.comment) : ''}`;
  return [x.rpe != null ? `RPE <b>${x.rpe}</b>` : '', x.legs != null ? `jambes <b>${lib3(JAMBES, x.legs)}</b>` : '', x.breath != null ? `souffle <b>${lib3(SOUFFLE, x.breath)}</b>` : '', x.comment ? esc(x.comment) : ''].filter(Boolean).join(' · ');
}

export function formRessenti(r, edition) {
  const seg = (f, vals, cls) => `<div class="seg${cls ? ' ' + cls : ''}">${vals.map(v => { const [lab, val] = Array.isArray(v) ? v : [v, v]; return `<button type="button" data-act="res" data-f="${f}" data-val="${val}" class="${String(r[f]) === String(val) ? 'on' : ''}">${lab}</button>`; }).join('')}</div>`;
  return '<div class="fm"><label>Effort perçu (RPE 1-10)</label>' + seg('rpe', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'n10') +
    '<label>Jambes</label>' + seg('legs', JAMBES, 'mots') + '<label>Souffle</label>' + seg('breath', SOUFFLE, 'mots') +
    '<label>Douleur</label>' + seg('douleur', ['non', 'oui']) +
    (r.douleur === 'oui' ? '<div class="ln"><div><label>Zone</label>' + seg('zone', ['tibia', 'cuisse', 'autre']) + `</div><div><label>Intensité <b id="int-v">${r.int ?? 0}</b>/10</label><input type="range" min="0" max="10" value="${r.int ?? 0}" data-in="int"></div></div>` : '') +
    `<label>Commentaire</label><textarea rows="2" data-in="com" maxlength="500">${esc(r.com || '')}</textarea>` +
    `<div class="act"><button class="bt2 pri" data-act="res-ok"${(r.rpe || r.legs || r.breath || r.douleur === 'oui' || r.com) ? '' : ' disabled'}>${edition ? 'Envoyer la correction' : 'Envoyer le ressenti'}</button>${edition ? '<button class="bt2" data-act="res-annuler">Annuler</button>' : ''}</div></div>`;
}
