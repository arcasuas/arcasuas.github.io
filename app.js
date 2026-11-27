(function () {
  'use strict';

  // UI fixtures only. These are synthetic marketing examples, not an endurance model.
  const conditions = Object.freeze({
    nominal: { label: 'Nominal', wind: '7 mph', temperature: '64°F', rangeAt74: 14.2, initialCharge: 74 },
    headwind: { label: 'Headwind', wind: '24 mph', temperature: '64°F', rangeAt74: 9.1, initialCharge: 74 },
    cold: { label: 'Cold weather', wind: '7 mph', temperature: '23°F', rangeAt74: 10.5, initialCharge: 74 },
    low: { label: 'Low energy', wind: '7 mph', temperature: '64°F', rangeAt74: 14.2, initialCharge: 32 }
  });

  function getDisplay(physicalCharge, conditionKey) {
    const numeric = Number(physicalCharge);
    const physical = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
    const condition = conditions[conditionKey] || conditions.nominal;
    const usableFraction = Math.max(0, physical - 20) / 80;
    const usable = Math.round(usableFraction * 100);
    // Deliberately simple interpolation between fictional UI fixture values.
    const range = (Math.max(0, physical - 20) / 54 * condition.rangeAt74).toFixed(1);
    const status = physical <= 20 ? 'reserve' : usableFraction <= 0.2 ? 'low' : 'normal';
    return { physical, usable, range, status, condition, fill: Math.max(0, physical - 20) };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { getDisplay, conditions };
  if (typeof document === 'undefined') return;

  const byId = (id) => document.getElementById(id);
  const simulator = byId('simulator');
  const slider = byId('charge-slider');
  const scenarioButtons = [...document.querySelectorAll('[data-scenario]')];
  let scenario = 'nominal';

  function renderDisplay() {
    const display = getDisplay(slider.value, scenario);
    byId('battery-value').textContent = display.usable;
    byId('range-value').textContent = display.range;
    byId('raw-charge').textContent = display.physical;
    byId('charge-output').textContent = display.physical + '%';
    byId('energy-fill').style.width = display.fill + '%';
    byId('battery-meter').setAttribute('aria-valuenow', String(display.physical));
    byId('battery-meter').setAttribute('aria-valuetext', display.physical + '% physical charge; ' + display.usable + '% usable mission energy');
    byId('wind-value').textContent = display.condition.wind;
    byId('temperature-value').textContent = display.condition.temperature;
    byId('condition-value').textContent = display.condition.label;
    simulator.classList.toggle('is-low', display.status !== 'normal');

    const notices = {
      normal: { status: 'Energy available', title: 'Energy available for flight', description: 'Your physical reserve is excluded from the usable estimate.', code: 'NORMAL', icon: '#i-check' },
      low: { status: 'Low mission energy', title: 'Return to base', description: 'Mission energy is low. The 20% physical reserve remains protected.', code: 'RETURN', icon: '#i-alert' },
      reserve: { status: 'Reserve reached', title: 'No mission energy remaining', description: 'Physical charge is at or below the protected 20% reserve.', code: 'RESERVE', icon: '#i-alert' }
    };
    const notice = notices[display.status];
    byId('flight-status').textContent = notice.status;
    byId('alert-title').textContent = notice.title;
    byId('alert-description').textContent = notice.description;
    byId('alert-code').textContent = notice.code;
    byId('alert-icon').querySelector('use').setAttribute('href', notice.icon);
  }

  function selectScenario(key) {
    if (!conditions[key]) return;
    scenario = key;
    slider.value = conditions[key].initialCharge;
    scenarioButtons.forEach((button) => {
      const selected = button.dataset.scenario === key;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    renderDisplay();
  }

  scenarioButtons.forEach((button) => button.addEventListener('click', () => selectScenario(button.dataset.scenario)));
  slider.addEventListener('input', renderDisplay);
  document.querySelectorAll('[data-reserve-demo]').forEach((link) => link.addEventListener('click', () => selectScenario('low')));
  renderDisplay();

  const sky = byId('hero-sky');
  if (sky && sky.getContext) {
    const hero = sky.parentElement;
    const ctx = sky.getContext('2d');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Ursa Minor, the Little Bear, from real right ascension and declination (degrees)
    const catalog = [[37.95, 89.264, 2.0], [263.05, 86.586, 4.4], [251.49, 82.037, 4.2], [236.01, 77.795, 4.3], [222.68, 74.156, 2.1], [230.18, 71.834, 3.0], [244.38, 75.755, 5.0]];
    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]];
    const raw = catalog.map(([ra, dec]) => { const r = 90 - dec, t = ra * Math.PI / 180; return { x: r * Math.sin(t), y: r * Math.cos(t) }; });
    const bowl = [3, 4, 5, 6].reduce((p, i) => ({ x: p.x + raw[i].x / 4, y: p.y + raw[i].y / 4 }), { x: 0, y: 0 });
    const turn = -0.42 - Math.atan2(raw[0].y - bowl.y, raw[0].x - bowl.x);
    const shape = raw.map((p) => ({ x: p.x * Math.cos(turn) - p.y * Math.sin(turn), y: p.x * Math.sin(turn) + p.y * Math.cos(turn) }));
    const minX = Math.min(...shape.map((p) => p.x)), maxX = Math.max(...shape.map((p) => p.x));
    const minY = Math.min(...shape.map((p) => p.y)), maxY = Math.max(...shape.map((p) => p.y));
    let seed = 11;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    let w = 0, h = 0, dpr = 1, small = false, stars = [], field = [], ridges = [], drones = [], hover = false, running = false, visible = true;
    let tx = 0, ty = 0, cx = 0, cy = 0, last = performance.now();
    let fleet = null, fleetOff = false, open = null;
    const born = performance.now();

    function ridge(base, amp, seedShift) {
      const pts = [], n = 48, ph = [rand() * 6, rand() * 6, rand() * 6];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const y = base - amp * (0.55 * Math.sin(u * 5.2 + ph[0] + seedShift) + 0.3 * Math.sin(u * 11.7 + ph[1]) + 0.15 * Math.sin(u * 23 + ph[2]));
        pts.push([u, y]);
      }
      return pts;
    }

    function layout() {
      const box = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.width; h = box.height; small = w < 761;
      sky.width = Math.round(w * dpr); sky.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed = 11;
      const count = Math.min(420, Math.round(w * h / 3600));
      field = Array.from({ length: count }, () => {
        const bright = rand() < 0.06;
        return { x: rand(), y: Math.pow(rand(), 1.25) * 0.82, r: bright ? 1.1 + rand() * 0.7 : 0.35 + rand() * 0.8, a: bright ? 0.75 + rand() * 0.25 : 0.25 + rand() * 0.55, s: 0.5 + rand() * 2.2, p: rand() * 6.28, bright };
      });
      ridges = [ridge(small ? 0.86 : 0.83, small ? 0.035 : 0.05, 0), ridge(small ? 0.92 : 0.9, small ? 0.03 : 0.04, 2)];
      const band = small ? [0.68, 0.82] : [0.52, 0.76];
      const kinds = small ? ['wing', 'quad', 'wing', 'quad', 'wing'] : ['wing', 'quad', 'wing', 'wing', 'quad', 'wing', 'quad'];
      drones = kinds.map((kind, i) => {
        const depth = 0.5 + rand() * 0.55;
        const dir = rand() < 0.5 ? -1 : 1;
        const lo = small ? 0 : 0.4;
        return { kind, depth, dir, x: (lo + rand() * (1 - lo)) * w, y: (band[0] + (band[1] - band[0]) * (i + rand() * 0.8) / kinds.length) * h,
          speed: (kind === 'wing' ? 16 + rand() * 22 : 5 + rand() * 7) * depth * (small ? 0.7 : 1), phase: rand() * 6.28 };
      });
      // keep the constellation in open sky, clear of the headline and labels
      const blocks = [];
      const add = (r) => { if (r.width && r.height) blocks.push({ l: r.left - box.left - 14, t: r.top - box.top - 14, r: r.right - box.left + 14, b: r.bottom - box.top + 14 }); };
      hero.querySelectorAll('.hero-content .eyebrow, .hero h1, .hero-description').forEach((el) => { const range = document.createRange(); range.selectNodeContents(el); [...range.getClientRects()].forEach(add); });
      hero.querySelectorAll('.aircraft-tag').forEach((el) => add(el.getBoundingClientRect()));
      const title = hero.querySelector('h1');
      const titleTop = title ? title.getBoundingClientRect().top - box.top : h * 0.2;
      const clear = (a) => blocks.every((k) => a.x1 * w < k.l || a.x0 * w > k.r || a.y1 * h < k.t || a.y0 * h > k.b);
      const options = small ? [{ x0: 0.54, x1: 0.85, y0: 0.03, y1: 0.078 }] : [
        { x0: 0.535, x1: 0.79, y0: 0.1, y1: 0.36 },
        { x0: 0.56, x1: 0.84, y0: 0.035, y1: Math.max(0.12, (titleTop - 20) / h) },
        { x0: 0.46, x1: 0.8, y0: 0.03, y1: Math.max(0.11, (titleTop - 20) / h) }
      ];
      const area = options.find(clear) || options[options.length - 1];
      const bw = (area.x1 - area.x0) * w, bh = (area.y1 - area.y0) * h;
      const k = Math.min(bw / (maxX - minX), bh / (maxY - minY));
      const ox = area.x0 * w + (bw - (maxX - minX) * k) / 2, oy = area.y0 * h + (bh - (maxY - minY) * k) / 2;
      stars = shape.map((p, i) => ({ x: ox + (p.x - minX) * k, y: oy + (p.y - minY) * k, mag: catalog[i][2] }));
      // open band for the fleet, under the headline and clear of the copy
      const reach = small ? 0 : w * 0.38;
      let floor = 0;
      const rects = [];
      hero.querySelectorAll('.hero-content > *').forEach((el) => {
        if (el.children.length) [...el.children].forEach((c) => rects.push(c.getBoundingClientRect()));
        else { const range = document.createRange(); range.selectNodeContents(el); rects.push(...range.getClientRects()); }
      });
      hero.querySelectorAll('.aircraft-tag').forEach((el) => rects.push(el.getBoundingClientRect()));
      rects.forEach((r) => { if (r.height && r.right - box.left > reach) floor = Math.max(floor, r.bottom - box.top); });
      const ground = h * (small ? 0.84 : 0.8);
      open = [Math.min(floor + (small ? 30 : 34), ground - h * 0.14) / h, ground / h];
      if (fleet) fleet.resize(w, h, dpr, small, open);
    }

    function light(x, y, r, color, alpha) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, color.replace('A', alpha)); g.addColorStop(1, color.replace('A', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 6.283); ctx.fill();
      ctx.fillStyle = color.replace('A', Math.min(1, alpha + 0.2)); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }

    function drawDrone(d, t) {
      const s = d.depth * (small ? 0.95 : 1.75);
      const x = d.x + cx * 26 * d.depth, y = d.y + Math.sin(t * (d.kind === 'quad' ? 1.3 : 0.5) + d.phase) * (d.kind === 'quad' ? 4 : 6) + cy * 14 * d.depth;
      const rim = `rgba(215,175,91,${0.3 + 0.35 * d.depth})`, body = '#1c1a17';
      ctx.save(); ctx.translate(x, y); ctx.scale(s * d.dir, s);
      ctx.lineJoin = 'round'; ctx.lineWidth = 0.9 / s;
      let tips;
      if (d.kind === 'wing') {
        // three-quarter view: the planform is tilted so the wing reads as a swept diagonal
        ctx.save(); ctx.transform(1, 0, 0.62, 0.3, 0, 0);
        ctx.beginPath();
        ctx.moveTo(30, 0); ctx.quadraticCurveTo(28, -4, 20, -4); ctx.lineTo(13, -4); ctx.lineTo(11, -44); ctx.lineTo(4, -44); ctx.lineTo(1, -4);
        ctx.lineTo(-19, -3); ctx.lineTo(-23, -14); ctx.lineTo(-27, -14); ctx.lineTo(-26, -2); ctx.lineTo(-29, 0);
        ctx.lineTo(-26, 2); ctx.lineTo(-27, 14); ctx.lineTo(-23, 14); ctx.lineTo(-19, 3); ctx.lineTo(1, 4); ctx.lineTo(4, 44); ctx.lineTo(11, 44); ctx.lineTo(13, 4); ctx.lineTo(20, 4); ctx.quadraticCurveTo(28, 4, 30, 0);
        ctx.closePath(); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = rim; ctx.stroke();
        ctx.restore();
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-24, -1); ctx.lineTo(-27, -9); ctx.lineTo(-22, -9); ctx.lineTo(-19, -1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rim; ctx.stroke();
        ctx.fillStyle = 'rgba(205,195,175,.07)'; ctx.beginPath(); ctx.ellipse(-30, 0, 1.6, 6, 0, 0, 6.283); ctx.fill();
        tips = [[7.5 - 27, -13.2], [7.5 + 27, 13.2], [-26, -9]];
      } else {
        const arms = [[-17, -17], [17, -17], [-17, 17], [17, 17]].map(([ax, ay]) => [ax + 0.62 * ay, 0.3 * ay]);
        ctx.strokeStyle = body; ctx.lineWidth = 3.2;
        ctx.beginPath(); arms.forEach(([ax, ay]) => { ctx.moveTo(0, 0); ctx.lineTo(ax, ay); }); ctx.stroke();
        ctx.lineWidth = 0.9 / s; ctx.strokeStyle = rim;
        ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-7, 11); ctx.moveTo(5, 4); ctx.lineTo(7, 11); ctx.moveTo(-9, 11); ctx.lineTo(-4, 11); ctx.moveTo(4, 11); ctx.lineTo(9, 11); ctx.stroke();
        ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-8, -4, 16, 8, 2.5) : ctx.rect(-8, -4, 16, 8); ctx.fill(); ctx.stroke();
        arms.forEach(([ax, ay]) => {
          ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - 3); ctx.stroke();
          ctx.fillStyle = 'rgba(215,205,185,.14)'; ctx.beginPath(); ctx.ellipse(ax, ay - 3.5, 11, 2.6, 0, 0, 6.283); ctx.fill();
          ctx.strokeStyle = rim; ctx.lineWidth = 0.7 / s; ctx.stroke();
        });
        tips = [arms[1], arms[3], [0, -4]];
      }
      ctx.restore();
      const pt = ([px, py]) => [x + px * s * d.dir, y + py * s];
      const [a, b, c] = tips.map(pt);
      const glow = 0.6 + 0.4 * d.depth;
      light(a[0], a[1], 0.7 * s + 0.6, 'rgba(255,70,60,A)', 0.8 * glow);
      light(b[0], b[1], 0.7 * s + 0.6, 'rgba(70,255,140,A)', 0.75 * glow);
      const strobe = still ? 0 : ((t * 0.75 + d.phase) % 1.4) < 0.09 ? 1 : 0;
      light(c[0], c[1], 0.6 * s + 0.6, 'rgba(255,255,255,A)', 0.3 + 0.7 * strobe);
    }

    function spike(x, y, len, alpha, angle) {
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const g = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
      g.addColorStop(0, 'rgba(255,236,190,0)'); g.addColorStop(0.5, `rgba(255,244,214,${alpha})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - dx * len, y - dy * len); ctx.lineTo(x + dx * len, y + dy * len); ctx.stroke();
    }

    function draw(now) {
      const t = still ? 0 : now / 1000;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#000000'); g.addColorStop(0.55, '#050505'); g.addColorStop(0.8, '#0e0d0b'); g.addColorStop(1, '#000000');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.72, h * 0.86, 0, w * 0.72, h * 0.86, Math.max(w, h) * 0.62);
      glow.addColorStop(0, 'rgba(215,175,91,.24)'); glow.addColorStop(0.45, 'rgba(215,175,91,.07)'); glow.addColorStop(1, 'rgba(215,175,91,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      // small background stars
      for (const s of field) {
        const tw = still ? 1 : 0.55 + 0.45 * Math.sin(t * s.s + s.p);
        const x = s.x * w + cx * 6, y = s.y * h + cy * 6;
        ctx.fillStyle = `rgba(245,240,230,${s.a * tw})`;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
        if (s.bright) { ctx.fillStyle = `rgba(245,240,230,${0.12 * tw})`; ctx.beginPath(); ctx.arc(x, y, s.r * 3.2, 0, 6.283); ctx.fill(); }
      }
      // drones: lit 3D models once three.js is ready, the drawn fleet only if WebGL is unavailable
      if (fleet) fleet.frame(t, still ? 0 : dt, cx, cy);
      else if (fleetOff) drones.sort((a, b) => a.depth - b.depth).forEach((d) => {
        const pad = 90, lo = small ? -pad : w * 0.36;
        if (!still) {
          d.x += d.speed * d.dir * dt;
          if (d.dir > 0 && d.x > w + pad) d.x = lo;
          if (d.dir < 0 && d.x < lo) d.x = w + pad;
        }
        ctx.globalAlpha = small ? 1 : Math.max(0, Math.min(1, (d.x - w * 0.38) / (w * 0.12)));
        if (ctx.globalAlpha > 0) drawDrone(d, t);
        ctx.globalAlpha = 1;
      });
      // ridgelines
      ridges.forEach((pts, i) => {
        ctx.beginPath(); ctx.moveTo(0, h);
        pts.forEach(([u, y]) => ctx.lineTo(u * w + cx * (4 + i * 6), y * h));
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = i ? '#030303' : '#0a0908'; ctx.fill();
        ctx.beginPath(); pts.forEach(([u, y], j) => (j ? ctx.lineTo : ctx.moveTo).call(ctx, u * w + cx * (4 + i * 6), y * h));
        ctx.strokeStyle = i ? 'rgba(215,175,91,.10)' : 'rgba(215,175,91,.18)'; ctx.lineWidth = 1; ctx.stroke();
      });
      // keep the copy readable
      if (small) {
        const v = ctx.createLinearGradient(0, 0, 0, h);
        v.addColorStop(0, 'rgba(0,0,0,.15)'); v.addColorStop(0.12, 'rgba(0,0,0,.55)'); v.addColorStop(0.6, 'rgba(0,0,0,.45)'); v.addColorStop(0.72, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
      } else {
        const s = ctx.createLinearGradient(0, 0, w, 0);
        s.addColorStop(0, 'rgba(0,0,0,.78)'); s.addColorStop(0.38, 'rgba(0,0,0,.42)'); s.addColorStop(0.72, 'rgba(0,0,0,.05)'); s.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
        const b = ctx.createLinearGradient(0, h * 0.7, 0, h);
        b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(1, 'rgba(0,0,0,.9)');
        ctx.fillStyle = b; ctx.fillRect(0, h * 0.7, w, h * 0.3);
      }
      // Ursa Minor
      const grow = still ? 1 : Math.min(1, (now - born) / 1900);
      const pts = stars.map((s) => ({ x: s.x + cx * 14, y: s.y + cy * 14 }));
      ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(232,196,120,.72)';
      links.forEach(([a, b], i) => {
        const part = Math.max(0, Math.min(1, grow * links.length - i));
        if (!part) return;
        ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[a].x + (pts[b].x - pts[a].x) * part, pts[a].y + (pts[b].y - pts[a].y) * part); ctx.stroke();
      });
      stars.forEach((s, i) => {
        if (!i) return;
        const p = pts[i], r = Math.max(2.1, 3.9 - s.mag * 0.4) * (small ? 0.72 : 1), spread = small ? 3.4 : 6;
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * spread);
        halo.addColorStop(0, 'rgba(250,244,230,.55)'); halo.addColorStop(1, 'rgba(250,244,230,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, p.y, r * spread, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fbf7ee'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      });
      const P = pts[0];
      const pulse = still ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.6);
      const big = (small ? 0.55 : 1) * (hover ? 1.18 : 1);
      const halo = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, (46 + pulse * 16) * big);
      halo.addColorStop(0, `rgba(255,226,150,${0.7 + pulse * 0.2})`); halo.addColorStop(0.25, 'rgba(215,175,91,.35)'); halo.addColorStop(1, 'rgba(215,175,91,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(P.x, P.y, (62 + pulse * 16) * big, 0, 6.283); ctx.fill();
      spike(P.x, P.y, (30 + pulse * 12) * big, 0.95, 0); spike(P.x, P.y, (30 + pulse * 12) * big, 0.95, Math.PI / 2);
      spike(P.x, P.y, (12 + pulse * 5) * big, 0.55, Math.PI / 4); spike(P.x, P.y, (12 + pulse * 5) * big, 0.55, -Math.PI / 4);
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(P.x, P.y, 4.6 * (small ? 0.8 : 1), 0, 6.283); ctx.fill();
      ctx.textBaseline = 'middle';
      ctx.font = `${small ? 9 : 12}px ArcasMono, "Courier New", monospace`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = small ? '1px' : '2px';
      ctx.fillStyle = 'rgba(232,196,120,1)';
      if (small) { ctx.textAlign = 'right'; ctx.fillText('POLARIS', P.x - 16, P.y - 10); ctx.textAlign = 'left'; }
      else ctx.fillText('POLARIS', P.x + 22, P.y - 1);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }

    function loop(now) { if (!running) return; draw(now); requestAnimationFrame(loop); }
    function start() { if (still || running || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
    function stop() { running = false; }
    function onPolaris(e) {
      if (!stars.length) return false;
      const box = hero.getBoundingClientRect();
      return Math.hypot(stars[0].x + cx * 14 - (e.clientX - box.left), stars[0].y + cy * 14 - (e.clientY - box.top)) < 24;
    }
    function track(e) {
      const box = hero.getBoundingClientRect();
      const x = e.clientX - box.left, y = e.clientY - box.top;
      if (x >= 0 && y >= 0 && x <= w && y <= h) { tx = x / w - 0.5; ty = y / h - 0.5; }
      const on = onPolaris(e);
      if (on !== hover) { hover = on; hero.classList.toggle('sky-pointer', on); }
      if (still) draw(performance.now());
    }

    layout(); draw(performance.now()); start();
    setTimeout(() => { layout(); draw(performance.now()); }, 1300);
    // realistic drones: three.js from a CDN, with the drawn fleet as the fallback
    const webgl = (() => { try { const gl = document.createElement('canvas').getContext('webgl2'); const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return !!gl; } catch (e) { return false; } })();
    if (!webgl) fleetOff = true;
    else {
      const give = setTimeout(() => { if (!fleet) { fleetOff = true; draw(performance.now()); } }, 8000);
      const load = () => import('https://cdn.jsdelivr.net/npm/three@0.187.0/+esm')
        .catch(() => import('https://unpkg.com/three@0.187.0/build/three.module.js'))
        .then((THREE) => import('./fleet.js?v=20261127a').then((m) => {
          const made = m.createFleet(THREE);
          made.canvas.addEventListener('webglcontextlost', () => { fleet = null; fleetOff = true; made.canvas.remove(); });
          made.resize(w, h, dpr, small, open);
          sky.after(made.canvas);
          fleet = made; fleetOff = false; clearTimeout(give); draw(performance.now());
          requestAnimationFrame(() => made.show());
        }))
        .catch(() => { fleetOff = true; clearTimeout(give); draw(performance.now()); });
      if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1200 }); else setTimeout(load, 300);
    }
    window.addEventListener('resize', () => { layout(); draw(performance.now()); });
    window.addEventListener('pointermove', track, { passive: true });
    hero.addEventListener('click', (e) => {
      if (!onPolaris(e)) return;
      const target = byId('technology');
      if (target) target.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
    });
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); draw(performance.now()); });
  }

  const inputContent = {
    battery: { number: '01', kicker: 'Start with the pack.', description: 'Voltage, current, cell readings, and temperature come straight from the battery pack. They show the energy on board right now and set the baseline for every estimate.', path: 'M100 65 240 130' },
    controller: { number: '02', kicker: 'Read how the aircraft is flying.', description: 'Airspeed, attitude, and GPS from the flight controller show how hard the aircraft is working. Polaris uses the telemetry already on board, with no added sensors.', path: 'M460 56 354 122' },
    registry: { number: '03', kicker: 'Every pack has a history.', description: 'Each pack is tracked by ID, charge cycles, capacity, and state of health. After every landing, measured capacity updates its record, so the estimate learns how that specific pack ages.', path: 'M150 208 248 137' },
    mission: { number: '04', kicker: 'Price the task before you take it.', description: 'The route, the assigned task, and the protected reserve define what the next leg will cost. Polaris weighs that cost against the energy left to show whether the aircraft can finish the task and still get home.', path: 'M508 160 352 137' },
    weather: { number: '05', kicker: 'Conditions change. Energy changes.', description: 'Wind and temperature change both flight demand and battery behavior. They belong in the estimate, not just in the preflight briefing.', path: 'M354 218 318 158' }
  };
  const inputTabs = [...document.querySelectorAll('[data-input]')];

  function selectInput(tab) {
    const key = tab.dataset.input;
    const content = inputContent[key];
    inputTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    byId('context-panel').setAttribute('aria-labelledby', tab.id);
    byId('context-number').textContent = content.number;
    byId('context-kicker').textContent = content.kicker;
    byId('context-description').textContent = content.description;
    byId('active-model-line').setAttribute('d', content.path);
    document.querySelectorAll('[data-model-label]').forEach((label) => {
      label.style.color = label.dataset.modelLabel === key ? 'var(--gold)' : '#b3a07c';
    });
  }

  inputTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectInput(tab));
    tab.addEventListener('keydown', (event) => {
      let target;
      if (event.key === 'ArrowDown') target = (index + 1) % inputTabs.length;
      if (event.key === 'ArrowUp') target = (index + inputTabs.length - 1) % inputTabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = inputTabs.length - 1;
      if (target !== undefined) {
        event.preventDefault();
        selectInput(inputTabs[target]);
        inputTabs[target].focus();
      }
    });
  });

  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav = byId('mobile-nav');
  function setMenu(open) {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    mobileNav.hidden = !open;
  }
  menuToggle.addEventListener('click', () => setMenu(mobileNav.hidden));
  mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileNav.hidden) {
      setMenu(false);
      menuToggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!mobileNav.hidden && !mobileNav.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => { if (event.matches) setMenu(false); });

  const dialog = byId('contact-dialog');
  let contactOpener;
  document.querySelectorAll('[data-contact]').forEach((button) => button.addEventListener('click', () => {
    contactOpener = button;
    setMenu(false);
    dialog.showModal();
    document.body.classList.add('modal-open');
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (contactOpener && !contactOpener.closest('[hidden]')) contactOpener.focus();
    else menuToggle.focus();
  });

  const contactForm = byId('contact-form');
  if (contactForm) {
    const formStatus = contactForm.querySelector('.form-status');
    const formSubmit = contactForm.querySelector('button[type="submit"]');
    const setStatus = (text, kind) => {
      formStatus.textContent = text;
      formStatus.className = 'form-status' + (kind ? ' ' + kind : '');
    };
    const sentText = 'Thanks. Your message has been sent and we will reply by email.';
    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fields = new FormData(contactForm);
      if (fields.get('company')) {
        contactForm.reset();
        setStatus(sentText, 'success');
        return;
      }
      formSubmit.disabled = true;
      setStatus('Sending...');
      try {
        const response = await fetch('https://formsubmit.co/ajax/spandey@arcasuas.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: fields.get('name'),
            email: fields.get('email'),
            message: fields.get('message'),
            _subject: 'New message from arcasuas.com',
            _template: 'table',
            _captcha: 'false'
          })
        });
        const result = await response.json().catch(() => ({}));
        const delivered = response.ok && String(result.success) === 'true';
        const awaitingActivation = /activat/i.test(String(result.message || ''));
        if (!delivered && !awaitingActivation) throw new Error(result.message || 'HTTP ' + response.status);
        contactForm.reset();
        setStatus(sentText, 'success');
      } catch (error) {
        setStatus('Sorry, your message could not be sent. Please email spandey@arcasuas.com directly.', 'error');
      } finally {
        formSubmit.disabled = false;
      }
    });
    dialog.addEventListener('close', () => setStatus(''));
  }

  if ('IntersectionObserver' in window) {
    const navLinks = [...document.querySelectorAll('.desktop-nav a')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const selected = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('active', selected);
          if (selected) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    ['technology', 'demo', 'mission', 'discovery', 'team'].forEach((id) => observer.observe(byId(id)));
  }
})();
