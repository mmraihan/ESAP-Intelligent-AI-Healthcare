/* ESAP Clinical AI — showreel engine.
   Every frame is a pure function of time: window.seek(t) (seconds). Rendered by render.mjs. */
const Q = new URLSearchParams(location.search);
const PT = Q.get('a') === '9x16';
const W = PT ? 1080 : 1920, H = PT ? 1920 : 1080;
const L = (a, b) => (PT ? b : a);
const stage = document.getElementById('stage');
stage.style.width = W + 'px'; stage.style.height = H + 'px';
const BPM_BEAT = 0.5; // 120 bpm
const DROP = 10;

/* ---------- maths ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  in2: t => t * t,
  in3: t => t * t * t,
  in5: t => t ** 5,
  out2: t => 1 - (1 - t) ** 2,
  out3: t => 1 - (1 - t) ** 3,
  out5: t => 1 - (1 - t) ** 5,
  expo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  io3: t => (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  io5: t => (t < .5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  backS: t => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  inBack: t => { const c1 = 1.4, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
};
const pr = (t, a, b, e = E.lin) => e(clamp((t - a) / (b - a)));
const noise = x => Math.sin(x * 12.9898) * 43758.5453 % 1;
const jit = (t, k) => Math.sin(t * 61.7 + k * 7.3) * Math.sin(t * 23.1 + k * 3.1);
const tf = (el, o = {}) => {
  const { x = 0, y = 0, z = 0, s = 1, sx, sy, rx = 0, ry = 0, rz = 0 } = o;
  el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${(sx ?? s).toFixed(4)},${(sy ?? s).toFixed(4)})`;
};
const op = (el, o) => { el.style.opacity = clamp(o).toFixed(3); };
const html = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const mk = (cls, parent = stage, style = '') => { const d = document.createElement('div'); d.className = cls; if (style) d.style.cssText = style; parent.appendChild(d); return d; };

/* smooth keyframe interpolation (Hermite, zero tangents on holds) */
function kf(frames, t) {
  const n = frames.length;
  if (t <= frames[0].t) return { ...frames[0] };
  if (t >= frames[n - 1].t) return { ...frames[n - 1] };
  let i = 0; while (t > frames[i + 1].t) i++;
  const a = frames[i], b = frames[i + 1], h = b.t - a.t, u = (t - a.t) / h;
  const out = {};
  for (const k of Object.keys(a)) {
    if (k === 't') continue;
    const p0 = frames[Math.max(0, i - 1)], p3 = frames[Math.min(n - 1, i + 2)];
    const m = (pa, pb, ta, tb) => (pa[k] === pb[k] ? 0 : (pb[k] - pa[k]) / (tb - ta));
    let m1 = i === 0 ? 0 : m(p0, b, p0.t, b.t);
    let m2 = i + 2 >= n ? 0 : m(a, p3, a.t, p3.t);
    m1 = (a[k] === b[k] || a[k] === p0[k]) ? 0 : m1;
    m2 = (a[k] === b[k] || b[k] === p3[k]) ? 0 : m2;
    const u2 = u * u, u3 = u2 * u;
    out[k] = (2 * u3 - 3 * u2 + 1) * a[k] + (u3 - 2 * u2 + u) * h * m1 + (-2 * u3 + 3 * u2) * b[k] + (u3 - u2) * h * m2;
  }
  return out;
}

/* ---------- SVG helpers ---------- */
function ecgD(w, y, amp, spacing, offset, x0 = -60) {
  let d = `M${x0} ${y}`; const beat = (bx) => {
    const a = amp;
    return ` L${bx} ${y} L${bx + 22} ${y - 14 * a} L${bx + 44} ${y} L${bx + 78} ${y} L${bx + 90} ${y + 16 * a} L${bx + 108} ${y - 120 * a} L${bx + 128} ${y + 54 * a} L${bx + 146} ${y} L${bx + 190} ${y} L${bx + 218} ${y - 26 * a} L${bx + 250} ${y}`;
  };
  const start = ((offset % spacing) + spacing) % spacing - spacing;
  for (let bx = start; bx < w + spacing; bx += spacing) d += beat(bx);
  d += ` L${w + 80} ${y}`;
  return d;
}
const logoSVG = (size, id) => `
<svg class="logo" viewBox="0 0 32 32" width="${size}" height="${size}" style="overflow:visible">
 <defs><linearGradient id="lg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d6fbd"/><stop offset="1" stop-color="#0e9384"/></linearGradient></defs>
 <rect class="lt" width="32" height="32" rx="8" fill="url(#lg${id})"/>
 <g class="lc"><rect x="12" y="5" width="8" height="22" rx="2.2" fill="#fff"/><rect x="5" y="12" width="22" height="8" rx="2.2" fill="#fff"/></g>
 <polyline class="le" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0" points="5.6,16 10.6,16 12.6,13.3 14.8,19.4 17.2,10.6 19.4,18.3 21,16 26.4,16" fill="none" stroke="#0d6fbd" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/* smooth blob */
function blobPath(cx, cy, r, seed, t, n = 7) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.22 * Math.sin(t * 0.9 + seed + i * 1.7) + 0.12 * Math.sin(t * 1.7 + seed * 2 + i * 2.9));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (i === 0) d += `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/* ---------- kinetic words ---------- */
function words(parent, text, cls = '', style = '') {
  const el = mk('', parent, style);
  el.className = cls;
  const spans = [];
  text.split(' ').forEach((w, i, arr) => {
    const wm = document.createElement('span'); wm.className = 'wm';
    const s = document.createElement('span');
    if (w.startsWith('~')) { s.className = 'grad'; w = w.slice(1); }
    if (w.startsWith('^')) { s.className = 'gradL'; w = w.slice(1); }
    s.textContent = w; wm.appendChild(s); el.appendChild(wm);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    spans.push(s);
  });
  return { el, spans };
}
function showWords(spans, t, t0, stag = .08, dur = .7, ease = E.expo, rot = 6) {
  spans.forEach((s, i) => {
    const p = pr(t, t0 + i * stag, t0 + i * stag + dur, ease);
    s.style.transform = `translateY(${(1 - p) * 118}%) rotate(${(1 - p) * rot}deg)`;
    s.style.opacity = p > 0 ? 1 : 0;
  });
}
function hideWords(spans, t, t0, stag = .05, dur = .45) {
  spans.forEach((s, i) => {
    const p = pr(t, t0 + i * stag, t0 + i * stag + dur, E.in3);
    if (p > 0) { s.style.transform = `translateY(${-p * 118}%)`; }
  });
}

/* ---------- device builders ---------- */
function buildLaptop(parent, imgs) {
  const d = mk('dev3d', parent);
  d.innerHTML = `<div class="shadow3d"></div><div class="base"><div class="keys"></div><div class="pad"></div></div><div class="front"></div>
  <div class="lid"><div class="dot"></div><div class="scr"></div></div>`;
  const scr = d.querySelector('.scr');
  const els = {};
  imgs.forEach(([k, src]) => { const im = new Image(); im.src = 'assets/ui/' + src; scr.appendChild(im); els[k] = im; });
  return { d, scr, els, lid: d.querySelector('.lid') };
}
function buildTablet(parent, imgs) {
  const d = mk('dev3d', parent);
  d.innerHTML = `<div class="tablet"><div class="scr"></div></div>`;
  const scr = d.querySelector('.scr'); const els = {};
  imgs.forEach(([k, src]) => { const im = new Image(); im.src = 'assets/ui/' + src; scr.appendChild(im); els[k] = im; });
  return { d, scr, els, body: d.querySelector('.tablet') };
}
function buildPhone(parent) {
  const d = mk('dev3d', parent);
  d.innerHTML = `<div class="phone"><div class="scr"><div class="isl"></div>
   <img class="long" id="phEn" src="assets/ui/phfull_en.jpg"><img class="long" id="phAr" src="assets/ui/phfull_ar.jpg">
   <div class="hdr"><div class="sb"><span>9:41</span><span>●●● ▮</span></div>
   <div class="brandrow"><div class="phb" style="display:flex;align-items:center;gap:8px"></div><div class="pill-lang"><span class="en on">EN</span><span class="ar">العربية</span></div></div></div></div></div>`;
  const e = { d, body: d.querySelector('.phone'), en: d.querySelector('#phEn'), ar: d.querySelector('#phAr'), hdr: d.querySelector('.hdr'), brand: d.querySelector('.phb'), pen: d.querySelector('.pill-lang .en'), par: d.querySelector('.pill-lang .ar') };
  e.brand.innerHTML = logoSVG(34, 'ph' + Math.random().toString(36).slice(2, 6)) + `<b style="font:700 18px Inter;color:#0B2136;letter-spacing:.02em">ESAP</b>`;
  return e;
}
function setPhone(ph, lang, scroll) {
  const ar = lang === 'ar';
  ph.en.style.display = ar ? 'none' : 'block'; ph.ar.style.display = ar ? 'block' : 'none';
  const im = ar ? ph.ar : ph.en;
  im.style.position = 'absolute'; im.style.left = '0'; im.style.top = (-57 + 104 - 0 - scroll) + 'px'; // header band (57px) replaced by our own 104px bar
  ph.pen.classList.toggle('on', !ar); ph.par.classList.toggle('on', ar);
  ph.hdr.style.direction = ar ? 'rtl' : 'ltr';
  ph.hdr.querySelector('.brandrow').style.flexDirection = ar ? 'row-reverse' : 'row';
}

/* ---------- global layers ---------- */
const scenes = [];
function scene(name, a, b, z, build) { const el = mk('layer', stage); el.style.zIndex = z; el.dataset.name = name; const s = { name, a, b, el, ...build(el) }; scenes.push(s); return s; }
const sweepEl = mk('', stage, `position:absolute;top:-10%;bottom:-10%;width:34%;left:0;z-index:80;transform:skewX(-14deg);background:linear-gradient(90deg,rgba(11,107,176,0),rgba(11,107,176,.85) 40%,rgba(13,148,136,.95) 70%,rgba(13,148,136,0));mix-blend-mode:normal;display:none`);
const flash = mk('', stage, 'position:absolute;inset:0;background:#fff;z-index:95;opacity:0;pointer-events:none');
const demo = html('<div id="demo" class="mono d"><i></i>Demonstration data</div>'); stage.appendChild(demo);
const vignette = mk('', stage, 'position:absolute;inset:0;z-index:92;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 62%,rgba(5,15,28,.22) 100%)');
if (PT) { demo.style.left = '40px'; demo.style.bottom = '64px'; demo.style.fontSize = '17px'; }

function sweep(t, t0, dur = .6) {
  const p = pr(t, t0, t0 + dur, E.io3);
  if (p <= 0 || p >= 1) { if (sweepEl.dataset.k !== t0 + '') { /* noop */ } }
  const active = t >= t0 && t <= t0 + dur;
  return { active, p };
}
const sweeps = [16.0 - 100, 32.0, 37.0, 44.0, 51.0, 54.5]; // cut accents
function updateSweep(t) {
  let on = false;
  for (const s0 of sweeps) {
    if (t >= s0 - 0.05 && t <= s0 + .55) {
      const p = E.io3(clamp((t - (s0 - 0.05)) / .6));
      sweepEl.style.display = 'block';
      sweepEl.style.left = lerp(-45, 115, p) + '%';
      on = true;
    }
  }
  if (!on) sweepEl.style.display = 'none';
}

/* =====================================================================
   SCENE 1 — HOOK (0–5)
   ===================================================================== */
scene('hook', 0, 5.2, 10, (el) => {
  el.style.background = 'radial-gradient(ellipse at 50% 45%,#12385a 0%,#0B2136 55%,#071827 100%)';
  const grid = mk('layer dark-grid', el);
  const cy = H / 2;
  const svg = html(`<svg class="abs" width="${W}" height="${H}" style="left:0;top:0;overflow:visible"><defs>
    <linearGradient id="eg1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#0B6BB0"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
    <filter id="gl1" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g id="ecgG"><path id="ecgP" d="" fill="none" stroke="url(#eg1)" stroke-width="${L(7, 8)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" filter="url(#gl1)"/></g>
    <circle id="ecgHead" r="14" fill="#9ff3e6" filter="url(#gl1)"/></svg>`);
  el.appendChild(svg);
  const path = svg.querySelector('#ecgP'); path.setAttribute('d', ecgD(W, cy, L(1, .8), W / L(3.1, 2.2), W * .06, 0));
  const head = svg.querySelector('#ecgHead'); const g = svg.querySelector('#ecgG');
  const ring = mk('', el, `position:absolute;left:${W / 2 - 150}px;top:${cy - 150}px;width:300px;height:300px;border-radius:50%;border:3px solid rgba(94,234,212,.9);opacity:0`);
  const lock = mk('', el, `position:absolute;left:${W / 2}px;top:${cy}px;width:0;height:0`);
  const T = L(220, 200);
  const tile = mk('', lock, `position:absolute;left:${-T / 2}px;top:${-T / 2}px;width:${T}px;height:${T}px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.45))`);
  tile.innerHTML = logoSVG(T, 'h1');
  const wmk = mk('', lock, `position:absolute;left:${L(-100, -200)}px;top:${L(-70, 130)}px;white-space:nowrap;${PT ? 'width:400px;text-align:center' : ''}`);
  wmk.innerHTML = `<div style="font:800 ${L(128, 120)}px Inter;letter-spacing:-.035em;line-height:1">ESAP</div><div class="mono" style="font-size:${L(24, 22)}px;color:#7DB9E8;margin-top:6px;letter-spacing:.34em">Clinical AI</div>`;
  const wm1 = wmk.firstElementChild, wm2 = wmk.lastElementChild;
  const head1 = words(el, 'The first hours of a hospital stay ~matter ~most.', '', `position:absolute;left:${L(210, 70)}px;width:${L(1500, 940)}px;top:${L(cy - 40, cy - 80)}px;text-align:center;font:700 ${L(92, 104)}px/1.08 Inter;letter-spacing:-.03em;color:#fff`);
  return {
    update(t) {
      // grid drift + camera push
      grid.style.backgroundPosition = `${-t * 14}px ${t * 6}px`;
      const push = 1 + t * .006;
      // ECG draw
      const dp = pr(t, .15, 2.0, E.io3);
      path.setAttribute('stroke-dashoffset', (1 - dp).toFixed(4));
      const len = path.getTotalLength();
      const pt = path.getPointAtLength(Math.max(.01, dp) * len);
      head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y);
      head.style.opacity = dp > 0 && t < 2.0 ? 1 : 0;
      // snap collapse
      const cp = pr(t, 2.0, 2.45, E.in5);
      g.setAttribute('transform', `translate(${W / 2} ${cy}) scale(${Math.max(.0001, 1 - cp)} ${1 + cp * .6}) translate(${-W / 2} ${-cy})`);
      g.style.opacity = t > 2.46 ? 0 : 1;
      // tile pop
      const tp = pr(t, 2.38, 2.95, E.back);
      const shiftP = PT ? 0 : pr(t, 3.0, 3.6, E.io5);
      const upP = pr(t, 3.1, 3.9, E.io5);
      tile.style.transform = `translate(${lerp(0, -250, shiftP)}px,0px) scale(${tp * (1 + .0)})`;
      tile.style.opacity = tp > 0 ? 1 : 0;
      // ecg inside logo draws
      tile.querySelector('.le').setAttribute('stroke-dashoffset', (1 - pr(t, 2.55, 3.0, E.io3)).toFixed(3));
      tile.querySelector('.lc').style.opacity = pr(t, 2.38, 2.6);
      // ring pulse
      const rp = pr(t, 2.4, 3.1, E.out3);
      ring.style.opacity = rp > 0 && rp < 1 ? (1 - rp) * .9 : 0;
      ring.style.transform = `scale(${lerp(.5, 2.4, rp)})`;
      // wordmark
      wm1.style.transform = `translateY(${(1 - pr(t, 3.0, 3.6, E.expo)) * 40}px)`; wm1.style.opacity = pr(t, 3.0, 3.35);
      wm2.style.opacity = pr(t, 3.3, 3.7); wm2.style.transform = `translateX(${(1 - pr(t, 3.3, 3.9, E.out3)) * -30}px)`;
      lock.style.transform = `translateY(${lerp(0, L(-300, -560), upP)}px) scale(${lerp(1, L(.62, .66), upP)})`;
      // headline
      showWords(head1.spans, t, 3.55, .1, .8);
      el.style.transform = `scale(${push})`;
      const out = pr(t, 4.75, 5.15, E.in3);
      head1.el.style.transform = `translateY(${-out * 30}px)`; head1.el.style.opacity = 1 - out;
    }
  };
});

/* =====================================================================
   SCENE 2 — PROBLEM (5–10)
   ===================================================================== */
scene('problem', 5, 10.6, 11, (el) => {
  el.style.background = 'radial-gradient(ellipse at 50% 55%,#103452 0%,#0B2136 60%,#06131f 100%)';
  const grid = mk('layer dark-grid', el);
  const glow = mk('', el, `position:absolute;left:${W / 2 - 700}px;top:${H / 2 - 500}px;width:1400px;height:1000px;border-radius:50%;background:radial-gradient(closest-side,rgba(11,107,176,.38),rgba(11,107,176,0));`);
  const fs = L(206, 150);
  const lines = [['Incomplete', 'information.'], ['Many patients', 'at once.'], ['Decisions', 'under pressure.']];
  const blocks = lines.map((ln, idx) => {
    const wrap = mk('', el, `position:absolute;left:0;top:${H / 2 - fs * 1.05 - (PT ? 150 : 74)}px;width:${W}px;height:${fs * 2.1}px`);
    const mkCopy = (parent, extra = '') => `<div style="position:absolute;inset:0;text-align:center;font:800 ${fs}px/1.0 Inter;letter-spacing:-.045em;color:#fff;${extra}">${ln[0]}<br>${ln[1]}</div>`;
    const n = idx === 0 ? 6 : idx === 1 ? 8 : 1;
    const copies = [];
    for (let i = n - 1; i >= 0; i--) {
      const c = html(mkCopy(wrap, idx === 1 && i > 0 ? `color:transparent;-webkit-text-stroke:2px rgba(125,185,232,${.55 - i * .05})` : ''));
      wrap.appendChild(c); copies[i] = c;
    }
    return { wrap, copies };
  });
  const svg = html(`<svg class="abs" width="${W}" height="${H}" style="left:0;top:0;overflow:visible"><defs>
    <linearGradient id="eg2" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#0B6BB0"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
    <filter id="gl2" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <path id="p2" d="" fill="none" stroke="url(#eg2)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" filter="url(#gl2)"/><g id="ticks"></g></svg>`);
  el.appendChild(svg);
  const p2 = svg.querySelector('#p2'), ticks = svg.querySelector('#ticks');
  const ty = H * L(.87, .76);
  const tickEls = [];
  for (let i = 0; i < 31; i++) { const x = (i / 30) * (W - 160) + 80; const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', ty - (i % 5 === 0 ? 22 : 11)); l.setAttribute('y2', ty + (i % 5 === 0 ? 22 : 11)); l.setAttribute('stroke', 'rgba(125,185,232,.65)'); l.setAttribute('stroke-width', 2); ticks.appendChild(l); tickEls.push(l); }
  const mx = W / 2;
  const marker = mk('', el, `position:absolute;left:${mx}px;top:${ty}px;width:0;height:0`);
  marker.innerHTML = `<div class="r" style="position:absolute;left:-40px;top:-40px;width:80px;height:80px;border-radius:50%;border:3px solid #5eead4"></div><div class="r2" style="position:absolute;left:-40px;top:-40px;width:80px;height:80px;border-radius:50%;border:3px solid #5eead4"></div>
   <div class="c" style="position:absolute;left:-20px;top:-20px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#bff7ee,#2dd4bf 55%,#0B6BB0);box-shadow:0 0 50px 16px rgba(45,212,191,.55)"></div>`;
  const lab = mk('mono', el, `position:absolute;left:${mx - 200}px;top:${ty - 120}px;width:400px;text-align:center;font-size:${L(26, 24)}px;color:#bff7ee;letter-spacing:.3em`); lab.textContent = 'Admission';
  const lab2 = mk('mono', el, `position:absolute;left:80px;top:${ty + 44}px;font-size:16px;color:rgba(125,185,232,.7)`); lab2.textContent = 'Time in hospital →';
  const T0 = [5.0, 6.5, 8.0], T1 = [6.5, 8.0, 9.2];
  return {
    update(t) {
      grid.style.backgroundPosition = `${-t * 40}px 0`;
      const k = E.out2(pr(t, 5, 10));
      glow.style.transform = `scale(${1 + .4 * Math.sin(t * 2) * .2 + k * .2})`;
      // phrase blocks
      blocks.forEach((b, idx) => {
        const t0 = T0[idx], t1 = T1[idx];
        const vis = t >= t0 - .01 && t < t1 + .01;
        b.wrap.style.display = vis ? 'block' : 'none';
        if (!vis) return;
        const inP = pr(t, t0, t0 + .62, E.out5), outP = pr(t, t1 - .3, t1, E.in3);
        if (idx === 0) {
          b.copies.forEach((c, i) => {
            const dir = i % 2 ? 1 : -1;
            const off = (1 - inP) * dir * (W * .5) * (1 + i * .12);
            const n = b.copies.length;
            c.style.clipPath = `inset(${Math.max(0, (i / n) * 100 - .5)}% -10% ${Math.max(0, (1 - (i + 1) / n) * 100 - .5)}% -10%)`;
            c.style.transform = `translateX(${off - outP * dir * 160}px)`;
            c.style.opacity = 1 - outP;
          });
        } else if (idx === 1) {
          const spread = lerp(0, 34, E.out3(pr(t, t0 + .1, t0 + .9))) * (1 - outP * .5);
          b.copies.forEach((c, i) => {
            const e = i === 0 ? inP : pr(t, t0 + i * .035, t0 + .6 + i * .035, E.out5);
            c.style.transform = `translate(${i * spread * 0.9}px,${-i * spread * .55 + (1 - e) * 140}px) scale(${lerp(.9, 1, e)})`;
            c.style.opacity = (i === 0 ? 1 : .9 - i * .09) * e * (1 - outP);
          });
        } else {
          const c = b.copies[0];
          const sq = lerp(1.35, 1, inP);
          const sh = (1 - outP) * 0;
          c.style.transform = `scale(${sq},${lerp(.6, 1, inP)}) translate(${jit(t, 1) * 5 * inP}px,${jit(t, 2) * 3 * inP}px) translateY(${-outP * 120}px)`;
          c.style.letterSpacing = `${lerp(.02, -.055, inP)}em`;
          c.style.opacity = clamp(inP * 3) * (1 - outP);
        }
      });
      // ECG -> timeline morph
      const amp = lerp(1.0 + .5 * pr(t, 6, 8.6), 0, pr(t, 8.9, 9.6, E.io3));
      const spacing = lerp(520, 380, pr(t, 5, 8.6));
      p2.setAttribute('d', ecgD(W, ty, amp, L(spacing, spacing * .7), -t * L(380, 300) - 40));
      p2.setAttribute('stroke-opacity', pr(t, 5, 5.2));
      const tk = pr(t, 9.0, 9.7, E.out3);
      tickEls.forEach((l, i) => l.setAttribute('stroke-opacity', clamp(tk * 1.6 - i * .018 * 1.6)));
      // marker
      const mp = pr(t, 9.0, 9.55, E.back);
      marker.style.transform = `scale(${mp})`; marker.style.opacity = mp > 0 ? 1 : 0;
      const bt = (t * 2) % 1;
      const r1 = marker.querySelector('.r'), r2 = marker.querySelector('.r2');
      r1.style.transform = `scale(${1 + bt * 2.4})`; r1.style.opacity = (1 - bt) * .9;
      const b2 = (t * 2 + .5) % 1; r2.style.transform = `scale(${1 + b2 * 2.4})`; r2.style.opacity = (1 - b2) * .9;
      const grow = pr(t, 9.72, 10.15, E.in3);
      marker.querySelector('.c').style.transform = `scale(${1 + grow * 60})`;
      lab.style.opacity = pr(t, 9.2, 9.6) * (1 - grow); lab.style.transform = `translateY(${(1 - pr(t, 9.2, 9.7, E.out3)) * 20}px)`;
      lab2.style.opacity = tk * .8 * (1 - grow);
      el.style.transform = `scale(${1 + pr(t, 8.6, 10.2, E.in2) * .08})`;
    }
  };
});

/* =====================================================================
   WORLD A — laptop reveal, insights, why (10–32.6)
   ===================================================================== */
const cardData = [
  { tag: 'Insight 01', title: 'Possible conditions', viz: 'bars' },
  { tag: 'Insight 02', title: 'Risk during the stay', viz: 'arc' },
  { tag: 'Insight 03', title: 'Chance of needing ICU', viz: 'ring' },
  { tag: 'Insight 04', title: 'Chance of returning within 30 days', viz: 'dots' },
  { tag: 'Insight 05', title: 'Expected length of stay', viz: 'range' },
];
const icons = [
  '<path d="M5 7h14M5 12h10M5 17h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
  '<path d="M3 12h4l2-5 3 10 2-5h7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  '<path d="M4 17V8M4 13h16v4M20 13v-2a3 3 0 0 0-3-3h-5v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="8" cy="10.5" r="1.8" fill="#fff"/>',
  '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  '<circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="2.2" fill="none"/><path d="M12 7v5l3 2" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
];
function vizHTML(kind) {
  if (kind === 'bars') return `<svg viewBox="0 0 270 170" width="100%" height="100%">${[[230, '#0B6BB0'], [178, '#2E86C8'], [126, '#6AAADB'], [84, '#A9CCEB']].map((b, i) => `<rect x="0" y="${6 + i * 42}" width="270" height="26" rx="13" fill="#e8f0f7"/><rect class="b" data-w="${b[0]}" x="0" y="${6 + i * 42}" width="${b[0]}" height="26" rx="13" fill="${b[1]}"/>`).join('')}</svg>`;
  if (kind === 'arc') return `<svg viewBox="0 0 270 170" width="100%" height="100%"><path d="M25 150A110 110 0 0 1 245 150" fill="none" stroke="#e3ebf3" stroke-width="24" stroke-linecap="round"/><path class="a" pathLength="1" stroke-dasharray="1" d="M25 150A110 110 0 0 1 245 150" fill="none" stroke="#0B6BB0" stroke-width="24" stroke-linecap="round"/></svg>`;
  if (kind === 'ring') return `<svg viewBox="0 0 270 170" width="100%" height="100%"><circle cx="135" cy="85" r="68" fill="none" stroke="#e3ebf3" stroke-width="22"/><circle class="a" cx="135" cy="85" r="68" pathLength="1" stroke-dasharray="1 1" transform="rotate(-90 135 85)" fill="none" stroke="#2E86C8" stroke-width="22" stroke-linecap="round"/><path d="M110 98V74M110 90h50v8M160 90v-6a8 8 0 0 0-8-8h-18v14" stroke="#0B6BB0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
  if (kind === 'dots') { let d = ''; for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) { const i = r * 10 + c; d += `<circle class="d" data-i="${i}" cx="${15 + c * 27}" cy="${28 + r * 50}" r="10" fill="#dfe9f3"/>`; } return `<svg viewBox="0 0 270 170" width="100%" height="100%">${d}</svg>`; }
  return `<svg viewBox="0 0 270 170" width="100%" height="100%"><rect x="0" y="60" width="270" height="22" rx="11" fill="#e3ebf3"/><rect class="r" data-x="62" data-w="136" x="62" y="52" width="136" height="38" rx="19" fill="#0B6BB0"/>${[0, 1, 2, 3, 4].map(i => `<line x1="${i * 67.5}" x2="${i * 67.5}" y1="108" y2="124" stroke="#9fb3c6" stroke-width="3"/>`).join('')}<circle cx="130" cy="71" r="9" fill="#fff"/></svg>`;
}

scene('worldA', DROP, 32.7, 20, (el) => {
  el.style.background = 'linear-gradient(160deg,#F5F9FC 0%,#E6F0F8 60%,#E3F2F1 100%)';
  mk('layer light-grid', el);
  const blobsvg = html(`<svg class="abs" width="${W}" height="${H}" style="left:0;top:0"><defs>
    <linearGradient id="bl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B6BB0" stop-opacity=".30"/><stop offset="1" stop-color="#2dd4bf" stop-opacity=".18"/></linearGradient>
    <linearGradient id="bl2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D9488" stop-opacity=".26"/><stop offset="1" stop-color="#0B6BB0" stop-opacity=".10"/></linearGradient></defs>
    <path id="blA" fill="url(#bl1)"/><path id="blB" fill="url(#bl2)"/></svg>`);
  el.appendChild(blobsvg);
  const blA = blobsvg.querySelector('#blA'), blB = blobsvg.querySelector('#blB');
  const world = mk('', el); world.id = 'worldA'; world.style.cssText = 'position:absolute;inset:0;perspective:2400px;perspective-origin:50% 50%';
  const cam = mk('cam3', world);
  const lap = buildLaptop(cam, [['work', 'd_worklist.jpg'], ['intake', 'd_intake.jpg'], ['intake2', 'd_intake.jpg'], ['res', 'd_res_top.jpg'], ['why', 'd_why.jpg']]);
  lap.d.style.transform = 'translateY(331px)';
  // highlight ring over worklist row
  const hl = mk('', lap.scr, 'position:absolute;border:3px solid #0B6BB0;border-radius:10px;background:rgba(11,107,176,.10);box-shadow:0 0 0 6px rgba(11,107,176,.12)');
  const sc = 1100 / 1920; hl.style.left = 272 * sc + 'px'; hl.style.top = 582 * sc + 'px'; hl.style.width = (1536 - 272) * sc + 'px'; hl.style.height = 64 * sc + 'px';
  const scan = mk('', lap.scr, 'position:absolute;left:0;right:0;height:140px;background:linear-gradient(180deg,rgba(11,107,176,0),rgba(45,212,191,.42),rgba(11,107,176,0));mix-blend-mode:multiply');
  // text: headline
  const hx = L(110, 70), hw = L(740, 940), hy = L(250, 150);
  const lab = mk('mono', el, `position:absolute;left:${hx}px;top:${hy - 56}px;font-size:${L(20, 22)}px;color:#0B6BB0`); lab.textContent = 'Introducing';
  const headL1 = words(el, '~ESAP Clinical AI:', '', `position:absolute;left:${hx}px;top:${hy}px;width:${hw}px;font:800 ${L(84, 96)}px/1.05 Inter;letter-spacing:-.035em;color:#0B2136`);
  const headL2 = words(el, 'an early, explained picture of every patient.', '', `position:absolute;left:${hx}px;top:${hy + L(94, 108)}px;width:${hw}px;font:700 ${L(60, 76)}px/1.1 Inter;letter-spacing:-.03em;color:#0B2136`);
  headL1.spans.forEach(s => s.style.display = 'inline-block');
  // stepper pill
  const pill = mk('glass mono', el, `position:absolute;left:${hx}px;top:${L(80, 110)}px;padding:12px 22px;border-radius:999px;font-size:${L(18, 20)}px;color:#0B2136;display:flex;gap:14px;align-items:center`);
  pill.innerHTML = '<span id="stp1" style="color:#0B6BB0">01 Intake</span><span style="opacity:.35">→</span><span id="stp2" style="opacity:.4">02 Five early insights</span>';
  // cards
  const cardsL = mk('', world); cardsL.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d';
  const cw = L(330, 470), ch = L(375, 300);
  const cards = cardData.map((c, i) => {
    const d = mk('icard', cardsL, `width:${cw}px;height:${ch}px;margin-left:${-cw / 2}px;margin-top:${-ch / 2}px`);
    d.innerHTML = `<div class="tag mono">${c.tag}</div><div class="ic"><svg viewBox="0 0 24 24" width="28" height="28">${icons[i]}</svg></div><div class="tt" style="font-size:${L(32, 31)}px;top:${L(80, 76)}px;right:${PT ? 100 : 28}px">${c.title}</div><div class="viz" style="top:${L(205, 150)}px;bottom:${L(66, 52)}px">${vizHTML(c.viz)}</div><div class="why mono"><b>?</b>Why</div>`;
    return { d, viz: c.viz, a: d.querySelector('.a'), bars: [...d.querySelectorAll('.b')], dots: [...d.querySelectorAll('.d')], r: d.querySelector('.r') };
  });
  // why overlay
  const veil = mk('', el, 'position:absolute;inset:0;background:rgba(238,245,251,.80);backdrop-filter:blur(8px);opacity:0;z-index:3');
  const wy = html(`<div class="glass abs" style="z-index:4;border-radius:36px;opacity:0"></div>`); el.appendChild(wy);
  const wW = L(980, 960), wH = L(640, 760), wX = L(900, 60), wY = L(220, 760);
  wy.style.cssText += `;left:${wX}px;top:${wY}px;width:${wW}px;height:${wH}px;padding:44px 52px`;
  const rows = [['Charlson comorbidity index', +.504], ['Hemoglobin', -.210], ['Age', -.165], ['Previous admissions', +.097], ['Systolic blood pressure', -.080], ['Prior conditions on record', +.060]];
  const half = (wW - 104) / 2 - 30;
  wy.innerHTML = `<div class="mono" style="font-size:18px;color:#0B6BB0;margin-bottom:6px">Why? · what moved this estimate</div>
   <div style="display:flex;justify-content:space-between;font:600 20px Inter;color:#4a6073;margin:22px 0 14px"><span>◂ Lowered the estimate</span><span>Raised the estimate ▸</span></div>
   <div style="position:relative">${rows.map((r, i) => `<div class="wr" style="position:relative;height:${L(66, 84)}px;margin-bottom:6px"><div style="position:absolute;left:0;right:0;top:0;font:600 ${L(19, 21)}px Inter;color:#0B2136;text-align:center">${r[0]}</div>
     <div style="position:absolute;left:0;right:0;top:${L(30, 36)}px;height:${L(26, 30)}px"><div class="bar" data-v="${r[1]}" style="position:absolute;top:0;height:100%;border-radius:15px;background:${r[1] > 0 ? 'linear-gradient(90deg,#0B6BB0,#1b86d0)' : 'linear-gradient(270deg,#7DB9E8,#a9d3f2)'};${r[1] > 0 ? 'left:50%' : 'right:50%'};width:0"></div></div></div>`).join('')}
    <div style="position:absolute;left:50%;top:40px;bottom:0;width:2px;background:rgba(11,33,54,.25)"></div></div>
   <div class="mono" style="position:absolute;left:52px;right:52px;bottom:30px;font-size:15px;color:#4a6073;display:flex;justify-content:space-between"><span>Reliability shown with every insight</span><span style="color:#0B6BB0">● Population-level estimate</span></div>`;
  const bars = [...wy.querySelectorAll('.bar')];
  const wscale = half / .504;
  const wcap1 = words(el, 'Every insight explained.', '', `position:absolute;left:${L(110, 70)}px;top:${L(330, 190)}px;width:${L(740, 940)}px;font:800 ${L(84, 96)}px/1.05 Inter;letter-spacing:-.035em;color:#0B2136;z-index:5`);
  const wcap2 = words(el, '~Honest about reliability.', '', `position:absolute;left:${L(110, 70)}px;top:${L(330 + 190, 190 + 215)}px;width:${L(740, 940)}px;font:800 ${L(84, 96)}px/1.05 Inter;letter-spacing:-.035em;color:#0B2136;z-index:5`);
  wcap2.spans.forEach(s => s.style.display = 'inline-block');
  // camera
  const kfL = [
    { t: 9.9, s: .5, rx: 20, ry: -28, rz: -3, fx: 0, fy: 0, ox: 0, oy: 30 },
    { t: 10.8, s: 1.0, rx: 9, ry: -12, rz: -1, fx: 0, fy: 0, ox: 0, oy: 10 },
    { t: 11.55, s: 1.74, rx: 0, ry: 0, rz: 0, fx: 0, fy: 0, ox: 0, oy: 0 },
    { t: 12.3, s: 1.8, rx: 0, ry: 0, rz: 0, fx: 0, fy: 14, ox: 0, oy: 0 },
    { t: 14.0, s: .74, rx: 6, ry: 15, rz: 0, fx: 0, fy: -10, ox: 420, oy: 60 },
    { t: 16.0, s: .74, rx: 6, ry: 13, rz: 0, fx: 0, fy: -10, ox: 420, oy: 60 },
    { t: 17.2, s: 1.0, rx: 4, ry: 6, rz: 0, fx: 0, fy: -10, ox: 0, oy: 40 },
    { t: 18.5, s: 1.02, rx: 3, ry: 3, rz: 0, fx: 0, fy: -10, ox: 0, oy: 40 },
    { t: 19.4, s: .58, rx: 12, ry: -10, rz: 0, fx: 0, fy: 0, ox: 0, oy: -20 },
    { t: 23.0, s: .58, rx: 12, ry: 10, rz: 0, fx: 0, fy: 0, ox: 0, oy: -20 },
    { t: 24.3, s: .42, rx: 4, ry: 0, rz: 0, fx: 0, fy: 0, ox: 0, oy: -272 },
    { t: 26.0, s: .42, rx: 4, ry: 0, rz: 0, fx: 0, fy: 0, ox: 0, oy: -272 },
    { t: 27.7, s: 2.75, rx: 0, ry: 0, rz: 0, fx: 392, fy: -105, ox: -10, oy: 0 },
    { t: 32.7, s: 3.0, rx: 0, ry: 0, rz: 0, fx: 392, fy: -105, ox: -10, oy: 0 },
  ];
  const kfP = [
    { t: 9.9, s: .5, rx: 20, ry: -28, rz: -3, fx: 0, fy: 0, ox: 0, oy: 80 },
    { t: 10.8, s: .9, rx: 9, ry: -12, rz: -1, fx: 0, fy: 0, ox: 0, oy: 20 },
    { t: 11.55, s: .98, rx: 0, ry: 0, rz: 0, fx: 0, fy: 0, ox: 0, oy: 0 },
    { t: 12.3, s: 1.0, rx: 0, ry: 0, rz: 0, fx: 0, fy: 14, ox: 0, oy: 0 },
    { t: 14.0, s: .9, rx: 6, ry: 10, rz: 0, fx: 0, fy: -10, ox: 0, oy: 400 },
    { t: 16.0, s: .9, rx: 6, ry: 8, rz: 0, fx: 0, fy: -10, ox: 0, oy: 400 },
    { t: 17.2, s: .98, rx: 5, ry: 6, rz: 0, fx: 0, fy: -10, ox: 0, oy: 340 },
    { t: 18.5, s: 1.0, rx: 4, ry: 3, rz: 0, fx: 0, fy: -10, ox: 0, oy: 340 },
    { t: 19.4, s: .55, rx: 12, ry: -10, rz: 0, fx: 0, fy: 0, ox: 0, oy: -100 },
    { t: 23.0, s: .55, rx: 12, ry: 10, rz: 0, fx: 0, fy: 0, ox: 0, oy: -100 },
    { t: 24.3, s: .46, rx: 2, ry: 0, rz: 0, fx: 0, fy: 0, ox: 0, oy: -470 },
    { t: 26.0, s: .46, rx: 2, ry: 0, rz: 0, fx: 0, fy: 0, ox: 0, oy: -470 },
    { t: 27.7, s: 2.75, rx: 0, ry: 0, rz: 0, fx: 392, fy: -105, ox: -10, oy: -330 },
    { t: 32.7, s: 3.0, rx: 0, ry: 0, rz: 0, fx: 392, fy: -105, ox: -10, oy: -330 },
  ];
  const KF = L(kfL, kfP);
  const rowPos = (i) => PT ? { x: (i % 2 === 0 ? -250 : 250) + (i === 4 ? 250 : 0) * 0 + (i === 4 ? 250 : 0) * -0, y: -150 + Math.floor(i / 2) * 322 + 150 - 150 } : { x: (i - 2) * (cw + 28), y: 300 };
  const rows3 = (i) => { if (!PT) return { x: (i - 2) * (cw + 28), y: 272 }; const r = Math.floor(i / 2); const x = i === 4 ? 0 : (i % 2 === 0 ? -250 : 250); return { x, y: -120 + r * 326 + 60 }; };
  const orb = { cx: 0, cy: PT ? -70 : -20, Rx: PT ? 380 : 760, Rz: PT ? 380 : 520 };
  return {
    update(t) {
      // background morph
      blA.setAttribute('d', blobPath(W * .2, H * .25, L(430, 420), 1, t)); blB.setAttribute('d', blobPath(W * .85, H * .8, L(470, 440), 4, t * .9));
      const beat = t >= DROP ? Math.exp(-((t * 2) % 1) * 5) : 0;
      blobsvg.style.transform = `scale(${1 + beat * .012})`;
      el.querySelector('.light-grid').style.backgroundPosition = `${t * 10}px ${t * 6}px`;
      // camera
      const c = kf(KF, t);
      const fl = Math.sin(t * 1.4) * 5;
      cam.style.transform = `translate3d(${c.ox}px,${c.oy + fl * c.s}px,0) rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg) scale(${c.s}) translate3d(${-c.fx}px,${-c.fy}px,0)`;
      // screen content
      const e = lap.els;
      const sOp = (im, o) => { im.style.opacity = clamp(o); };
      // worklist 10-16
      const workVis = t < 16.6 ? 1 : 0;
      sOp(e.work, 1); e.work.style.display = t < 16.7 ? 'block' : 'none';
      // intake 16 -> results 18
      const intakeIn = pr(t, 15.95, 16.5);
      e.intake.style.display = t >= 15.9 && t < 18.9 ? 'block' : 'none'; sOp(e.intake, intakeIn);
      const slide = pr(t, 17.0, 17.9, E.io3);
      e.intake.style.transform = `translateY(${-slide * 14}px) scale(${1 + slide * .02})`;
      e.intake.style.filter = `blur(${Math.sin(slide * Math.PI) * 3}px)`;
      e.intake2.style.display = 'none';
      // morph intake -> results (scan wipe)
      const mp = pr(t, 18.1, 18.95, E.io3);
      e.res.style.display = t >= 18.1 ? 'block' : 'none';
      e.res.style.clipPath = `inset(0 0 ${(1 - mp) * 100}% 0)`;
      e.res.style.filter = `blur(${(1 - mp) * 2}px)`;
      scan.style.display = mp > 0 && mp < 1 ? 'block' : 'none';
      scan.style.top = `${mp * 615 - 70}px`;
      // why
      const wp = pr(t, 26.2, 26.9);
      e.why.style.display = t >= 26.1 ? 'block' : 'none'; sOp(e.why, wp);
      // highlight ring on worklist
      const hlp = pr(t, 12.1, 12.5, E.out3) * (1 - pr(t, 13.9, 14.3));
      hl.style.opacity = hlp; hl.style.transform = `scale(${1 + Math.sin(t * 6) * .004})`;
      // worklist scan sweep during zoom
      const wsw = pr(t, 11.2, 12.3, E.io3);
      scan.style.display = (mp > 0 && mp < 1) || (wsw > 0 && wsw < 1 && t < 13) ? 'block' : 'none';
      if (t < 13) scan.style.top = `${wsw * 700 - 90}px`;
      // headline
      showWords(headL1.spans, t, 13.35, .07, .8); showWords(headL2.spans, t, 13.7, .06, .8);
      lab.style.opacity = pr(t, 13.3, 13.7) * (1 - pr(t, 15.6, 15.95)); lab.style.transform = `translateY(${(1 - pr(t, 13.3, 13.8, E.out3)) * 14}px)`;
      const hOut = pr(t, 15.55, 16.05, E.in3);
      [headL1, headL2].forEach(h => { h.el.style.opacity = 1 - hOut; h.el.style.transform = `translateY(${-hOut * 50}px)`; });
      // pill
      const pIn = pr(t, 16.0, 16.5, E.out3), pOut = pr(t, 26.0, 26.5, E.in3);
      pill.style.opacity = pIn * (1 - pOut); pill.style.transform = `translateY(${(1 - pIn) * -16}px)`;
      pill.querySelector('#stp1').style.opacity = t > 18.3 ? .4 : 1; pill.querySelector('#stp2').style.opacity = t > 18.3 ? 1 : .4;
      pill.querySelector('#stp2').style.color = t > 18.3 ? '#0B6BB0' : '';
      pill.querySelector('#stp1').style.color = t > 18.3 ? '' : '#0B6BB0';
      // cards
      cards.forEach((cd, i) => {
        const t0 = 18.95 + i * .3;
        const pop = pr(t, t0, t0 + .9, E.back);
        const vis = t >= t0 && t < 26.8;
        cd.d.style.display = vis ? 'block' : 'none';
        if (!vis) return;
        const th = (i / 5) * Math.PI * 2 + (t - 18.95) * 0.95 + .4;
        const ocx = orb.cx, ocy = orb.cy + (PT ? 0 : 0);
        const ox = ocx + orb.Rx * Math.sin(th), oz = orb.Rz * Math.cos(th) - 120, oy = ocy + 50 * Math.sin(th * 2 + i) - (PT ? 20 : 0);
        const row = rows3(i);
        const settle = pr(t, 22.9 + i * .07, 24.3 + i * .07, E.io3);
        const x = lerp(ox, row.x, settle), y = lerp(oy, row.y, settle), z = lerp(oz, 0, settle);
        const ry = lerp(-Math.sin(th) * 28, 0, settle), rx = lerp(0, 0, settle);
        const sc = lerp(PT ? .62 : .78, 1, settle) * lerp(.15, 1, pop);
        const exit = pr(t, 26.0 + i * .05, 26.7 + i * .05, E.in3);
        tf(cd.d, { x: lerp(x, x, 1), y: y + exit * (PT ? 700 : 600) + (settle >= 1 ? Math.sin(t * 1.6 + i) * 4 : 0), z, ry, rx, s: sc });
        cd.d.style.opacity = clamp(pop * 3) * (1 - exit);
        // inner anim
        const k = pr(t, t0 + .3, t0 + 1.4, E.out3);
        if (cd.viz === 'bars') cd.bars.forEach((b, j) => b.setAttribute('width', (+b.dataset.w * pr(t, t0 + .3 + j * .1, t0 + 1.2 + j * .1, E.out3)).toFixed(1)));
        if (cd.viz === 'arc') cd.a.setAttribute('stroke-dashoffset', (1 - .42 * k).toFixed(3));
        if (cd.viz === 'ring') cd.a.setAttribute('stroke-dasharray', `${(.31 * k).toFixed(3)} 1`);
        if (cd.viz === 'dots') cd.dots.forEach((dt, j) => dt.setAttribute('fill', j < 7 * k && j < 7 ? '#0B6BB0' : (j < 12 && j >= 7 ? '#dfe9f3' : '#dfe9f3')));
        if (cd.viz === 'range') { cd.r.setAttribute('x', (+cd.r.dataset.x + (1 - k) * 40).toFixed(1)); cd.r.setAttribute('width', (+cd.r.dataset.w * k).toFixed(1)); }
      });
      // why overlay
      const vp = pr(t, 28.4, 29.1, E.out3);
      veil.style.opacity = vp * (1 - pr(t, 32.2, 32.7)); veil.style.display = vp > 0 ? 'block' : 'none';
      const gp = pr(t, 28.7, 29.5, E.out5);
      wy.style.opacity = gp; wy.style.transform = `translateY(${(1 - gp) * 60}px) scale(${lerp(.96, 1, gp)})`;
      bars.forEach((b, i) => { const g = pr(t, 29.4 + i * .22, 30.3 + i * .22, E.expo); b.style.width = Math.abs(+b.dataset.v) * wscale * g + 'px'; });
      showWords(wcap1.spans, t, 29.2, .08, .8); showWords(wcap2.spans, t, 29.9, .07, .8);
      // worldA fades out only via next scene reveal
      lap.d.querySelector('.shadow3d').style.opacity = 1 - pr(t, 26, 27);
    }
  };
});

/* =====================================================================
   SCENE 6 — CLINICIAN DECIDES (32–37)
   ===================================================================== */
scene('decide', 32, 37.7, 30, (el) => {
  el.style.background = 'linear-gradient(150deg,#E8F5F3 0%,#E9F2FA 55%,#F6FAFD 100%)';
  mk('layer light-grid', el);
  const blobsvg = html(`<svg class="abs" width="${W}" height="${H}" style="left:0;top:0"><defs><linearGradient id="bl3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D9488" stop-opacity=".28"/><stop offset="1" stop-color="#0B6BB0" stop-opacity=".14"/></linearGradient></defs><path id="blC" fill="url(#bl3)"/></svg>`);
  el.appendChild(blobsvg); const blC = blobsvg.querySelector('#blC');
  const world = mk('', el, 'position:absolute;inset:0;perspective:2400px'); const cam = mk('cam3', world);
  const tab = buildTablet(cam, [['a', 'd_res_bottom.jpg']]);
  tab.els.a.style.cssText = 'position:absolute;width:1138px;left:-69px;top:0;height:auto';
  // focus ring & button highlight inside screen
  const btn = mk('', tab.scr, 'position:absolute;left:762px;top:421px;width:74px;height:32px;border-radius:8px;box-shadow:0 0 0 0 rgba(11,107,176,.5)');
  const cur = html('<svg class="abs" width="34" height="34" viewBox="0 0 24 24" style="z-index:5;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35))"><path d="M5 2l14 9-6.2 1.2L9.6 18.6z" fill="#fff" stroke="#0B2136" stroke-width="1.4" stroke-linejoin="round"/></svg>'); tab.scr.appendChild(cur);
  const ripple = mk('', tab.scr, 'position:absolute;width:20px;height:20px;border-radius:50%;border:3px solid #0B6BB0;opacity:0;margin:-10px 0 0 -10px');
  const hx = L(100, 70), hw = L(700, 940);
  const lab = mk('mono', el, `position:absolute;left:${hx}px;top:${L(300, 160)}px;font-size:${L(20, 22)}px;color:#0B6BB0`); lab.textContent = 'Review & sign-off';
  const h = words(el, 'Your clinicians always ~decide.', '', `position:absolute;left:${hx}px;top:${L(350, 215)}px;width:${hw}px;font:800 ${L(92, 112)}px/1.04 Inter;letter-spacing:-.04em;color:#0B2136`);
  const chk = html(`<div class="glass abs" style="width:${L(330, 330)}px;height:${L(330, 330)}px;border-radius:50%;display:grid;place-items:center;z-index:6;left:${L(1255 - 165, 540 - 165)}px;top:${L(540 - 165, 1130 - 165)}px">
   <svg viewBox="0 0 200 200" width="86%" height="86%"><defs><linearGradient id="ckg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B6BB0"/><stop offset="1" stop-color="#0D9488"/></linearGradient></defs>
   <circle cx="100" cy="100" r="86" fill="none" stroke="#dbe8f3" stroke-width="10"/>
   <circle class="ring" cx="100" cy="100" r="86" fill="none" stroke="url(#ckg)" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1" transform="rotate(-90 100 100)"/>
   <path class="tick" d="M58 104 L88 134 L144 72" fill="none" stroke="url(#ckg)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1"/></svg></div>`); el.appendChild(chk);
  const ring = chk.querySelector('.ring'), tick = chk.querySelector('.tick');
  const KF = L([
    { t: 31.9, s: .55, rx: 14, ry: -26, rz: 0, fx: 0, fy: 0, ox: 290, oy: 40 },
    { t: 33.0, s: .86, rx: 4, ry: -8, rz: 0, fx: 0, fy: 0, ox: 290, oy: 30 },
    { t: 34.6, s: .95, rx: 2, ry: -4, rz: 0, fx: 0, fy: 60, ox: 295, oy: 10 },
    { t: 37.7, s: 1.02, rx: 2, ry: -3, rz: 0, fx: 0, fy: 60, ox: 295, oy: 10 },
  ], [
    { t: 31.9, s: .5, rx: 14, ry: -26, rz: 0, fx: 0, fy: 0, ox: 0, oy: 330 },
    { t: 33.0, s: .95, rx: 4, ry: -8, rz: 0, fx: 0, fy: 0, ox: 0, oy: 340 },
    { t: 34.6, s: 1.0, rx: 2, ry: -4, rz: 0, fx: 0, fy: 40, ox: 0, oy: 330 },
    { t: 37.7, s: 1.04, rx: 2, ry: -3, rz: 0, fx: 0, fy: 40, ox: 0, oy: 330 },
  ]);
  return {
    update(t) {
      blC.setAttribute('d', blobPath(W * .8, H * .3, L(430, 420), 7, t * .8));
      el.querySelector('.light-grid').style.backgroundPosition = `${-t * 8}px ${t * 5}px`;
      const c = kf(KF, t);
      cam.style.transform = `translate3d(${c.ox}px,${c.oy + Math.sin(t * 1.3) * 6}px,0) rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg) scale(${c.s}) translate3d(${-c.fx}px,${-c.fy}px,0)`;
      const tin = pr(t, 32.0, 32.7, E.out5);
      tab.d.style.opacity = tin; tab.d.style.transform = `translateZ(${(1 - tin) * -600}px)`;
      // cursor
      const cp = pr(t, 33.2, 34.05, E.io3);
      cur.style.left = lerp(930, 786, cp) + 'px'; cur.style.top = lerp(610, 438, cp) + 'px'; cur.style.opacity = pr(t, 33.1, 33.3) * (1 - pr(t, 35.4, 35.7));
      cur.style.transform = `scale(${1 - .12 * pr(t, 34.0, 34.1) * (1 - pr(t, 34.12, 34.25))})`;
      const rp = pr(t, 34.08, 34.7, E.out3);
      ripple.style.left = '798px'; ripple.style.top = '438px'; ripple.style.opacity = rp > 0 && rp < 1 ? (1 - rp) : 0; ripple.style.transform = `scale(${1 + rp * 5})`;
      btn.style.boxShadow = `0 0 0 ${pr(t, 34.05, 34.5, E.out3) * 14}px rgba(11,107,176,${.25 * (1 - pr(t, 34.5, 35.2))})`;
      btn.style.background = `rgba(11,107,176,${.18 * pr(t, 34.05, 34.2) * (1 - pr(t, 35.2, 35.6))})`;
      // check
      const ci = pr(t, 34.2, 34.7, E.back);
      chk.style.opacity = ci * (1 - pr(t, 37.3, 37.7)); chk.style.transform = `scale(${lerp(.6, 1, ci)})`;
      ring.setAttribute('stroke-dashoffset', (1 - pr(t, 34.25, 34.95, E.io3)).toFixed(3));
      tick.setAttribute('stroke-dashoffset', (1 - pr(t, 34.85, 35.35, E.out3)).toFixed(3));
      lab.style.opacity = pr(t, 32.5, 32.9); lab.style.transform = `translateY(${(1 - pr(t, 32.5, 33, E.out3)) * 14}px)`;
      showWords(h.spans, t, 33.1, .12, .85);
    }
  };
});

/* =====================================================================
   SCENE 7 — ONE TEAM (37–44)
   ===================================================================== */
scene('team', 37, 44.7, 40, (el) => {
  el.style.background = 'linear-gradient(160deg,#F2F7FB,#E4EEF7)';
  mk('layer light-grid', el);
  const gx = L(60, 40), gt = L(110, 250), gw = W - gx * 2, gh = L(760, 1250), gap = L(24, 22);
  const cols = 2, rowsN = 2; const tw = (gw - gap) / 2, th = (gh - gap) / 2;
  const specs = [
    { label: 'Care teams', imgs: [['n_roster.jpg', .5, .5, 1], ['n_roster.jpg', .5, .62, 1.55], ['n_roster.jpg', .45, .28, 1.6]], from: 'L' },
    { label: 'Administrators', imgs: [['a_roster.jpg', .5, .5, 1], ['a_audit.jpg', .5, .5, 1], ['a_audit.jpg', .5, .6, 1.5], ['a_roster.jpg', .55, .55, 1.5]], from: 'T' },
    { label: 'Patients', imgs: [['d_discharge.jpg', .5, .5, 1], ['d_discharge.jpg', .5, .62, 1.45], ['d_discharge.jpg', .4, .3, 1.6]], from: 'B' },
    { label: 'Hospitals', imgs: [['o_fleet.jpg', .5, .5, 1], ['o_fleet.jpg', .5, .72, 1.5], ['o_fleet.jpg', .35, .3, 1.6]], from: 'R' },
  ];
  const tiles = specs.map((sp, i) => {
    const c = i % 2, r = Math.floor(i / 2);
    const x = gx + c * (tw + gap), y = gt + r * (th + gap);
    const d = mk('', el, `position:absolute;left:${x}px;top:${y}px;width:${tw}px;height:${th}px;border-radius:26px;overflow:hidden;background:#fff;box-shadow:0 40px 70px -30px rgba(11,33,54,.35),0 2px 8px rgba(11,33,54,.08);border:1px solid rgba(255,255,255,.9)`);
    const bar = mk('', d, 'position:absolute;left:0;right:0;top:0;height:30px;background:linear-gradient(#f6f9fc,#e9f0f6);border-bottom:1px solid #dbe5ee;z-index:3;display:flex;gap:8px;align-items:center;padding-left:16px');
    bar.innerHTML = '<i style="width:10px;height:10px;border-radius:50%;background:#c3d2e0"></i><i style="width:10px;height:10px;border-radius:50%;background:#c3d2e0"></i><i style="width:10px;height:10px;border-radius:50%;background:#c3d2e0"></i>';
    const ims = sp.imgs.map(im => { const e = new Image(); e.src = 'assets/ui/' + im[0]; e.style.cssText = `position:absolute;left:0;top:30px;width:${tw}px;height:auto;transform-origin:0 0`; d.appendChild(e); return e; });
    const lb = mk('mono', d, `position:absolute;left:18px;bottom:16px;padding:10px 18px;border-radius:999px;background:linear-gradient(90deg,#0B6BB0,#0D9488);color:#fff;font-size:${L(19, 18)}px;z-index:4;letter-spacing:.16em;box-shadow:0 10px 24px -10px rgba(11,107,176,.7)`);
    lb.textContent = sp.label;
    return { d, ims, sp, lb, x, y };
  });
  const cap = mk('glass', el, `position:absolute;left:50%;top:${L(938, 1700)}px;transform:translateX(-50%);padding:${L(18, 22)}px ${L(40, 34)}px;border-radius:999px;white-space:nowrap;font:600 ${L(32, 30)}px Inter;color:#0B2136;letter-spacing:-.01em;z-index:5`);
  cap.innerHTML = '<b class="gradL" style="font-weight:800">15 roles.</b> Each sees only what their job needs.';
  const ttl = words(el, 'One platform. ~One team.', '', `position:absolute;left:${gx}px;top:${L(28, 120)}px;font:800 ${L(54, 70)}px/1 Inter;letter-spacing:-.035em;color:#0B2136`);
  const starts = [37.0, 37.5, 38.0, 38.5];
  return {
    update(t) {
      el.querySelector('.light-grid').style.backgroundPosition = `${t * 12}px 0`;
      showWords(ttl.spans, t, 37.15, .08, .7);
      tiles.forEach((tl, i) => {
        const p = pr(t, starts[i], starts[i] + .6, E.out5);
        const dir = tl.sp.from;
        const dx = dir === 'L' ? -1 : dir === 'R' ? 1 : 0, dy = dir === 'T' ? -1 : dir === 'B' ? 1 : 0;
        const beat = t > 39 ? Math.exp(-((t * 2) % 1) * 6) : 0;
        tl.d.style.opacity = clamp(p * 2.5);
        tl.d.style.transform = `translate(${dx * (1 - p) * 700}px,${dy * (1 - p) * 500}px) scale(${(1 + beat * .012) * lerp(.9, 1, p)})`;
        tl.d.style.clipPath = `inset(0 ${(dir === 'L' ? 1 - p : 0) * 30}% 0 0 round 26px)`;
        // hard cuts on the beat: every 1.0s from 39.0 (offset by .5s per tile)
        const n = tl.ims.length;
        const t0c = 39 + i * .5;
        const step = t < t0c ? 0 : 1 + Math.floor((t - t0c) / 1.0);
        const active = step % n;
        const since = t < t0c ? 9 : (t - t0c) % 1.0;
        const punch = Math.exp(-since * 9);
        const ih = tw * 9 / 16, vh = th - 30;
        tl.ims.forEach((im, j) => {
          const spec = tl.sp.imgs[j];
          const k = spec[3];
          const on = j === active;
          im.style.opacity = on ? 1 : 0;
          if (!on) return;
          const kk = k * (1 + punch * .035) * (1 + (t - starts[i]) * .004);
          const tx = Math.min(0, Math.max(tw - tw * kk, tw / 2 - spec[1] * tw * kk));
          const ty = Math.min(0, Math.max(vh - ih * kk, vh / 2 - spec[2] * ih * kk));
          im.style.transform = `translate(${tx}px,${ty}px) scale(${kk})`;
        });
        const lp = pr(t, starts[i] + .35, starts[i] + .95, E.back);
        tl.lb.style.opacity = lp; tl.lb.style.transform = `translateY(${(1 - lp) * 20}px) scale(${lerp(.8, 1, lp)})`;
      });
      const cp = pr(t, 40.0, 40.7, E.out5);
      cap.style.opacity = cp; cap.style.transform = `translateX(-50%) translateY(${(1 - cp) * 40}px)`;
    }
  };
});

/* =====================================================================
   SCENE 8 — PATIENTS (44–51)
   ===================================================================== */
scene('patients', 44, 51.7, 50, (el) => {
  el.style.background = 'linear-gradient(150deg,#EAF6F4 0%,#E6F0F9 55%,#F4F9FD 100%)';
  mk('layer light-grid', el);
  const blobsvg = html(`<svg class="abs" width="${W}" height="${H}" style="left:0;top:0"><defs><linearGradient id="bl4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D9488" stop-opacity=".30"/><stop offset="1" stop-color="#0B6BB0" stop-opacity=".15"/></linearGradient></defs><path id="blD" fill="url(#bl4)"/><path id="blE" fill="url(#bl4)"/></svg>`);
  el.appendChild(blobsvg); const blD = blobsvg.querySelector('#blD'), blE = blobsvg.querySelector('#blE');
  const world = mk('', el, 'position:absolute;inset:0;perspective:2400px'); const cam = mk('cam3', world);
  const ph = buildPhone(cam);
  const hx = L(1020, 70), hw = L(780, 940);
  const lab = mk('mono', el, `position:absolute;left:${hx}px;top:${L(250, 140)}px;font-size:${L(20, 22)}px;color:#0B6BB0`); lab.textContent = 'Patients included';
  const l1 = words(el, '~Plain-language results.', '', `position:absolute;left:${hx}px;top:${L(300, 190)}px;width:${hw}px;font:800 ${L(76, 92)}px/1.05 Inter;letter-spacing:-.035em;color:#0B2136`);
  const l2 = words(el, 'English and Arabic.', '', `position:absolute;left:${hx}px;top:${L(300 + 170, 190 + 205)}px;width:${hw}px;font:800 ${L(76, 92)}px/1.05 Inter;letter-spacing:-.035em;color:#0B2136`);
  const l3 = words(el, 'Patients control who sees their record.', '', `position:absolute;left:${hx}px;top:${L(300 + 380, 190 + 450)}px;width:${L(700, 900)}px;font:600 ${L(44, 52)}px/1.2 Inter;letter-spacing:-.02em;color:#4a6073`);
  const toggle = mk('glass', el, `position:absolute;left:${hx}px;top:${L(300 + 300, 190 + 330)}px;padding:8px;border-radius:18px;display:flex;gap:6px;font:700 ${L(26, 28)}px Inter,"DejaVu Sans"`);
  toggle.innerHTML = '<span class="e" style="padding:10px 26px;border-radius:12px">EN</span><span class="a" style="padding:10px 26px;border-radius:12px">العربية</span><span class="mono" style="padding:14px 8px 0 12px;font-size:15px;color:#4a6073">RTL ⇄ LTR</span>';
  const KF = L([
    { t: 43.9, s: .5, rx: 6, ry: -50, rz: 0, fx: 0, fy: 0, ox: -470, oy: 90 },
    { t: 45.0, s: .92, rx: 3, ry: -14, rz: 0, fx: 0, fy: 0, ox: -470, oy: 10 },
    { t: 47.0, s: .94, rx: 2, ry: -8, rz: 0, fx: 0, fy: 0, ox: -470, oy: 10 },
    { t: 51.7, s: .98, rx: 2, ry: 8, rz: 0, fx: 0, fy: 0, ox: -470, oy: 10 },
  ], [
    { t: 43.9, s: .5, rx: 6, ry: -50, rz: 0, fx: 0, fy: 0, ox: 0, oy: 560 },
    { t: 45.0, s: .88, rx: 3, ry: -14, rz: 0, fx: 0, fy: 0, ox: 0, oy: 520 },
    { t: 47.0, s: .9, rx: 2, ry: -8, rz: 0, fx: 0, fy: 0, ox: 0, oy: 520 },
    { t: 51.7, s: .94, rx: 2, ry: 8, rz: 0, fx: 0, fy: 0, ox: 0, oy: 520 },
  ]);
  return {
    update(t) {
      blD.setAttribute('d', blobPath(W * .25, H * .2, L(420, 400), 3, t * .8)); blE.setAttribute('d', blobPath(W * .88, H * .85, L(380, 380), 9, t * .7));
      el.querySelector('.light-grid').style.backgroundPosition = `${-t * 9}px ${-t * 5}px`;
      const c = kf(KF, t);
      // flip around 47.4
      const fp = pr(t, 47.15, 48.05);
      let flip = 0, lang = 'en';
      if (fp > 0) { if (fp < .5) { flip = -90 * E.in3(fp * 2); lang = 'en'; } else { flip = 90 * (1 - E.out3((fp - .5) * 2)); lang = 'ar'; } }
      const scroll = t < 47.15 ? lerp(0, 330, E.io3(pr(t, 45.4, 47.1))) : lerp(0, 330, E.io3(pr(t, 48.3, 50.8)));
      setPhone(ph, lang, scroll);
      const pin = pr(t, 44.0, 44.8, E.out5);
      ph.d.style.opacity = pin;
      cam.style.transform = `translate3d(${c.ox}px,${c.oy + Math.sin(t * 1.3) * 6 + (1 - pin) * 200}px,0) rotateX(${c.rx}deg) rotateY(${c.ry + flip}deg) rotateZ(${c.rz}deg) scale(${c.s})`;
      lab.style.opacity = pr(t, 44.5, 44.9); lab.style.transform = `translateY(${(1 - pr(t, 44.5, 45, E.out3)) * 14}px)`;
      showWords(l1.spans, t, 44.75, .09, .8);
      showWords(l2.spans, t, 46.3, .09, .8);
      showWords(l3.spans, t, 48.6, .05, .8);
      const tg = pr(t, 46.3, 46.8, E.out3); toggle.style.opacity = tg; toggle.style.transform = `translateY(${(1 - tg) * 20}px)`;
      const ar = t >= 47.6;
      const eE = toggle.querySelector('.e'), eA = toggle.querySelector('.a');
      eE.style.cssText += `;background:${ar ? 'transparent' : '#fff'};color:${ar ? '#4a6073' : '#0B2136'};box-shadow:${ar ? 'none' : '0 2px 8px rgba(11,33,54,.15)'}`;
      eA.style.cssText += `;background:${ar ? '#fff' : 'transparent'};color:${ar ? '#0B2136' : '#4a6073'};box-shadow:${ar ? '0 2px 8px rgba(11,33,54,.15)' : 'none'}`;
    }
  };
});

/* =====================================================================
   SCENE 9 — TRUST (51–54.6)
   ===================================================================== */
scene('trust', 51, 55.0, 60, (el) => {
  el.style.background = 'radial-gradient(ellipse at 50% 40%,#123a5c 0%,#0B2136 60%,#06131f 100%)';
  const grid = mk('layer dark-grid', el);
  const glow = mk('', el, `position:absolute;left:${W / 2 - 800}px;top:${H / 2 - 500}px;width:1600px;height:1000px;border-radius:50%;background:radial-gradient(closest-side,rgba(13,148,136,.28),rgba(13,148,136,0))`);
  const ttl = words(el, 'Built for ~trust.', '', `position:absolute;left:0;width:${W}px;text-align:center;top:${L(180, 330)}px;font:800 ${L(86, 100)}px/1 Inter;letter-spacing:-.035em;color:#fff`);
  const items = [
    { t: 'Role-based access', s: 'Each person sees only what their job needs.', ic: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><circle cx="12" cy="10" r="2.2"/><path d="M12 12.4v4"/>' },
    { t: 'Full audit log', s: 'Every access and action, recorded.', ic: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>' },
    { t: 'Fairness by design', s: 'Checked across patient groups.', ic: '<path d="M12 4v16M6 20h12M4 8h16"/><path d="M4 8l-2 6a3 3 0 0 0 6 0zM20 8l-2 6a3 3 0 0 0 6 0z" transform="translate(-1 0)"/>' },
  ];
  const bw = L(500, 880), bh = L(430, 330), bg = L(48, 30);
  const bx0 = L((W - (bw * 3 + bg * 2)) / 2, (W - bw) / 2), by0 = L(360, 560);
  const badges = items.map((it, i) => {
    const x = L(bx0 + i * (bw + bg), bx0), y = L(by0, by0 + i * (bh + bg));
    const d = mk('glassD', el, `position:absolute;left:${x}px;top:${y}px;width:${bw}px;height:${bh}px;border-radius:36px;padding:${L(44, 40)}px;${PT ? 'display:flex;gap:36px;align-items:center' : ''}`);
    d.innerHTML = `<div class="ibox" style="width:${L(150, 140)}px;height:${L(150, 140)}px;flex:none;border-radius:44px;background:linear-gradient(135deg,#0B6BB0,#0D9488);display:grid;place-items:center;box-shadow:0 20px 50px -14px rgba(13,148,136,.6)">
      <svg viewBox="0 0 24 24" width="${L(84, 80)}" height="${L(84, 80)}" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${it.ic.replace(/<(path|rect|circle)/g, '<$1 pathLength="1" stroke-dasharray="1"')}</svg></div>
      <div><div style="font:800 ${L(42, 46)}px/1.1 Inter;letter-spacing:-.03em;margin-top:${L(34, 0)}px;color:#fff">${it.t}</div><div style="font:500 ${L(26, 28)}px/1.4 Inter;color:#a9c4da;margin-top:12px">${it.s}</div></div>`;
    const ring = mk('', el, `position:absolute;left:${x}px;top:${y}px;width:${bw}px;height:${bh}px;border-radius:36px;border:2px solid #5eead4;opacity:0;pointer-events:none`);
    return { d, ring, paths: [...d.querySelectorAll('svg *')], t0: 51.0 + i * 1.0 };
  });
  return {
    update(t) {
      grid.style.backgroundPosition = `${-t * 30}px 0`;
      showWords(ttl.spans, t, 51.0, .1, .8);
      const tout = pr(t, 54.3, 54.8, E.in3);
      ttl.el.style.opacity = 1 - tout;
      badges.forEach((b, i) => {
        const p = pr(t, b.t0, b.t0 + .75, E.back);
        const out = pr(t, 54.2 + i * .06, 54.8 + i * .06, E.in3);
        b.d.style.opacity = clamp(p * 3) * (1 - out);
        b.d.style.transform = `translateY(${(1 - p) * 120 + out * -80}px) scale(${lerp(.8, 1, p)})`;
        const rp = pr(t, b.t0 + .1, b.t0 + .9, E.out3);
        b.ring.style.opacity = rp > 0 && rp < 1 ? (1 - rp) * .8 : 0; b.ring.style.transform = `scale(${1 + rp * .12})`;
        b.paths.forEach(pt => pt.setAttribute('stroke-dashoffset', (1 - pr(t, b.t0 + .25, b.t0 + .95, E.io3)).toFixed(3)));
      });
      glow.style.transform = `scale(${1 + Math.sin(t * 2) * .03})`;
    }
  };
});

/* =====================================================================
   SCENE 10 — END CARD (54.5–60)
   ===================================================================== */
scene('end', 54.5, 61, 70, (el) => {
  el.style.background = 'radial-gradient(ellipse at 50% 45%,#12385a 0%,#0B2136 58%,#071827 100%)';
  const grid = mk('layer dark-grid', el);
  const world = mk('', el, 'position:absolute;inset:0;perspective:2400px'); const cam = mk('cam3', world);
  const g1 = mk('dev3d', cam), g2 = mk('dev3d', cam), g3 = mk('dev3d', cam);
  const lap = buildLaptop(g1, [['a', 'd_res_top.jpg']]); lap.d.style.transform = 'translateY(331px)';
  const tab = buildTablet(g2, [['a', 'd_res_bottom.jpg']]); tab.els.a.style.cssText = 'position:absolute;width:1138px;left:-69px;top:0;height:auto';
  const ph = buildPhone(g3); setPhone(ph, 'en', 0);
  lap.d.querySelector('.shadow3d').style.display = 'none';
  const cx = W / 2, cy = L(H / 2 - 100, H / 2 - 200);
  const lock = mk('', el, `position:absolute;left:${cx}px;top:${cy}px;width:0;height:0`);
  const T = L(210, 230);
  const tile = mk('', lock, `position:absolute;left:${-T / 2}px;top:${-T / 2}px;width:${T}px;height:${T}px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.5))`); tile.innerHTML = logoSVG(T, 'e1');
  const ring = mk('', el, `position:absolute;left:${cx - 150}px;top:${cy - 150}px;width:300px;height:300px;border-radius:50%;border:3px solid rgba(94,234,212,.9);opacity:0`);
  const wm = mk('', lock, `position:absolute;left:${L(-120, -230)}px;top:${L(-70, T / 2 + 36)}px;white-space:nowrap;${PT ? 'width:460px;text-align:center' : ''}`);
  wm.innerHTML = `<div style="font:800 ${L(120, 118)}px Inter;letter-spacing:-.035em;line-height:1">ESAP</div><div class="mono" style="font-size:${L(23, 22)}px;color:#7DB9E8;letter-spacing:.34em;margin-top:6px">Clinical AI</div>`;
  const tag = words(el, 'Decision support, ~not diagnosis.', '', `position:absolute;left:${L(260, 60)}px;width:${L(1400, 960)}px;text-align:center;top:${L(cy + 170, cy + 480)}px;font:800 ${L(86, 100)}px/1.06 Inter;letter-spacing:-.04em;color:#fff`);
  const cta = mk('', el, `position:absolute;left:50%;top:${L(cy + 370, cy + 850)}px;transform:translateX(-50%);padding:${L(26, 30)}px ${L(58, 56)}px;border-radius:999px;background:linear-gradient(90deg,#0B6BB0,#0D9488);font:700 ${L(38, 42)}px Inter;letter-spacing:-.01em;white-space:nowrap;box-shadow:0 30px 70px -20px rgba(13,148,136,.7),inset 0 1px 0 rgba(255,255,255,.35);overflow:hidden`);
  cta.innerHTML = `Book a demo at <b style="font-weight:800">care.esap.ai</b><span class="sh" style="position:absolute;top:0;bottom:0;width:90px;left:-120px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg)"></span>`;
  const svg = html(`<svg class="abs" width="${W}" height="${H}" style="left:0;top:0;overflow:visible"><defs><linearGradient id="eg3" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#0B6BB0" stop-opacity="0"/><stop offset=".25" stop-color="#0B6BB0"/><stop offset=".75" stop-color="#2dd4bf"/><stop offset="1" stop-color="#2dd4bf" stop-opacity="0"/></linearGradient><filter id="gl3" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path id="p3" fill="none" stroke="url(#eg3)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#gl3)" pathLength="1" stroke-dasharray="1 1"/></svg>`); el.appendChild(svg);
  const p3 = svg.querySelector('#p3'); const ey = H - L(50, 150);
  p3.setAttribute('d', ecgD(W, ey, .4, W * .9, W * .38, 0));
  const place = {
    lap: L({ x: 0, y: 0, z: 0, ry: 0 }, { x: 0, y: 0, z: 0, ry: 0 }),
    tab: L({ x: -800, y: 270, z: 0, ry: 20, sc: .8 }, { x: -380, y: 440, z: 140, ry: 20, sc: .8 }),
    ph: L({ x: 800, y: 60, z: 60, ry: -18, sc: .92 }, { x: 420, y: -400, z: 260, ry: -18, sc: .9 }),
  };
  const KF = L([
    { t: 54.45, s: .9, rx: 8, ry: -14, rz: 0, fx: 0, fy: 0, ox: 0, oy: 0 },
    { t: 55.2, s: .8, rx: 8, ry: -8, rz: 0, fx: 0, fy: 0, ox: 0, oy: 0 },
    { t: 56.4, s: .56, rx: 6, ry: 6, rz: 0, fx: 0, fy: 0, ox: 0, oy: -20 },
    { t: 57.2, s: .56, rx: 6, ry: 6, rz: 0, fx: 0, fy: 0, ox: 0, oy: -20 },
  ], [
    { t: 54.45, s: .9, rx: 8, ry: -14, rz: 0, fx: 0, fy: 0, ox: 0, oy: 0 },
    { t: 55.2, s: .78, rx: 8, ry: -8, rz: 0, fx: 0, fy: 0, ox: 0, oy: 0 },
    { t: 56.4, s: .44, rx: 6, ry: 6, rz: 0, fx: 0, fy: 0, ox: 0, oy: -40 },
    { t: 57.2, s: .44, rx: 6, ry: 6, rz: 0, fx: 0, fy: 0, ox: 0, oy: -40 },
  ]);
  return {
    update(t) {
      grid.style.backgroundPosition = `${-t * 10}px ${t * 4}px`;
      const c = kf(KF, t);
      cam.style.transform = `translate3d(${c.ox}px,${c.oy}px,0) rotateX(${c.rx}deg) rotateY(${c.ry}deg) scale(${c.s})`;
      // devices pop in (54.5–55.1), collapse (56.3–57.2)
      const coll = pr(t, 56.3, 57.15, E.inBack);
      const pos = (g, pl, k, delay) => {
        const pin = pr(t, 54.5 + delay, 55.15 + delay, E.back);
        const cx2 = lerp(pl.x, 0, coll), cy2 = lerp(pl.y, 0, coll), cz = lerp(pl.z, 0, coll);
        g.style.transform = `translate3d(${cx2}px,${cy2}px,${cz}px) rotateY(${pl.ry * (1 - coll) + coll * 540}deg) rotateZ(${coll * -40}deg) scale(${Math.max(.0001, (pl.sc || 1) * pin * (1 - coll * .985))})`;
        g.style.opacity = clamp(pin * 3) * (1 - pr(t, 57.0, 57.2));
      };
      pos(g1, place.lap, 1, 0); pos(g2, place.tab, 1, .1); pos(g3, place.ph, 1, .2);
      // logo
      const tp = pr(t, 56.95, 57.55, E.back);
      tile.style.transform = `scale(${tp})`; tile.style.opacity = tp > 0 ? 1 : 0;
      tile.querySelector('.le').setAttribute('stroke-dashoffset', (1 - pr(t, 57.2, 57.7, E.io3)).toFixed(3));
      const rp = pr(t, 56.95, 57.8, E.out3); ring.style.opacity = rp > 0 && rp < 1 ? (1 - rp) * .9 : 0; ring.style.transform = `scale(${lerp(.5, 2.6, rp)})`;
      const lt = pr(t, 57.5, 58.2, E.io5);
      lock.style.transform = `translateX(${-(L(0, 0)) * lt}px) translateY(0px)`;
      // wordmark appears beside tile (landscape: shift tile left)
      const wP = pr(t, 57.6, 58.2, E.expo);
      if (!PT) { tile.style.transform = `translateX(${lerp(0, -270, E.io5(pr(t, 57.55, 58.15)))}px) scale(${tp})`; }
      wm.style.opacity = pr(t, 57.7, 58.1); wm.style.transform = `translateY(${(1 - wP) * 30}px)`;
      showWords(tag.spans, t, 58.1, .1, .8);
      const cp = pr(t, 58.6, 59.2, E.back); cta.style.opacity = clamp(cp * 3); cta.style.transform = `translateX(-50%) translateY(${(1 - cp) * 40}px) scale(${lerp(.9, 1, cp)})`;
      cta.querySelector('.sh').style.left = lerp(-120, cta.offsetWidth + 120, pr(t, 59.0, 59.7, E.io3)) + 'px';
      p3.setAttribute('stroke-dashoffset', (1 - pr(t, 57.8, 59.4, E.io3)).toFixed(3));
      p3.style.opacity = pr(t, 57.8, 58.2);
    }
  };
});

/* =====================================================================
   seek
   ===================================================================== */
function seek(t) {
  scenes.forEach((s, idx) => {
    const vis = t >= s.a - 0.0001 && t < s.b;
    s.el.style.display = vis ? 'block' : 'none';
    if (!vis) return;
    // transition reveal
    let rp = 1;
    const kind = s.name;
    if (idx > 0) {
      const dur = kind === 'worldA' ? .55 : .7;
      rp = pr(t, s.a, s.a + dur, E.io3);
    }
    s.update(t);
    if (rp < 1) {
      if (kind === 'worldA') { const cyy = H * L(.87, .76); s.el.style.clipPath = `circle(${Math.max(0, E.in3(pr(t, 9.72, 10.15))) * Math.hypot(W, H) * 1.05}px at ${W / 2}px ${cyy}px)`; }
      else if (kind === 'decide') s.el.style.clipPath = `inset(0 ${(1 - rp) * 100}% 0 0)`;
      else if (kind === 'team') s.el.style.clipPath = `polygon(0 0,${rp * 130}% 0,${rp * 130 - 30}% 100%,0 100%)`;
      else if (kind === 'patients') s.el.style.clipPath = `inset(${(1 - rp) * 100}% 0 0 0)`;
      else if (kind === 'trust') s.el.style.clipPath = `circle(${rp * Math.hypot(W, H)}px at ${W}px ${H}px)`;
      else if (kind === 'end') s.el.style.clipPath = `circle(${rp * Math.hypot(W, H)}px at ${W / 2}px ${H / 2}px)`;
      else s.el.style.clipPath = 'none';
    } else s.el.style.clipPath = 'none';
  });
  // worldA must be revealed at 9.72 (before its own start): handled by extending visibility
  updateSweep(t);
  // flash on drop
  flash.style.opacity = t >= 9.9 && t < 10.6 ? (t < 10.0 ? pr(t, 9.9, 10.0) * .95 : (1 - pr(t, 10.0, 10.6, E.out3)) * .95) : 0;
  // demo label
  const showDemo = (t >= 10.3 && t < 51.0) || (t >= 54.6 && t < 56.9);
  demo.style.opacity = showDemo ? 1 : 0;
  const dark = (t >= 54.6) || (t >= 51 && t < 54.6);
  demo.className = 'mono ' + (dark ? 'd' : 'l');
  // beat vignette pulse
  vignette.style.opacity = t >= DROP ? 1 - Math.exp(-((t * 2) % 1) * 4) * .35 : 1;
}
// worldA starts being visible 0.35s earlier so the marker-circle reveal can run on top of the problem scene
scenes.find(s => s.name === 'worldA').a = 9.7;
scenes.find(s => s.name === 'problem').b = 10.2;

window.seek = seek;
window.READY = (async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(im => im.decode ? im.decode().catch(() => { }) : Promise.resolve()));
  seek(0);
  return true;
})();
