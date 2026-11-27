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
    let w = 0, h = 0, dpr = 1, small = false, stars = [], field = [], ridges = [], hover = false, running = false, visible = true;
    let tx = 0, ty = 0, cx = 0, cy = 0, last = performance.now(), open = null;
    const born = performance.now();

    // Real UAS swarm, cut from a public domain U.S. Army photo (Salaknib 2026, Cpl. Lilly Ekberg).
    // Each entry is the sprite rect in assets/swarm.webp and the drone's position in the original frame.
    const SWARM = [[0, 0, 379, 172, 0.2344, 0.1808], [385, 0, 338, 145, 0.7704, 0.3837], [729, 0, 338, 149, 0.5502, 0.4012], [1073, 0, 308, 142, 0.1784, 0.4617], [1387, 0, 223, 112, 0.8716, 0.5814], [1616, 0, 252, 120, 0.632, 0.5964], [1874, 0, 287, 119, 0.3144, 0.614]];
    let swarm = [], swarmBorn = 0;
    const sheet = new Image();
    sheet.onload = () => {
      swarm = SWARM.map(([sx, sy, sw, sh, fx, fy], i) => {
        const crop = document.createElement('canvas'); crop.width = sw; crop.height = sh;
        const c = crop.getContext('2d'); c.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
        const tint = (color) => { const t = document.createElement('canvas'); t.width = sw; t.height = sh; const k = t.getContext('2d'); k.drawImage(crop, 0, 0); k.globalCompositeOperation = 'source-in'; k.fillStyle = color; k.fillRect(0, 0, sw, sh); return t; };
        // the strobe sits on the body
        const a = c.getImageData(0, 0, sw, sh).data, solid = (x, y) => a[(y * sw + x) * 4 + 3] > 150;
        let bx = 0, by = 0, bn = 0;
        for (let y = 0; y < sh; y++) for (let x = Math.round(sw * 0.38); x < sw * 0.62; x++) if (solid(x, y)) { bx += x; by += y; bn++; }
        return { crop, gold: tint('rgb(228,188,108)'), cool: tint('rgb(205,214,232)'), sw, sh, fx, fy, depth: sw / 379, ph: i * 1.7 + 0.4,
          C: bn ? [bx / bn, by / bn + sh * 0.08] : [sw / 2, sh / 2] };
      });
      swarmBorn = performance.now(); placeSwarm(); draw(performance.now());
    };
    sheet.src = 'assets/swarm.webp?v=20261127b';

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
      // open band for the swarm, under the headline and clear of the copy
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
      placeSwarm();
    }

    // keep the photo's formation, scaled into the open band
    function placeSwarm() {
      if (!swarm.length || !open) return;
      const top = open[0] * h, bottom = open[1] * h;
      const x0 = small ? w * 0.1 : w * 0.5, x1 = small ? w * 0.9 : w * 0.94;
      const most = Math.max(...swarm.map((d) => d.sh));
      const k = Math.min((small ? w * 0.21 : Math.min(w * 0.1, 168)) / 379, (bottom - top) / (2.7 * most));
      const tall = most * k;
      const y0 = top + tall * 0.5, y1 = Math.max(y0, bottom - tall * 0.6);
      swarm.forEach((d) => { d.k = k; d.x = x0 + (d.fx - 0.178) / 0.694 * (x1 - x0); d.y = y0 + (d.fy - 0.18) / 0.434 * (y1 - y0); });
    }

    function drawSwarm(t, now) {
      if (!swarm.length) return;
      const arrive = still ? 1 : Math.min(1, (now - swarmBorn) / 2800), ease = 1 - Math.pow(1 - arrive, 3);
      const driftX = (1 - ease) * w * 0.6 + Math.sin(t * 0.07) * w * 0.012, driftY = Math.sin(t * 0.11) * 5;
      swarm.forEach((d) => {
        const x = d.x + driftX + Math.sin(t * 0.6 + d.ph * 1.3) * 4 + cx * 22 * d.depth;
        const y = d.y + driftY + Math.sin(t * 1.1 + d.ph) * 3 * (0.6 + d.depth) + cy * 12 * d.depth;
        const dw = d.sw * d.k, dh = d.sh * d.k, tilt = Math.sin(t * 0.8 + d.ph) * 0.025 - (1 - ease) * 0.08, a = 0.82 + 0.18 * d.depth;
        ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
        ctx.globalAlpha = 0.2 * a; ctx.drawImage(d.cool, -dw / 2 - 0.6, -dh / 2 - 0.6, dw, dh);
        ctx.globalAlpha = 0.3 * a; ctx.drawImage(d.gold, -dw / 2 + 0.7, -dh / 2 + 0.7, dw, dh);
        ctx.globalAlpha = a; ctx.drawImage(d.crop, -dw / 2, -dh / 2, dw, dh);
        ctx.restore(); ctx.globalAlpha = 1;
        const at = ([px, py]) => { const lx = (px - d.sw / 2) * d.k, ly = (py - d.sh / 2) * d.k; return [x + lx * Math.cos(tilt) - ly * Math.sin(tilt), y + lx * Math.sin(tilt) + ly * Math.cos(tilt)]; };
        const r = 0.6 + 0.6 * d.depth, C = at(d.C);
        const s = still ? 1 : (t + d.ph) % 1.4, strobe = s < 0.06 || (s > 0.18 && s < 0.24) ? 1 : 0;
        light(C[0], C[1], r * 0.9, 'rgba(255,255,255,A)', 0.12 + 0.88 * strobe);
      });
    }

    function light(x, y, r, color, alpha) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, color.replace('A', alpha)); g.addColorStop(1, color.replace('A', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 6.283); ctx.fill();
      ctx.fillStyle = color.replace('A', Math.min(1, alpha + 0.2)); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
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
      // the swarm hovers in front of the ridgelines
      drawSwarm(t, now);
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
  // Star trails around Polaris. The sky turns around the center, each input sits on its own ring,
  // and the selected input lights its ring and feeds Polaris.
  const trails = (() => {
    const box = document.querySelector('.model-graphic'), canvas = byId('model-trails');
    if (!box || !canvas || !canvas.getContext) return { select() {} };
    const tc = canvas.getContext('2d');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inputs = [
      { key: 'battery', label: 'BATTERY PROPERTIES', r: 0.62, a: 200, below: false },
      { key: 'controller', label: 'FLIGHT CONTROLLER', r: 0.78, a: -16, below: false },
      { key: 'registry', label: 'PACK REGISTRY', r: 0.46, a: 148, below: true },
      { key: 'mission', label: 'MISSION PLAN', r: 0.7, a: 13, below: true },
      { key: 'weather', label: 'WEATHER', r: 0.33, a: 68, below: true }
    ];
    let W = 0, H = 0, D = 1, R = 1, cx = 0, cy = 0, reach = 0, layer = null, active = 'battery', hover = null, running = false, seen = true;
    const born = performance.now();
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const at = (s) => { const t = s.a * Math.PI / 180; return [cx + s.r * R * Math.cos(t), cy + s.r * R * Math.sin(t)]; };

    function build() {
      const rect = box.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      W = rect.width; H = rect.height; D = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * D); canvas.height = Math.round(H * D);
      cx = W / 2; cy = H * 0.5; R = Math.min(W / 2, H * 1.25);
      reach = Math.ceil(Math.hypot(W / 2, H / 2)) + 6;
      layer = document.createElement('canvas'); layer.width = layer.height = Math.ceil(reach * 2 * D);
      const g = layer.getContext('2d'); g.scale(D, D); g.translate(reach, reach); g.lineCap = 'butt';
      seed = 7;
      const count = Math.round(80 + W / 5);
      for (let i = 0; i < count; i++) {
        // every trail spans about the same angle, the way a long exposure records the turning sky
        const r = 12 + Math.pow(rnd(), 0.85) * (reach - 12), len = 0.7 + rnd() * 0.16, start = rnd() * Math.PI * 2;
        const bright = Math.pow(rnd(), 2.4), width = 0.5 + bright * 1.1, alpha = 0.07 + bright * 0.5;
        const tone = rnd() < 0.16 ? '215,175,91' : (rnd() < 0.3 ? '204,212,232' : '245,238,224');
        for (let k = 0; k < 10; k++) {
          g.strokeStyle = 'rgba(' + tone + ',' + (alpha * Math.pow(1 - k / 10, 1.6)) + ')'; g.lineWidth = width;
          g.beginPath(); g.arc(0, 0, r, start + len * k / 10, start + len * (k + 1) / 10 + 0.004); g.stroke();
        }
        g.fillStyle = 'rgba(' + tone + ',' + Math.min(1, alpha * 1.7) + ')';
        g.beginPath(); g.arc(r * Math.cos(start), r * Math.sin(start), width * 0.85, 0, 6.283); g.fill();
      }
      return true;
    }

    function spike(x, y, len, alpha, angle) {
      const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len, l = tc.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
      l.addColorStop(0, 'rgba(255,236,190,0)'); l.addColorStop(0.5, 'rgba(255,244,214,' + alpha + ')'); l.addColorStop(1, 'rgba(255,236,190,0)');
      tc.strokeStyle = l; tc.lineWidth = 1.1; tc.beginPath(); tc.moveTo(x - dx, y - dy); tc.lineTo(x + dx, y + dy); tc.stroke();
    }

    function draw(now) {
      if (!layer) return;
      const t = calm ? 0 : (now - born) / 1000, small = W < 420, fs = small ? 6 : 7;
      tc.setTransform(D, 0, 0, D, 0, 0); tc.clearRect(0, 0, W, H);
      const glow = tc.createRadialGradient(cx, cy, 0, cx, cy, R * 0.95);
      glow.addColorStop(0, 'rgba(215,175,91,.12)'); glow.addColorStop(1, 'rgba(215,175,91,0)');
      tc.fillStyle = glow; tc.fillRect(0, 0, W, H);
      // the sky turns counterclockwise around Polaris
      tc.save(); tc.translate(cx, cy); tc.rotate(-t * 0.045); tc.drawImage(layer, -reach, -reach, reach * 2, reach * 2); tc.restore();
      // each input rides its own ring, with a short trail behind it
      inputs.forEach((s) => {
        const on = s.key === active, rr = s.r * R, a = s.a * Math.PI / 180;
        tc.lineWidth = 1; tc.strokeStyle = on ? 'rgba(215,175,91,.3)' : 'rgba(200,190,170,.1)';
        tc.setLineDash(on ? [] : [2, 6]); tc.beginPath(); tc.arc(cx, cy, rr, 0, 6.283); tc.stroke(); tc.setLineDash([]);
        for (let k = 0; k < 12; k++) {
          tc.strokeStyle = (on ? 'rgba(232,196,120,' : 'rgba(235,228,214,') + ((on ? 0.9 : 0.4) * Math.pow(1 - k / 12, 1.5)) + ')';
          tc.lineWidth = on ? 1.8 : 1.1; tc.beginPath(); tc.arc(cx, cy, rr, a + k * 0.05, a + (k + 1) * 0.05 + 0.003); tc.stroke();
        }
      });
      // fade the sky into the panel instead of cutting it off at the edges
      tc.globalCompositeOperation = 'destination-in';
      const ex = Math.min(0.14, 56 / W), ey = Math.min(0.12, 20 / H);
      const fx = tc.createLinearGradient(0, 0, W, 0);
      fx.addColorStop(0, 'rgba(0,0,0,0)'); fx.addColorStop(ex, 'rgba(0,0,0,1)'); fx.addColorStop(1 - ex, 'rgba(0,0,0,1)'); fx.addColorStop(1, 'rgba(0,0,0,0)');
      tc.fillStyle = fx; tc.fillRect(0, 0, W, H);
      const fy = tc.createLinearGradient(0, 0, 0, H);
      fy.addColorStop(0, 'rgba(0,0,0,0)'); fy.addColorStop(ey, 'rgba(0,0,0,1)'); fy.addColorStop(1 - ey, 'rgba(0,0,0,1)'); fy.addColorStop(1, 'rgba(0,0,0,0)');
      tc.fillStyle = fy; tc.fillRect(0, 0, W, H);
      tc.globalCompositeOperation = 'source-over';
      inputs.forEach((s) => {
        const on = s.key === active, p = at(s), x = p[0], y = p[1];
        if (on) {
          const d = Math.hypot(x - cx, y - cy), ex2 = cx + (x - cx) * 12 / d, ey2 = cy + (y - cy) * 12 / d;
          tc.strokeStyle = 'rgba(215,175,91,.5)'; tc.lineWidth = 1; tc.beginPath(); tc.moveTo(x, y); tc.lineTo(ex2, ey2); tc.stroke();
          for (let q = 0; q < 3; q++) {
            const u = calm ? (q + 0.5) / 3 : (t * 0.45 + q / 3) % 1, px = x + (ex2 - x) * u, py = y + (ey2 - y) * u;
            tc.fillStyle = 'rgba(255,226,150,' + (0.95 * Math.sin(u * Math.PI)) + ')'; tc.beginPath(); tc.arc(px, py, 1.6, 0, 6.283); tc.fill();
          }
        }
        const beat = on && !calm ? 0.5 + 0.5 * Math.sin(t * 2.4) : 0.6, hr = on ? 13 + beat * 5 : 8;
        const halo = tc.createRadialGradient(x, y, 0, x, y, hr);
        halo.addColorStop(0, on ? 'rgba(232,196,120,.6)' : 'rgba(245,238,224,.32)'); halo.addColorStop(1, on ? 'rgba(232,196,120,0)' : 'rgba(245,238,224,0)');
        tc.fillStyle = halo; tc.beginPath(); tc.arc(x, y, hr, 0, 6.283); tc.fill();
        tc.fillStyle = on ? '#f3d48e' : '#ece5d6'; tc.beginPath(); tc.arc(x, y, on ? 3.2 : (s.key === hover ? 2.8 : 2.2), 0, 6.283); tc.fill();
        tc.font = fs + 'px ArcasMono, "Courier New", monospace'; if ('letterSpacing' in tc) tc.letterSpacing = '1px';
        tc.textBaseline = 'middle'; tc.textAlign = 'left';
        const tw = tc.measureText(s.label).width, lx = Math.max(6, Math.min(W - 6 - tw, x - tw / 2)), ly = s.below ? y + 15 : y - 13;
        tc.fillStyle = 'rgba(21,20,18,.6)'; tc.fillRect(lx - 4, ly - fs * 0.85, tw + 7, fs * 1.7);
        tc.fillStyle = on ? '#d7af5b' : (s.key === hover ? '#dccca6' : '#b3a07c'); tc.fillText(s.label, lx, ly);
      });
      // Polaris
      const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.6), big = small ? 0.75 : 1;
      const ph = tc.createRadialGradient(cx, cy, 0, cx, cy, (34 + pulse * 8) * big);
      ph.addColorStop(0, 'rgba(255,230,160,.85)'); ph.addColorStop(0.28, 'rgba(215,175,91,.3)'); ph.addColorStop(1, 'rgba(215,175,91,0)');
      tc.fillStyle = ph; tc.beginPath(); tc.arc(cx, cy, (34 + pulse * 8) * big, 0, 6.283); tc.fill();
      spike(cx, cy, (22 + pulse * 6) * big, 0.95, 0); spike(cx, cy, (22 + pulse * 6) * big, 0.95, Math.PI / 2);
      spike(cx, cy, (9 + pulse * 3) * big, 0.55, Math.PI / 4); spike(cx, cy, (9 + pulse * 3) * big, 0.55, -Math.PI / 4);
      tc.fillStyle = '#fffaf0'; tc.beginPath(); tc.arc(cx, cy, 4.2 * big, 0, 6.283); tc.fill();
      tc.font = (fs + 1) + 'px ArcasMono, "Courier New", monospace'; if ('letterSpacing' in tc) tc.letterSpacing = '3px';
      tc.textAlign = 'center'; tc.fillStyle = '#ddbf85'; tc.fillText('POLARIS', cx + 1.5, cy + 24 * big);
      if ('letterSpacing' in tc) tc.letterSpacing = '0px';
      tc.textAlign = 'left';
    }

    function loop(now) { if (!running) return; draw(now); requestAnimationFrame(loop); }
    function go() { if (calm || running || !seen || document.hidden) return; running = true; requestAnimationFrame(loop); }
    function halt() { running = false; }
    function pick(e) {
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let best = null, dist = 22;
      inputs.forEach((s) => { const p = at(s), d = Math.hypot(p[0] - mx, p[1] - my); if (d < dist) { dist = d; best = s.key; } });
      return best;
    }
    box.addEventListener('pointermove', (e) => { const k = pick(e); if (k !== hover) { hover = k; box.style.cursor = k ? 'pointer' : ''; if (!running) draw(performance.now()); } });
    box.addEventListener('pointerleave', () => { hover = null; box.style.cursor = ''; if (!running) draw(performance.now()); });
    box.addEventListener('click', (e) => { const k = pick(e), tab = k && document.querySelector('[data-input="' + k + '"]'); if (tab) selectInput(tab); });
    if (build()) draw(performance.now());
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (build()) draw(performance.now()); }).observe(box);
    if ('IntersectionObserver' in window) new IntersectionObserver((entries) => { seen = entries[0].isIntersecting; seen ? go() : halt(); }).observe(box);
    document.addEventListener('visibilitychange', () => { document.hidden ? halt() : go(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(performance.now()));
    go();
    return { select(key) { active = key; if (!running) draw(performance.now()); } };
  })();
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
    trails.select(key);
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
