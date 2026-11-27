// Night sky fleet for the Arcas header.
// three.js renders lit drone models on their own canvas, layered just above the sky canvas
// in the header. app.js calls frame() from the sky animation so both stay in step.
export function createFleet(THREE, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-fleet'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:-2;pointer-events:none;opacity:0;transition:opacity 1.6s ease';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const deg = THREE.MathUtils.degToRad;
  let seed = 29;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.004);
  const fov = 24, tanH = Math.tan(deg(fov / 2));
  const look = new THREE.Euler(deg(27), 0, 0);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.5, 5000);
  camera.rotation.copy(look);

  // Light that matches the page: cool moonlight from above, the gold horizon glow behind the fleet
  scene.add(new THREE.HemisphereLight(0x4a5568, 0x3c3224, 1.4));
  const moon = new THREE.DirectionalLight(0xdbe2f0, 3.2); moon.position.set(-40, 62, 34); scene.add(moon);
  const glow = new THREE.DirectionalLight(0xe8b862, 5); glow.position.set(60, 14, -110); scene.add(glow);
  const bounce = new THREE.DirectionalLight(0x9da3ad, 1.8); bounce.position.set(-10, -40, 30); scene.add(bounce);

  // Reflections come from a painted night sky with the same gold horizon
  (function environment() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#0d0f14'); sky.addColorStop(0.44, '#18171a'); sky.addColorStop(0.5, '#4a3418'); sky.addColorStop(0.56, '#1d160d'); sky.addColorStop(1, '#0a0806');
    g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
    const spot = (x, y, r, color) => { const s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, color); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(0, 0, 512, 256); };
    spot(160, 132, 150, 'rgba(245,190,95,.8)');
    spot(410, 136, 110, 'rgba(200,150,80,.35)');
    spot(460, 58, 30, 'rgba(230,236,248,1)');
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 0.75;
    tex.dispose(); pmrem.dispose();
  })();

  // Rotor blur: brighter toward the tips, the way a spinning prop reads on camera
  const discTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, '#000'); r.addColorStop(0.16, '#000'); r.addColorStop(0.3, '#2a2a2a'); r.addColorStop(0.82, '#5a5a5a'); r.addColorStop(0.93, '#8a8a8a'); r.addColorStop(0.985, '#202020'); r.addColorStop(1, '#000');
    g.fillStyle = r; g.beginPath(); g.arc(64, 64, 64, 0, 6.283); g.fill();
    if (g.createConicGradient) {
      const s = g.createConicGradient(0, 64, 64);
      s.addColorStop(0, 'rgba(255,255,255,.22)'); s.addColorStop(0.08, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,.22)'); s.addColorStop(0.58, 'rgba(255,255,255,0)'); s.addColorStop(1, 'rgba(255,255,255,.22)');
      g.globalCompositeOperation = 'multiply'; g.fillStyle = s; g.beginPath(); g.arc(64, 64, 62, 0, 6.283); g.fill();
      g.globalCompositeOperation = 'lighter'; g.fillStyle = s; g.globalAlpha = 0.35; g.beginPath(); g.arc(64, 64, 62, 0, 6.283); g.fill();
    }
    return new THREE.CanvasTexture(c);
  })();

  // navigation lights: a colored halo and a hot core, drawn last and never hidden by the airframe
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,255,255,.9)'); r.addColorStop(0.3, 'rgba(255,255,255,.32)'); r.addColorStop(0.6, 'rgba(255,255,255,.08)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  function lamp(color) {
    const make = (tint) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: tint, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true, fog: false, toneMapped: false }));
      s.renderOrder = 5; return s;
    };
    return { halo: make(new THREE.Color(color)), core: make(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.65)) };
  }

  function paint() {
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide, transparent: true }, o));
    const m = {
      skin: std({ color: 0x6c7076, roughness: 0.5, metalness: 0.16 }),
      dark: std({ color: 0x26272a, roughness: 0.5, metalness: 0.35 }),
      carbon: std({ color: 0x171819, roughness: 0.26, metalness: 0.6 }),
      metal: std({ color: 0xaeb0b4, roughness: 0.22, metalness: 1 }),
      gold: std({ color: 0xd7af5b, roughness: 0.3, metalness: 0.95 }),
      pack: std({ color: 0x272522, roughness: 0.38, metalness: 0.3 }),
      blade: std({ color: 0x121213, roughness: 0.42, metalness: 0.3 }),
      blur: std({ color: 0x1b1b1c, roughness: 0.42, metalness: 0.3, opacity: 0.28, depthWrite: false }),
      disc: std({ color: 0xa69d8c, roughness: 0.5, metalness: 0.15, alphaMap: discTex, opacity: 0.55, depthWrite: false }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, side: THREE.DoubleSide })
    };
    Object.values(m).forEach((x) => { x.userData.base = x.opacity; });
    return m;
  }

  // ---------- geometry helpers ----------
  function foil(t) {
    const up = [], lo = [], n = 12;
    for (let i = 0; i <= n; i++) {
      const xi = (1 - Math.cos(Math.PI * i / n)) / 2;
      const yt = 5 * t * (0.2969 * Math.sqrt(xi) - 0.126 * xi - 0.3516 * xi * xi + 0.2843 * xi ** 3 - 0.1036 * xi ** 4);
      const yc = xi < 0.4 ? 0.125 * (0.8 * xi - xi * xi) : 0.0556 * (0.2 + 0.8 * xi - xi * xi);
      up.push([0.25 - xi, yc + yt]); lo.push([0.25 - xi, yc - yt]);
    }
    return up.concat(lo.reverse().slice(1, -1));
  }
  function loft(rings) {
    const n = rings[0].length, pos = [], idx = [];
    rings.forEach((ring) => ring.forEach((v) => pos.push(v.x, v.y, v.z)));
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) {
      const a = r * n + i, b = r * n + (i + 1) % n, c = (r + 1) * n + i, d = (r + 1) * n + (i + 1) % n;
      idx.push(a, c, b, b, c, d);
    }
    [0, rings.length - 1].forEach((r) => {
      const ring = rings[r], mid = ring.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / n);
      const base = pos.length / 3;
      ring.forEach((v) => pos.push(v.x, v.y, v.z)); pos.push(mid.x, mid.y, mid.z);
      for (let i = 0; i < n; i++) idx.push(base + i, base + (i + 1) % n, base + n);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a lifting surface along z with the leading edge toward +x
  function surface({ span, root, tip, sweep = 0, dihedral = 0, t = 0.12, twist = [0, 0], half = false }) {
    const f = foil(t), rings = [], n = half ? 3 : 4;
    for (let s = 0; s <= n; s++) {
      const z = half ? span * s / n : span * (s / n - 0.5);
      const k = Math.abs(z) / (half ? span : span / 2);
      const c = root + (tip - root) * k, a = twist[0] + (twist[1] - twist[0]) * k, ca = Math.cos(a), sa = Math.sin(a);
      rings.push(f.map(([x, y]) => {
        const X = x * c, Y = y * c;
        return new THREE.Vector3(X * ca - Y * sa - Math.tan(sweep) * Math.abs(z), X * sa + Y * ca + Math.tan(dihedral) * Math.abs(z), z);
      }));
    }
    return loft(rings);
  }
  // a body of revolution along x with the nose toward +x
  function body(profile, segs = 32, sy = 1, sz = 1) {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    g.rotateZ(-Math.PI / 2); g.scale(1, sy, sz); return g;
  }
  function rod(r, a, b, segs = 10) {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    const g = new THREE.CylinderGeometry(r, r, len, segs);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const part = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const cyl = (rt, rb, h, segs = 18) => new THREE.CylinderGeometry(rt, rb, h, segs);

  function prop(radius, m, spinning, blades = 2) {
    const group = new THREE.Group(), spin = new THREE.Group(); group.add(spin);
    const geo = surface({ span: radius * 0.93, root: radius * 0.17, tip: radius * 0.07, t: 0.1, twist: [deg(26), deg(9)], half: true });
    geo.translate(0, 0, radius * 0.07);
    for (let i = 0; i < blades; i++) {
      const b = part(geo, spinning ? m.blur : m.blade); b.rotation.y = i * Math.PI * 2 / blades; b.renderOrder = spinning ? 1 : 0; spin.add(b);
    }
    spin.add(part(new THREE.SphereGeometry(radius * 0.08, 14, 10), m.metal));
    if (spinning) { const disc = part(new THREE.CircleGeometry(radius, 56).rotateX(-Math.PI / 2), m.disc); disc.renderOrder = 2; spin.add(disc); }
    return { group, spin };
  }

  // ---------- airframes (generic classes, forward is +x, starboard is +z) ----------
  function quadplane(m) {
    const g = new THREE.Group(), props = [], lights = [];
    g.add(part(body([[0, -0.98], [0.035, -0.965], [0.056, -0.9], [0.076, -0.72], [0.102, -0.42], [0.119, -0.1], [0.125, 0.2], [0.12, 0.48], [0.104, 0.68], [0.076, 0.83], [0.044, 0.92], [0.016, 0.955], [0, 0.96]], 40, 1.08, 0.92), m.skin));
    g.add(part(surface({ span: 3.4, root: 0.38, tip: 0.22, sweep: deg(1.5), dihedral: deg(2.5), t: 0.13 }), m.skin, 0.17, 0.138, 0));
    g.add(part(cyl(0.04, 0.04, 0.016, 24), m.dark, 0.44, 0.138, 0)); // GNSS puck
    const ant = new THREE.BoxGeometry(0.06, 0.11, 0.008); ant.translate(0, 0.055, 0);
    const a1 = part(ant, m.dark, -0.36, 0.11, 0); a1.rotation.z = 0.45; g.add(a1);
    const a2 = part(ant, m.dark, 0.05, -0.125, 0); a2.rotation.z = Math.PI + 0.5; g.add(a2);
    [-1, 1].forEach((side) => {
      const z = side * 0.6;
      g.add(part(new THREE.CylinderGeometry(0.027, 0.027, 2.08, 14).rotateZ(Math.PI / 2), m.carbon, -0.26, 0.135, z));
      [0.7, -0.98].forEach((x) => {
        g.add(part(cyl(0.028, 0.032, 0.03, 16), m.dark, x, 0.172, z));
        g.add(part(cyl(0.039, 0.043, 0.05, 22), m.metal, x, 0.2, z));
        const p = prop(0.33, m, false); p.group.position.set(x, 0.232, z); p.spin.rotation.y = Math.PI / 2 + side * 0.04; g.add(p.group); // parked fore and aft for cruise
      });
      const fin = surface({ span: 0.36, root: 0.22, tip: 0.12, sweep: deg(32), t: 0.1, half: true });
      fin.rotateX(side > 0 ? deg(50) : deg(130));
      g.add(part(fin, m.skin, -1.14, 0.135, z));
    });
    g.add(part(new THREE.ConeGeometry(0.045, 0.08, 20).rotateZ(Math.PI / 2), m.metal, -1.0, 0, 0));
    const pusher = prop(0.22, m, true); pusher.group.rotation.z = Math.PI / 2; pusher.group.position.set(-1.05, 0, 0); g.add(pusher.group);
    props.push({ spin: pusher.spin, rate: 46 });
    const gim = new THREE.Group(); gim.position.set(0.56, -0.13, 0); g.add(gim);
    gim.add(part(cyl(0.03, 0.03, 0.05, 14), m.dark, 0, 0.04, 0));
    gim.add(part(new THREE.SphereGeometry(0.068, 28, 20), m.dark));
    gim.add(part(new THREE.SphereGeometry(0.03, 18, 12), m.glass, 0.052, -0.022, 0));
    lights.push({ p: V(0.2, 0.215, -1.7), color: 0xff3a30, size: 1, mode: 'steady' });
    lights.push({ p: V(0.2, 0.215, 1.7), color: 0x3cff84, size: 1, mode: 'steady' });
    lights.push({ p: V(0.1, 0.22, -1.71), color: 0xffffff, size: 0.9, mode: 'strobe' });
    lights.push({ p: V(0.1, 0.22, 1.71), color: 0xffffff, size: 0.9, mode: 'strobe' });
    lights.push({ p: V(-0.1, -0.14, 0), color: 0xff4632, size: 0.8, mode: 'beacon' });
    return { group: g, props, lights, span: 3.4, kind: 'wing' };
  }

  function hexa(m) {
    const g = new THREE.Group(), props = [], lights = [];
    g.add(part(new THREE.LatheGeometry([[0, -0.05], [0.13, -0.048], [0.18, -0.03], [0.196, 0], [0.186, 0.03], [0.15, 0.062], [0.09, 0.086], [0, 0.094]].map(([r, y]) => new THREE.Vector2(r, y)), 40), m.skin));
    for (let k = 0; k < 6; k++) {
      const a = deg(30 + 60 * k), c = Math.cos(a), s = Math.sin(a), mx = 0.64 * c, mz = 0.64 * s;
      g.add(part(rod(0.019, V(0.15 * c, 0, 0.15 * s), V(mx, 0.012, mz)), m.carbon));
      g.add(part(cyl(0.029, 0.029, 0.05, 14), m.dark, 0.23 * c, 0.002, 0.23 * s));
      g.add(part(cyl(0.034, 0.038, 0.032, 18), m.dark, mx, 0.012, mz));
      g.add(part(cyl(0.042, 0.046, 0.055, 22), m.metal, mx, 0.055, mz));
      const p = prop(0.25, m, true); p.group.position.set(mx, 0.09, mz); g.add(p.group);
      props.push({ spin: p.spin, rate: k % 2 ? 38 : -38 });
    }
    [-1, 1].forEach((side) => {
      g.add(part(new THREE.BoxGeometry(0.28, 0.075, 0.1), m.pack, 0, -0.098, side * 0.058));
      g.add(part(new THREE.BoxGeometry(0.03, 0.079, 0.104), m.gold, 0.07, -0.098, side * 0.058));
      g.add(part(rod(0.011, V(0.09, -0.05, side * 0.1), V(0.11, -0.31, side * 0.23)), m.carbon));
      g.add(part(rod(0.011, V(-0.09, -0.05, side * 0.1), V(-0.11, -0.31, side * 0.23)), m.carbon));
      g.add(part(new THREE.CylinderGeometry(0.013, 0.013, 0.46, 10).rotateZ(Math.PI / 2), m.carbon, 0, -0.315, side * 0.235));
    });
    g.add(part(rod(0.008, V(-0.08, 0.08, 0), V(-0.1, 0.22, 0)), m.dark));
    g.add(part(cyl(0.046, 0.046, 0.018, 24), m.dark, -0.1, 0.228, 0));
    const gim = new THREE.Group(); gim.position.set(0.16, -0.16, 0); g.add(gim);
    gim.add(part(cyl(0.024, 0.024, 0.06, 12), m.dark, 0, 0.04, 0));
    gim.add(part(new THREE.SphereGeometry(0.052, 24, 16), m.dark));
    gim.add(part(new THREE.SphereGeometry(0.024, 16, 12), m.glass, 0.04, -0.016, 0));
    lights.push({ p: V(0.64 * Math.cos(deg(330)), -0.01, 0.64 * Math.sin(deg(330))), color: 0xff3a30, size: 0.9, mode: 'steady' });
    lights.push({ p: V(0.64 * Math.cos(deg(30)), -0.01, 0.64 * Math.sin(deg(30))), color: 0x3cff84, size: 0.9, mode: 'steady' });
    lights.push({ p: V(-0.1, 0.245, 0), color: 0xffffff, size: 0.9, mode: 'strobe' });
    return { group: g, props, lights, span: 1.78, kind: 'rotor' };
  }

  function munition(m) {
    const g = new THREE.Group(), props = [], lights = [];
    g.add(part(body([[0, -0.64], [0.022, -0.635], [0.046, -0.6], [0.06, -0.53], [0.065, -0.42], [0.065, 0.38], [0.062, 0.47], [0.052, 0.55], [0.036, 0.6], [0.015, 0.625], [0, 0.63]], 32), m.skin));
    g.add(part(new THREE.SphereGeometry(0.03, 18, 12), m.glass, 0.6, 0, 0));
    g.add(part(new THREE.CylinderGeometry(0.0655, 0.0655, 0.03, 32).rotateZ(Math.PI / 2), m.dark, 0.3, 0, 0));
    g.add(part(surface({ span: 0.98, root: 0.11, tip: 0.075, sweep: deg(14), t: 0.07 }), m.skin, 0.2, 0.066, 0));
    g.add(part(surface({ span: 1.08, root: 0.12, tip: 0.08, sweep: deg(10), dihedral: deg(-3), t: 0.07 }), m.skin, -0.28, -0.064, 0));
    for (let k = 0; k < 4; k++) {
      const f = surface({ span: 0.12, root: 0.12, tip: 0.06, sweep: deg(38), t: 0.08, half: true });
      f.rotateX(deg(45 + 90 * k)); g.add(part(f, m.skin, -0.49, 0, 0));
    }
    const p = prop(0.17, m, true); p.group.rotation.z = Math.PI / 2; p.group.position.set(-0.67, 0, 0); g.add(p.group);
    props.push({ spin: p.spin, rate: 52 });
    lights.push({ p: V(-0.4, 0.07, 0), color: 0xffffff, size: 0.7, mode: 'strobe' });
    return { group: g, props, lights, span: 1.08, kind: 'wing' };
  }

  const builders = { quadplane, hexa, munition };
  // y is a fraction of the open band under the headline, px is the span as a share of the header width
  const wide = [
    { type: 'quadplane', px: 0.13, y: [0.5, 0.62], speed: 44, dir: -1 },
    { type: 'hexa', px: 0.062, y: [0.84, 0.94], speed: 20, dir: 1 },
    { type: 'munition', px: 0.05, y: [0.1, 0.2], speed: 70, dir: 1 },
    { type: 'quadplane', px: 0.036, y: [0, 0.05], speed: 22, dir: -1 },
    { type: 'hexa', px: 0.026, y: [0.3, 0.36], speed: 11, dir: 1 }
  ];
  const narrow = [
    { type: 'quadplane', px: 0.34, y: [0.38, 0.5], speed: 38, dir: -1 },
    { type: 'hexa', px: 0.16, y: [0.8, 0.92], speed: 16, dir: 1 },
    { type: 'munition', px: 0.14, y: [0.1, 0.2], speed: 52, dir: 1 },
    { type: 'quadplane', px: 0.09, y: [0, 0.06], speed: 17, dir: -1 }
  ];

  let W = 1, H = 1, small = false, band = [0.55, 0.8], region = { x: 0, y: 0, w: 1, h: 1 }, fleet = [], drift = 0;
  const tmp = new THREE.Vector3();

  // a point at distance d along the view axis under the screen point (sx, sy) of the base camera
  function at(sx, sy, d) {
    const nx = sx / W * 2 - 1, ny = 1 - sy / H * 2;
    return new THREE.Vector3(nx * tanH * (W / H) * d, ny * tanH * d, -d).applyEuler(look);
  }
  const mpp = (d) => 2 * tanH * d / H;

  function spawn(d, first) {
    const L = d.lane;
    const d0 = d.span * H / (2 * tanH * L.px * W) * (0.92 + rnd() * 0.2);
    const k = L.depth || [0.62, 1.55], d1 = d0 * (rnd() < 0.5 ? k[0] + rnd() * 0.12 : k[1] - rnd() * 0.2);
    const f = L.y[0] + rnd() * (L.y[1] - L.y[0]), y0 = (band[0] + (band[1] - band[0]) * f) * H, y1 = y0 + (rnd() - 0.5) * 0.03 * H;
    const left = small ? -0.3 * W : 0.3 * W, right = W * 1.2;
    const [x0, x1] = L.dir > 0 ? [left, right] : [right, left];
    d.a = at(x0, y0, d0); d.b = at(x1, y1, d1);
    d.rate = L.speed * mpp((d0 + d1) / 2) / d.a.distanceTo(d.b);
    d.u = first ? 0.08 + rnd() * 0.75 : 0;
    const hd = tmp.subVectors(d.b, d.a);
    d.yaw = Math.atan2(-hd.z, hd.x);
  }

  function build() {
    fleet.forEach((d) => { scene.remove(d.group); d.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); Object.values(d.mats).forEach((x) => x.dispose()); d.lights.forEach((l) => { l.lamp.halo.material.dispose(); l.lamp.core.material.dispose(); }); });
    seed = 29;
    fleet = (options.lanes || (small ? narrow : wide)).map((lane) => {
      const mats = paint(), made = builders[lane.type](mats);
      made.lights.forEach((l) => { l.lamp = lamp(l.color); [l.lamp.halo, l.lamp.core].forEach((sp) => { sp.position.copy(l.p); made.group.add(sp); }); });
      scene.add(made.group);
      return Object.assign(made, { mats, lane, pos: new THREE.Vector3(), ph: rnd() * 6.28, fade: 1 });
    });
    drift = mpp(Math.min(...fleet.map((d) => d.span * H / (2 * tanH * d.lane.px * W)))) * 30;
    fleet.forEach((d) => spawn(d, true));
    scene.fog.density = 0.5 / Math.max(...fleet.map((d) => d.span * H / (2 * tanH * d.lane.px * W)));
  }

  function resize(w, h, dpr, isSmall, open) {
    const moved = Math.abs(w - W) > 40 || !open || Math.abs(open[0] - band[0]) > 0.02 || Math.abs(open[1] - band[1]) > 0.02;
    const rebuild = !fleet.length || isSmall !== small || moved;
    W = w; H = h; small = isSmall; if (open) band = open;
    const top = Math.max(0, Math.round((band[0] - 0.1) * h)), bottom = Math.min(h, Math.round((band[1] + 0.1) * h));
    region = small ? { x: 0, y: top, w: Math.round(w), h: bottom - top } : { x: Math.round(w * 0.3), y: top, w: Math.round(w * 0.7), h: bottom - top };
    renderer.setPixelRatio(dpr); renderer.setSize(region.w, region.h, false);
    Object.assign(canvas.style, { left: region.x + 'px', top: region.y + 'px', width: region.w + 'px', height: region.h + 'px' });
    camera.aspect = W / H; camera.setViewOffset(W, H, region.x, region.y, region.w, region.h); camera.updateProjectionMatrix();
    if (rebuild) { build(); renderer.compile(scene, camera); }
  }

  function project(v) {
    tmp.copy(v).project(camera);
    return { x: region.x + (tmp.x + 1) / 2 * region.w, y: region.y + (1 - tmp.y) / 2 * region.h };
  }

  function frame(t, dt, px, py) {
    camera.position.set(-px * drift, py * drift * 0.55, 0); camera.updateMatrixWorld();
    for (const d of fleet) {
      d.u += dt * d.rate;
      if (d.u > 1) spawn(d, false);
      d.pos.copy(d.a).lerp(d.b, d.u);
      d.pos.y += Math.sin(t * (d.kind === 'rotor' ? 1.1 : 0.45) + d.ph) * d.span * 0.05;
      d.group.position.copy(d.pos);
      const roll = d.kind === 'rotor' ? deg(1.6) * Math.sin(t * 0.8 + d.ph) : deg(5) * Math.sin(t * 0.3 + d.ph) + deg(1.2) * Math.sin(t * 1.7 + d.ph);
      const pitch = d.kind === 'rotor' ? -deg(9) + deg(1.2) * Math.sin(t * 0.7 + d.ph * 2) : deg(1.5) * Math.sin(t * 0.5 + d.ph);
      d.group.rotation.set(roll, d.yaw, pitch, 'YZX');
      for (const p of d.props) p.spin.rotation.y += p.rate * dt;
      d.fade = small ? 1 : Math.max(0, Math.min(1, (project(d.pos).x - W * 0.4) / (W * 0.12)));
      d.group.visible = d.fade > 0.002;
      for (const mat of Object.values(d.mats)) mat.opacity = mat.userData.base * d.fade;
    }
    scene.updateMatrixWorld();
    for (const d of fleet) {
      if (!d.group.visible) continue;
      const m = mpp(Math.max(1, -tmp.copy(d.pos).applyMatrix4(camera.matrixWorldInverse).z));
      const r = Math.max(0.6, Math.min(1.5, 0.022 / m));
      for (const l of d.lights) {
        let a = 0.9;
        if (l.mode === 'strobe') { const k = (t + d.ph) % 1.3; a = k < 0.05 || (k > 0.15 && k < 0.2) ? 1 : 0.08; }
        if (l.mode === 'beacon') a = 0.15 + 0.8 * Math.pow(Math.max(0, Math.sin(t * 3.4 + d.ph)), 6);
        const flash = l.mode === 'strobe' && a > 0.5 ? 1.25 : 1;
        l.lamp.halo.scale.setScalar(7 * r * l.size * m * flash); l.lamp.core.scale.setScalar(1.6 * r * l.size * m);
        l.lamp.halo.material.opacity = 0.36 * a * d.fade; l.lamp.core.material.opacity = 0.95 * a * d.fade;
      }
    }
    renderer.render(scene, camera);
  }

  return { canvas, resize, frame, show: () => { canvas.style.opacity = '1'; }, dispose: () => renderer.dispose() };
}
