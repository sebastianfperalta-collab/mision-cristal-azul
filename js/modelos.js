// Modelos 3D generados por código (estilo caricatura, livianos, sin archivos externos)
import * as THREE from 'three';

export const rnd = (a, b) => a + Math.random() * (b - a);
export const NARANJA = 0xe35c27;   // ASOOCCIDENTE
export const AZUL_CRISTAL = 0x2f8cff;

function gradiente() {
  const d = new Uint8Array([80, 150, 215, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
export const GRAD = gradiente();
export const toon = (color, o = {}) => (o.flatShading
  ? new THREE.MeshLambertMaterial({ color, ...o })
  : new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o }));
const en = (m, x, y, z) => { m.position.set(x, y, z); return m; };

export function zonaToque(geo) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
}

let spriteRedondo = null;
export function sprite() {
  if (spriteRedondo) return spriteRedondo;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  spriteRedondo = new THREE.CanvasTexture(c);
  return spriteRedondo;
}
export function brillo(color, tam = 1, opacidad = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite(), color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(tam); return s;
}

function cieloGradiente(radio, arriba, medio, abajo) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: new THREE.Color(arriba) }, m: { value: new THREE.Color(medio) }, b: { value: new THREE.Color(abajo) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 a,m,b; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(m,a,smoothstep(0.0,0.7,h)) : mix(m,b,smoothstep(0.0,0.4,-h)); gl_FragColor=vec4(c,1.0); }'
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 16), mat);
  cielo.renderOrder = -1;
  return cielo;
}

// Plano con un canvas para dibujar textos, pantallas y logos
export function planoCanvas(ancho, alto, px = 512) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * alto / ancho);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return { m, c, x: c.getContext('2d'), tex, w: c.width, h: c.height };
}

/* ───────────── Partículas y efectos ───────────── */
export function crearParticulas(n, radio, { color = 0xffffff, tam = 0.05, opacidad = 0.5, vel = 0.2, alto = null } = {}) {
  const h = alto || radio;
  const pos = new Float32Array(n * 3), v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rnd(-radio, radio); pos[i * 3 + 1] = rnd(-h * 0.5, h * 0.5); pos[i * 3 + 2] = rnd(-radio, radio);
    v[i] = vel * rnd(0.5, 1.5);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: tam, map: sprite(), transparent: true, opacity: opacidad, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(geo, mat);
  p.userData.actualizar = (dt, t) => {
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] += v[i] * dt; pos[i * 3] += Math.sin(t * 0.7 + i) * 0.002;
      if (pos[i * 3 + 1] > h * 0.5) pos[i * 3 + 1] = -h * 0.5;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return p;
}

// Explosión de partículas. Devuelve fn(dt) → false cuando termina
export function estallido(padre, posicion, color, { n = 18, vel = 2.4, dur = 0.7, tam = 0.045 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  const geo = new THREE.SphereGeometry(tam, 8, 6);
  const vels = [];
  for (let i = 0; i < n; i++) {
    g.add(new THREE.Mesh(geo, mat));
    vels.push(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(vel * 0.5, vel)));
  }
  g.position.copy(posicion); padre.add(g);
  let t = 0;
  return (dt) => {
    t += dt;
    g.children.forEach((m, i) => { m.position.addScaledVector(vels[i], dt); vels[i].multiplyScalar(0.94); });
    mat.opacity = Math.max(0, 1 - t / dur);
    if (t > dur) { padre.remove(g); geo.dispose(); mat.dispose(); return false; }
    return true;
  };
}

// Rayos eléctricos (chispas) entre un punto y destinos aleatorios
export function crearChispas(color = 0x9fd8ff, n = 5, radio = 0.6) {
  const geo = new THREE.BufferGeometry();
  const segs = 8, pos = new Float32Array(n * segs * 2 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lineas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  let acum = 0;
  lineas.userData.radio = radio;
  lineas.userData.actualizar = (dt) => {
    acum += dt; if (acum < 0.07) return; acum = 0;
    const r = lineas.userData.radio; let k = 0;
    for (let i = 0; i < n; i++) {
      const fin = new THREE.Vector3(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize().multiplyScalar(r * rnd(0.6, 1));
      let prev = new THREE.Vector3();
      for (let s = 1; s <= segs; s++) {
        const p = fin.clone().multiplyScalar(s / segs).add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(r * 0.12 * (s < segs ? 1 : 0)));
        pos.set([prev.x, prev.y, prev.z, p.x, p.y, p.z], k); k += 6; prev = p;
      }
    }
    geo.attributes.position.needsUpdate = true;
    lineas.material.opacity = rnd(0.5, 1);
  };
  return lineas;
}

/* ───────────── Piedras y cristal ───────────── */
export function crearPiedra(color, { cristal = false, tam = 0.32 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(tam, 1);
  const p = geo.attributes.position, mapa = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!mapa.has(k)) mapa.set(k, rnd(0.78, 1.15));
    const s = mapa.get(k); p.setXYZ(i, x * s, y * s * 0.82, z * s);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: cristal ? 0x3a4660 : color, flatShading: true, emissive: new THREE.Color(cristal ? 0x0a2050 : 0x000000) });
  const cuerpo = new THREE.Mesh(geo, mat); g.add(cuerpo);
  let matCristal = null, halo = null;
  if (cristal) {
    matCristal = toon(AZUL_CRISTAL, { emissive: new THREE.Color(AZUL_CRISTAL), emissiveIntensity: 0.9, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 7; i++) {
      const h = rnd(0.18, 0.38) * (tam / 0.32), r = rnd(0.035, 0.06) * (tam / 0.32);
      const fr = new THREE.Group();
      fr.add(en(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), matCristal), 0, h / 2, 0));
      fr.add(en(new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 6), matCristal), 0, h + r * 1.1, 0));
      const dir = new THREE.Vector3(rnd(-0.7, 0.7), 1, rnd(-0.7, 0.7)).normalize();
      fr.position.copy(dir.clone().multiplyScalar(tam * 0.55));
      fr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.add(fr);
    }
    halo = brillo(0x4aa8ff, tam * 4.5, 0.55); halo.position.y = tam * 0.4; g.add(halo);
  }
  const toque = zonaToque(new THREE.SphereGeometry(tam * 1.7, 12, 8)); g.add(toque);
  g.userData = { cuerpo, mat, matCristal, halo, color };
  return g;
}

/* ───────────── Exterior: campo de piedras flotantes ───────────── */
function estrellas(n = 700, radio = 85) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rnd(-1, 1), rnd(0.05, 1), rnd(-1, 1)).normalize().multiplyScalar(radio);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, map: sprite(), transparent: true, depthWrite: false, fog: false }));
}
function suelo(color, tam = 140) {
  const geo = new THREE.PlaneGeometry(tam, tam, 60, 60); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 0.35) * 0.18 + Math.cos(p.getZ(i) * 0.3) * 0.2 + rnd(-0.08, 0.08));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, toon(color, { flatShading: true })); m.position.y = -1.6; return m;
}
export function crearEdificio(cartel) {
  const g = new THREE.Group();
  const muro = toon(0xe4eaf1), marco = toon(0x34495e);
  g.add(en(new THREE.Mesh(new THREE.BoxGeometry(11, 5.5, 6), muro), 0, 1.15, 0));
  g.add(en(new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.4, 6.4), marco), 0, 4.0, 0));
  const banda = new THREE.Mesh(new THREE.BoxGeometry(11.05, 0.35, 6.05), toon(NARANJA)); banda.position.y = 0.2; g.add(banda);
  const vidrio = new THREE.MeshBasicMaterial({ color: 0xffd99a });
  for (let i = -2; i <= 2; i++) { if (i === 0) continue; g.add(en(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.2), vidrio), i * 2.1, 1.9, 3.01)); }
  const puertaHueco = en(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.7), new THREE.MeshBasicMaterial({ color: 0x9fe3ff })), 0, -0.25, 3.01); g.add(puertaHueco);
  const pivote = new THREE.Group(); pivote.position.set(-0.9, -0.25, 3.05); g.add(pivote);
  pivote.add(en(new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.7, 0.08), toon(0x2c3e50)), 0.9, 0, 0));
  const letrero = planoCanvas(6, 1.1, 1024);
  letrero.x.fillStyle = '#ffffff'; letrero.x.fillRect(0, 0, letrero.w, letrero.h);
  letrero.x.fillStyle = '#1b1b1b'; letrero.x.font = '900 120px system-ui, sans-serif'; letrero.x.textAlign = 'center'; letrero.x.textBaseline = 'middle';
  letrero.x.fillText(cartel, letrero.w / 2, letrero.h / 2 + 6); letrero.tex.needsUpdate = true;
  letrero.m.position.set(0, 3.15, 3.03); g.add(letrero.m);
  const luz = brillo(0x9fe3ff, 4, 0.5); luz.position.set(0, -0.2, 3.3); g.add(luz);
  g.userData = { pivote, letrero };
  return g;
}

export function crearExterior(cartel) {
  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2(0x1d1846, 0.03);
  escena.add(cieloGradiente(90, 0x070b26, 0x3b2a6e, 0x120c22));
  escena.add(estrellas());
  escena.add(new THREE.HemisphereLight(0x9fb2ff, 0x2a1838, 1.3));
  const luna = new THREE.DirectionalLight(0xd6e0ff, 1.1); luna.position.set(-3, 6, 2); escena.add(luna);
  const disco = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 12), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false }));
  disco.position.set(-30, 28, -55); escena.add(disco);
  escena.add(suelo(0x3a3152));
  const matR = [toon(0x51476b, { flatShading: true }), toon(0x463d5c, { flatShading: true })];
  for (let i = 0; i < 40; i++) {
    const a = rnd(0, Math.PI * 2), r = rnd(5, 30), s = rnd(0.2, 1.1);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s), matR[i % 2]);
    m.position.set(Math.cos(a) * r, -1.6 + s * 0.3, Math.sin(a) * r); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); escena.add(m);
  }
  const edificio = crearEdificio(cartel); edificio.position.set(0, -1.6 + 1.2, -24); escena.add(edificio);
  const polvo = crearParticulas(250, 12, { tam: 0.06, opacidad: 0.5, vel: 0.08, color: 0xbfd0ff }); escena.add(polvo);
  return { escena, actualizar: (dt, t) => polvo.userData.actualizar(dt, t) };
}

/* ───────────── Camino de conducción hasta el laboratorio ───────────── */
export function crearCamino(largo, cartel) {
  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2(0x1d1846, 0.035);
  escena.add(cieloGradiente(90, 0x070b26, 0x3b2a6e, 0x120c22));
  const est = estrellas(); escena.add(est);
  escena.add(new THREE.HemisphereLight(0x9fb2ff, 0x2a1838, 1.3));
  const luna = new THREE.DirectionalLight(0xd6e0ff, 1.0); luna.position.set(-3, 6, 2); escena.add(luna);
  const piso = suelo(0x3a3152, 220); piso.position.z = -largo / 2; escena.add(piso);
  // sendero luminoso
  const sendero = new THREE.Mesh(new THREE.PlaneGeometry(3.2, largo + 20), toon(0x2a2440)); sendero.rotation.x = -Math.PI / 2; sendero.position.set(0, -1.5, -largo / 2); escena.add(sendero);
  const matPoste = toon(0x8892a6), luzA = new THREE.MeshBasicMaterial({ color: 0x5fd4ff }), luzB = new THREE.MeshBasicMaterial({ color: 0xff9a5c });
  for (let z = 0; z > -largo - 6; z -= 4) {
    [-2.3, 2.3].forEach((x, i) => {
      escena.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.2, 8), matPoste), x, -1.0, z));
      escena.add(en(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), (z / 4) % 2 ? luzA : luzB), x, -0.35, z));
    });
  }
  // arcos de control
  const arcos = [];
  [largo / 3, (2 * largo) / 3].forEach((d) => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.07, 10, 48), new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: 0.8 }));
    a.position.set(0, 0, -d); escena.add(a); arcos.push(a);
  });
  const edificio = crearEdificio(cartel); edificio.position.set(0, -1.6 + 1.2 + 0.25, -largo - 5.2); escena.add(edificio);
  const polvo = crearParticulas(300, 10, { tam: 0.06, opacidad: 0.5, vel: 0.1, color: 0xbfd0ff }); escena.add(polvo);
  return { escena, edificio, arcos, polvo };
}

/* ───────────── Laboratorio ───────────── */
function texBaldosa() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#cfd8e0'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#b9c4ce'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
  x.strokeStyle = '#9aa7b3'; x.lineWidth = 2; x.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Texturas sci-fi: un canvas de color y otro de luz (emissive) para las líneas cian
function texDoble(w, h, rep, pintar) {
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const c1 = mk(), c2 = mk(); const x1 = c1.getContext('2d'), x2 = c2.getContext('2d');
  x2.fillStyle = '#000'; x2.fillRect(0, 0, w, h);
  pintar(x1, x2, w, h);
  const t1 = new THREE.CanvasTexture(c1), t2 = new THREE.CanvasTexture(c2);
  [t1, t2].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; });
  t1.colorSpace = t2.colorSpace = THREE.SRGBColorSpace;
  return { map: t1, emissiveMap: t2 };
}
function texPisoSci() {
  return texDoble(512, 512, [4, 4], (x, e, W, H) => {
    x.fillStyle = '#1b2a37'; x.fillRect(0, 0, W, H);
    // placas con leve variación
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      x.fillStyle = `rgba(${(i + j) % 2 ? 40 : 28},${(i + j) % 2 ? 62 : 50},${(i + j) % 2 ? 80 : 68},1)`; x.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
      x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(i * 128 + 3, j * 128 + 3, 122, 4);
      x.fillStyle = '#0c141b'; [[10, 10], [114, 10], [10, 114], [114, 114]].forEach(([a, b]) => { x.beginPath(); x.arc(i * 128 + a, j * 128 + b, 3, 0, 7); x.fill(); });
    }
    // rejillas de ventilación
    [[256, 0], [0, 384]].forEach(([a, b]) => { x.fillStyle = '#101920'; x.fillRect(a + 14, b + 14, 100, 100); x.fillStyle = '#26394a'; for (let k = 0; k < 100; k += 10) x.fillRect(a + 14, b + 18 + k, 100, 4); });
    // juntas oscuras
    x.fillStyle = '#0a1117'; for (let k = 0; k <= W; k += 128) { x.fillRect(k - 2, 0, 4, H); x.fillRect(0, k - 2, W, 4); }
    // líneas de luz cian
    const linea = (x0, y0, x1, y1, a = 1) => { [x, e].forEach((c) => { c.strokeStyle = `rgba(70,220,255,${a})`; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }); };
    linea(150, 60, 230, 60); linea(300, 200, 420, 200); linea(40, 300, 110, 300, 0.8); linea(390, 450, 470, 450); linea(180, 330, 180, 400, 0.7); linea(470, 70, 470, 110, 0.7);
  });
}
function texParedSci() {
  // 256 px = 2 m de ancho, 512 px = 4 m de alto (de 2.4 a -1.6)
  return texDoble(256, 512, [5, 1], (x, e, W, H) => {
    const y = (m) => (2.4 - m) / 4 * H; // altura del mundo → px
    x.fillStyle = '#25394a'; x.fillRect(0, 0, W, H);
    // panel central con bisel
    x.fillStyle = '#2f475b'; x.fillRect(22, y(1.9), W - 44, y(-0.4) - y(1.9));
    x.fillStyle = '#2e4558'; x.fillRect(22, y(1.9), W - 44, 6);
    x.fillStyle = '#16232e'; x.fillRect(22, y(-0.4) - 6, W - 44, 6);
    // banda baja más oscura con ranuras
    x.fillStyle = '#152029'; x.fillRect(0, y(-0.75), W, H - y(-0.75));
    x.fillStyle = '#0e171f'; for (let k = y(-0.85); k < H - 10; k += 14) x.fillRect(30, k, W - 60, 5);
    // banda alta
    x.fillStyle = '#18252f'; x.fillRect(0, 0, W, y(2.05));
    // pilares laterales
    x.fillStyle = '#0f1820'; x.fillRect(0, 0, 14, H); x.fillRect(W - 14, 0, 14, H);
    x.fillStyle = '#34495b'; x.fillRect(14, 0, 3, H); x.fillRect(W - 17, 0, 3, H);
    // luz: franja cian en los pilares y bajo la banda alta
    [x, e].forEach((c) => {
      c.fillStyle = 'rgba(80,225,255,1)';
      c.fillRect(4, y(1.6), 5, y(0.2) - y(1.6)); c.fillRect(W - 9, y(1.6), 5, y(0.2) - y(1.6));
      c.fillRect(22, y(2.05) - 3, W - 44, 3);
      c.fillStyle = 'rgba(80,225,255,.7)'; c.fillRect(40, y(-0.75) + 2, W - 80, 3);
    });
  });
}

export function crearLaboratorio({ institucion, imgInst, imgPatro, patrocinador }) {
  const escena = new THREE.Scene(); escena.background = new THREE.Color(0x03070c); escena.fog = new THREE.Fog(0x050d15, 5, 15);
  const g = new THREE.Group(); escena.add(g);
  const metal = toon(0x7f93a5), oscuro = toon(0x1c2a36), acento = toon(NARANJA);
  const tPared = texParedSci(), tPiso = texPisoSci();
  const pared = new THREE.MeshLambertMaterial({ map: tPared.map, emissive: 0xffffff, emissiveMap: tPared.emissiveMap });
  const luzCian = new THREE.MeshBasicMaterial({ color: 0x4fe3ff });
  const Y0 = -1.6, MESA = -0.55;

  // cuarto
  const muros = [[0, 0.4, -5, 0], [0, 0.4, 5, Math.PI], [-5, 0.4, 0, Math.PI / 2], [5, 0.4, 0, -Math.PI / 2]];
  muros.forEach(([x, y, z, r]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), pared); m.position.set(x, y, z); m.rotation.y = r; g.add(m); });
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshLambertMaterial({ map: tPiso.map, emissive: 0xffffff, emissiveMap: tPiso.emissiveMap }));
  piso.rotation.x = -Math.PI / 2; piso.position.y = Y0; g.add(piso);
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), toon(0x111b24)); techo.rotation.x = Math.PI / 2; techo.position.y = 2.4; g.add(techo);
  // franja institucional (naranja) delgada a media altura
  muros.forEach(([x, , z, r]) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.05), new THREE.MeshBasicMaterial({ color: 0xe35c27 })); f.position.set(x * 0.998, -0.45, z * 0.998); f.rotation.y = r; g.add(f); });
  // paneles de luz
  const panelLuz = new THREE.MeshBasicMaterial({ color: 0x9ff0ff });
  [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), panelLuz); p.rotation.x = Math.PI / 2; p.position.set(x, 2.39, z); g.add(p); });
  const hemi = new THREE.HemisphereLight(0x8fd0ee, 0x0e1a24, 1.05); escena.add(hemi);
  const sol = new THREE.DirectionalLight(0xa8e8ff, 0.35); sol.position.set(2, 4, 3); escena.add(sol);
  const luzMesa = new THREE.PointLight(0x7fe8ff, 1.1, 7, 1.5); luzMesa.position.set(0, 1.5, -1.6); escena.add(luzMesa);
  const roja = new THREE.PointLight(0xff2a2a, 0, 14, 1.2); roja.position.set(0, 2, 0); escena.add(roja);

  // mesón principal
  const mesa = new THREE.Group(); mesa.position.set(0, 0, -1.9); g.add(mesa);
  mesa.add(en(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.1), oscuro), 0, MESA - 0.04, 0));
  mesa.add(en(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.95, 1.0), toon(0x2a3d4c)), 0, MESA - 0.56, 0));
  mesa.add(en(new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.025, 0.01), luzCian), 0, MESA - 0.3, 0.505));
  mesa.add(en(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, 0.9), toon(0x0c141b)), 0, Y0 + 0.025, 0.06));
  mesa.add(en(new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.05, 1.02), acento), 0, MESA - 0.12, 0));
  const zonaCaja = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 40), new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  zonaCaja.rotation.x = -Math.PI / 2; zonaCaja.position.set(-0.95, MESA + 0.005, -1.75); g.add(zonaCaja);

  // contador Geiger
  const geiger = new THREE.Group(); geiger.position.set(-0.45, MESA, -1.95); g.add(geiger);
  geiger.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.24), toon(0xf2c14e)), 0, 0.1, 0));
  const dial = planoCanvas(0.26, 0.13, 256); dial.m.position.set(0, 0.14, 0.121); geiger.add(dial.m);
  const sonda = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), oscuro); sonda.rotation.x = Math.PI / 2; sonda.position.set(0.12, 0.05, 0.2); geiger.add(sonda);
  const luzG = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0x334433 })); luzG.position.set(-0.13, 0.205, 0.08); geiger.add(luzG);
  const dibujarDial = (v) => {
    const x = dial.x; x.fillStyle = '#f7f3e3'; x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#333'; x.lineWidth = 4; x.beginPath(); x.arc(128, 120, 95, Math.PI, 0); x.stroke();
    x.fillStyle = '#d33'; x.fillRect(200, 40, 40, 10);
    const a = Math.PI + v * Math.PI; x.strokeStyle = '#c22'; x.lineWidth = 5; x.beginPath(); x.moveTo(128, 120); x.lineTo(128 + Math.cos(a) * 90, 120 + Math.sin(a) * 90); x.stroke();
    x.fillStyle = '#222'; x.font = 'bold 22px system-ui'; x.fillText('GEIGER', 10, 24); dial.tex.needsUpdate = true;
  };
  dibujarDial(0.05);
  geiger.userData = { dibujarDial, luz: luzG };

  // recipiente de contención
  const recip = new THREE.Group(); recip.position.set(0.45, MESA, -1.95); g.add(recip);
  recip.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.06, 28), metal), 0, 0.03, 0));
  const vidrioMat = new THREE.MeshToonMaterial({ color: 0xbfeaff, gradientMap: GRAD, transparent: true, opacity: 0.32, depthWrite: false });
  recip.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.36, 28, 1, true), vidrioMat), 0, 0.24, 0));
  const tapaR = new THREE.Group(); tapaR.position.set(-0.19, 0.43, 0); recip.add(tapaR);
  tapaR.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 28), metal), 0.19, 0, 0));
  [0.1, 0.35].forEach((y) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.012, 6, 32), acento); a.rotation.x = Math.PI / 2; a.position.y = y; recip.add(a); });
  const brilloR = brillo(0x4aa8ff, 0.8, 0); brilloR.position.y = 0.22; recip.add(brilloR);
  recip.add(en(zonaToque(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12)), 0, 0.25, 0));
  recip.userData = { tapa: tapaR, brillo: brilloR };

  // botón de enfriamiento (aparece en el acto 4)
  const botonFrio = new THREE.Group(); botonFrio.position.set(0, MESA, -1.45); botonFrio.visible = false; g.add(botonFrio);
  botonFrio.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 24), metal), 0, 0.025, 0));
  const tapaFrio = en(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24), toon(0x39c8ff, { emissive: new THREE.Color(0x1aa0ff), emissiveIntensity: 0.6 })), 0, 0.07, 0);
  botonFrio.add(tapaFrio);
  const haloFrio = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 32), new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true }));
  haloFrio.rotation.x = Math.PI / 2; haloFrio.position.y = 0.05; botonFrio.add(haloFrio);
  botonFrio.add(en(zonaToque(new THREE.SphereGeometry(0.25, 10, 8)), 0, 0.05, 0));
  botonFrio.userData = { tapa: tapaFrio, halo: haloFrio };

  // pantalla de estado en la pared frontal
  const pantalla = planoCanvas(2.6, 1.15, 1024); pantalla.m.position.set(0, 1.0, -4.95); g.add(pantalla.m);
  g.add(en(new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.3, 0.05), oscuro), 0, 1.0, -4.99));
  let estadoPantalla = { titulo: 'LABORATORIO', valor: null, color: '#39d0ff', sub: institucion };
  const dibujarPantalla = (t) => {
    const x = pantalla.x, W = pantalla.w, H = pantalla.h, e = estadoPantalla;
    x.fillStyle = '#071521'; x.fillRect(0, 0, W, H);
    x.fillStyle = e.color; x.font = '800 64px system-ui'; x.textAlign = 'left'; x.fillText(e.titulo, 48, 100);
    x.fillStyle = '#9fbfd6'; x.font = '600 36px system-ui'; x.fillText(e.sub || '', 48, 160);
    if (e.valor != null) {
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(48, 230, W - 96, 70);
      x.fillStyle = e.color; x.fillRect(48, 230, (W - 96) * Math.max(0, Math.min(1, e.valor)), 70);
      x.fillStyle = '#fff'; x.font = '800 56px system-ui'; x.fillText(`${Math.round(e.valor * 100)} %`, 48, 380);
    }
    x.strokeStyle = e.color; x.globalAlpha = 0.5; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i < W - 96; i += 6) x.lineTo(48 + i, 420 + Math.sin(i * 0.05 + t * 4) * 14 * (e.ruido || 0.3));
    x.stroke(); x.globalAlpha = 1;
    pantalla.tex.needsUpdate = true;
  };

  // computador (escritorio a la izquierda del mesón)
  const compu = new THREE.Group(); compu.position.set(-2.3, 0, -1.55); g.add(compu);
  compu.lookAt(0, 0, 0);
  compu.add(en(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.7), oscuro), 0, -0.78, 0));
  [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].forEach(([x, z]) => compu.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), metal), x, -1.2, z)));
  compu.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.64, 0.05), toon(0x1c2530)), 0, -0.3, -0.1));
  compu.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), toon(0x1c2530)), 0, -0.66, -0.12));
  compu.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.2), toon(0x333d48)), 0, -0.74, 0.15));
  const pantallaPC = planoCanvas(0.92, 0.58, 768); pantallaPC.m.position.set(0, -0.3, -0.07); compu.add(pantallaPC.m);
  compu.add(en(zonaToque(new THREE.BoxGeometry(1.3, 1.0, 0.8)), 0, -0.45, 0));
  const dibujarPC = (modo, extra = {}) => {
    const x = pantallaPC.x, W = pantallaPC.w, H = pantallaPC.h;
    if (modo === 'tienda') {
      x.fillStyle = '#ffe600'; x.fillRect(0, 0, W, H);
      if (imgPatro) { const r = Math.min((W * 0.7) / imgPatro.width, (H * 0.45) / imgPatro.height); x.drawImage(imgPatro, (W - imgPatro.width * r) / 2, H * 0.12, imgPatro.width * r, imgPatro.height * r); }
      else { x.fillStyle = '#2d3277'; x.font = '800 70px system-ui'; x.textAlign = 'center'; x.fillText(patrocinador.toLowerCase(), W / 2, H * 0.4); }
      x.fillStyle = '#3483fa'; x.fillRect(W * 0.2, H * 0.66, W * 0.6, 70); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '700 38px system-ui';
      x.fillText(extra.texto || 'Toca para comprar', W / 2, H * 0.66 + 48);
    } else if (modo === 'envio') {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffe600'; x.fillRect(0, 0, W, 70);
      x.fillStyle = '#2d3277'; x.font = '800 36px system-ui'; x.textAlign = 'left'; x.fillText(patrocinador, 24, 48);
      x.fillStyle = '#00a650'; x.font = '800 44px system-ui'; x.fillText('Tu compra está en camino', 24, 160);
      x.fillStyle = '#333'; x.font = '600 34px system-ui'; x.fillText(extra.producto || '', 24, 220);
      x.fillStyle = '#e6e6e6'; x.fillRect(24, 280, W - 48, 34); x.fillStyle = '#00a650'; x.fillRect(24, 280, (W - 48) * (extra.k || 0), 34);
      x.fillStyle = '#333'; x.font = '700 40px system-ui'; x.fillText(`Llega en ${Math.max(0, Math.ceil(extra.seg || 0))} s`, 24, 380);
    } else { // inicio con el logo de la institución
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
      if (imgInst) { const r = Math.min((W * 0.62) / imgInst.width, (H * 0.6) / imgInst.height); x.drawImage(imgInst, (W - imgInst.width * r) / 2, H * 0.06, imgInst.width * r, imgInst.height * r); }
      else { x.fillStyle = '#e35c27'; x.font = '900 70px system-ui'; x.textAlign = 'center'; x.fillText(institucion, W / 2, H * 0.4); }
      x.fillStyle = '#3483fa'; x.fillRect(W * 0.18, H * 0.72, W * 0.64, 70); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '700 34px system-ui';
      x.fillText(extra.texto || 'Abrir tienda', W / 2, H * 0.72 + 47);
    }
    x.textAlign = 'left'; pantallaPC.tex.needsUpdate = true;
  };
  dibujarPC('inicio');
  const haloPC = brillo(0x3483fa, 1.6, 0); haloPC.position.set(0, -0.3, 0.1); compu.add(haloPC);
  compu.userData = { dibujar: dibujarPC, halo: haloPC };

  // pared izquierda: ASOOCCIDENTE
  const muroInst = planoCanvas(3.4, 1.9, 1024);
  muroInst.x.fillStyle = '#ffffff'; muroInst.x.fillRect(0, 0, muroInst.w, muroInst.h);
  if (imgInst) { const r = Math.min((muroInst.w * 0.92) / imgInst.width, (muroInst.h * 0.92) / imgInst.height); muroInst.x.drawImage(imgInst, (muroInst.w - imgInst.width * r) / 2, (muroInst.h - imgInst.height * r) / 2, imgInst.width * r, imgInst.height * r); }
  else { muroInst.x.fillStyle = '#e35c27'; muroInst.x.font = '900 150px system-ui'; muroInst.x.textAlign = 'center'; muroInst.x.fillText(institucion, muroInst.w / 2, muroInst.h / 2); }
  muroInst.tex.needsUpdate = true;
  muroInst.m.position.set(-4.95, 0.95, 0.4); muroInst.m.rotation.y = Math.PI / 2; muroInst.m.material.color.set(0xd9e7f0); g.add(muroInst.m);
  { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 3.6), new THREE.MeshBasicMaterial({ color: 0x4fe3ff })); f.position.set(-4.985, 0.95, 0.4); g.add(f);
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.04, 3.54), toon(0x0f171e)); f2.position.set(-4.98, 0.95, 0.4); g.add(f2); }

  // puerta de entregas (pared derecha)
  const puerta = new THREE.Group(); puerta.position.set(4.96, 0, -0.8); g.add(puerta);
  puerta.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.1), metal), 0, Y0 + 1.25, -0.65));
  puerta.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.1), metal), 0, Y0 + 1.25, 0.65));
  puerta.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.4), metal), 0, Y0 + 2.5, 0));
  const exterior = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshBasicMaterial({ color: 0x8fd3ff }));
  exterior.rotation.y = -Math.PI / 2; exterior.position.set(0.02, Y0 + 1.2, 0); puerta.add(exterior);
  const bisagra = new THREE.Group(); bisagra.position.set(-0.02, Y0 + 1.2, 0.6); puerta.add(bisagra);
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.38, 1.18), toon(0x2a3d4c)); hoja.position.z = -0.59; bisagra.add(hoja);
  bisagra.add(en(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), metal), -0.06, 0, -1.05));
  const ventanita = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshBasicMaterial({ color: 0x4fe3ff })); ventanita.rotation.y = -Math.PI / 2; ventanita.position.set(-0.035, 0.45, -0.59); bisagra.add(ventanita);
  const cartel = planoCanvas(1.2, 0.3, 512); cartel.x.fillStyle = '#2d3277'; cartel.x.fillRect(0, 0, 512, 128);
  cartel.x.fillStyle = '#ffe600'; cartel.x.font = '800 64px system-ui'; cartel.x.textAlign = 'center'; cartel.x.fillText('ENTREGAS', 256, 86); cartel.tex.needsUpdate = true;
  cartel.m.rotation.y = -Math.PI / 2; cartel.m.position.set(-0.02, Y0 + 2.75, 0); puerta.add(cartel.m);
  const timbreLuz = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x553300 })); timbreLuz.position.set(-0.05, Y0 + 1.3, 0.9); puerta.add(timbreLuz);
  // afiche del patrocinador junto a la puerta
  const afiche = planoCanvas(1.3, 0.9, 512);
  afiche.x.fillStyle = '#ffe600'; afiche.x.fillRect(0, 0, afiche.w, afiche.h);
  if (imgPatro) { const r = Math.min((afiche.w * 0.8) / imgPatro.width, (afiche.h * 0.6) / imgPatro.height); afiche.x.drawImage(imgPatro, (afiche.w - imgPatro.width * r) / 2, afiche.h * 0.08, imgPatro.width * r, imgPatro.height * r); }
  else { afiche.x.fillStyle = '#2d3277'; afiche.x.font = '800 64px system-ui'; afiche.x.textAlign = 'center'; afiche.x.fillText(patrocinador.toLowerCase(), afiche.w / 2, afiche.h * 0.42); }
  afiche.x.fillStyle = '#2d3277'; afiche.x.font = '700 36px system-ui'; afiche.x.textAlign = 'center'; afiche.x.fillText('Patrocina la feria', afiche.w / 2, afiche.h * 0.86); afiche.tex.needsUpdate = true;
  afiche.m.rotation.y = -Math.PI / 2; afiche.m.position.set(4.97, 0.6, 1.4); g.add(afiche.m);

  // estantes con frascos burbujeantes (pared de atrás)
  const estante = new THREE.Group(); estante.position.set(-1.2, 0, 4.7); g.add(estante);
  [-0.6, 0.3].forEach((y) => estante.add(en(new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.4), oscuro), 0, y, 0)));
  const coloresF = [0x3ddc84, 0xb06cff, 0x39d0ff, 0xffd23f, 0xff6b9a];
  const burbujasF = [];
  for (let i = 0; i < 8; i++) {
    const fila = i < 4 ? -0.6 : 0.3, x = -1.2 + (i % 4) * 0.8, col = coloresF[i % coloresF.length];
    const frasco = new THREE.Group(); frasco.position.set(x, fila + 0.025, 0); estante.add(frasco);
    frasco.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 16), toon(col, { emissive: new THREE.Color(col), emissiveIntensity: 0.4, transparent: true, opacity: 0.8 })), 0, 0.09, 0));
    frasco.add(en(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD, transparent: true, opacity: 0.25 })), 0, 0.2, 0));
    frasco.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 10), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD, transparent: true, opacity: 0.3 })), 0, 0.38, 0));
    const b = crearParticulas(10, 0.07, { tam: 0.035, opacidad: 0.8, vel: 0.15, alto: 0.3, color: col }); b.position.y = 0.2; frasco.add(b); burbujasF.push(b);
  }
  // bobina de Tesla con chispas
  const bobina = new THREE.Group(); bobina.position.set(2.6, Y0, 3.6); g.add(bobina);
  bobina.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.3, 20), oscuro), 0, 0.15, 0));
  bobina.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 20), toon(0xc98b4f)), 0, 0.9, 0));
  const toro = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 12, 32), metal); toro.rotation.x = Math.PI / 2; toro.position.y = 1.6; bobina.add(toro);
  const chispas = crearChispas(0xb9e6ff, 5, 0.7); chispas.position.y = 1.62; bobina.add(chispas);
  const luzBobina = brillo(0x9fd8ff, 1.2, 0.6); luzBobina.position.y = 1.62; bobina.add(luzBobina);
  // balizas de alarma
  const balizas = [];
  [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]].forEach(([x, z]) => {
    const b = new THREE.Group(); b.position.set(x, 2.25, z); g.add(b);
    b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.18, 16), new THREE.MeshBasicMaterial({ color: 0x551111 })));
    const haz = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    haz.rotation.z = Math.PI / 2; haz.position.x = 0.8; const giro = new THREE.Group(); giro.add(haz); b.add(giro);
    balizas.push({ b, giro, haz, cubo: b.children[0] });
  });

  /* ───────── Ambientación: mobiliario y detalles del laboratorio ───────── */
  const blanco = toon(0x2a3d4c), negro = toon(0x0f171e), mango = toon(0x4fe3ff), gris = toon(0x15212b);
  const B = (w, h, d, mat, x, y, z, padre = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); padre.add(m); return m; };
  const C = (rt, rb, h, mat, x, y, z, padre = g, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); padre.add(m); return m; };
  const vidrioClaro = () => new THREE.MeshToonMaterial({ color: 0xbfe6ff, gradientMap: GRAD, transparent: true, opacity: 0.35, depthWrite: false });
  const decal = (w, h, px, dibujar, x, y, z, ry) => { const d = planoCanvas(w, h, px); dibujar(d.x, d.w, d.h); d.tex.needsUpdate = true; d.m.position.set(x, y, z); d.m.rotation.y = ry; g.add(d.m); return d; };
  const MURO_DER = -Math.PI / 2, MURO_IZQ = Math.PI / 2;

  // zócalos y tapete bajo el mesón
  [[0, -4.96, 10, 0], [0, 4.96, 10, 0], [-4.96, 0, 10, 1], [4.96, 0, 10, 1]].forEach(([x, z, l, rot]) => {
    const z0 = B(rot ? 0.06 : l, 0.14, rot ? l : 0.06, oscuro, x, Y0 + 0.07, z);
  });
  const tapete = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.2), new THREE.MeshLambertMaterial({ color: 0x2a3644 }));
  tapete.visible = false; g.add(tapete);

  // gran mesón de pared (fondo) con gabinetes, cajones, lavamanos y equipos
  B(8.1, 1.0, 0.7, blanco, 0.55, Y0 + 0.5, 4.65);
  B(8.2, 0.06, 0.8, negro, 0.55, MESA - 0.03, 4.62);
  for (let i = 0; i <= 8; i++) B(0.015, 0.9, 0.01, gris, -3.5 + i * 1.0125, Y0 + 0.52, 4.295);
  for (let i = 0; i < 8; i++) {
    const cx = -3.5 + i * 1.0125 + 0.5;
    if (i === 3 || i === 4) { [0.2, 0.52, 0.84].forEach((y) => { B(0.95, 0.012, 0.01, gris, cx, Y0 + y - 0.1, 4.294); B(0.34, 0.025, 0.03, mango, cx, Y0 + y + 0.08, 4.28); }); }
    else B(0.03, 0.26, 0.03, mango, cx + (i % 2 ? -0.38 : 0.38), Y0 + 0.78, 4.28);
  }
  // lavamanos con grifo
  B(0.85, 0.02, 0.48, toon(0x9fb0bd), 3.3, MESA + 0.004, 4.58);
  B(0.7, 0.012, 0.34, toon(0x5d6d7a), 3.3, MESA + 0.015, 4.58);
  C(0.022, 0.022, 0.4, metal, 3.3, MESA + 0.2, 4.86);
  B(0.04, 0.04, 0.26, metal, 3.3, MESA + 0.4, 4.75);
  [-0.12, 0.12].forEach((dx) => C(0.03, 0.03, 0.06, toon(0xe35c27), 3.3 + dx, MESA + 0.05, 4.86, g, 10));
  // microondas
  B(0.62, 0.36, 0.44, toon(0x2b3138), -2.6, MESA + 0.18, 4.56);
  B(0.36, 0.24, 0.01, toon(0x7c97aa), -2.69, MESA + 0.19, 4.335);
  B(0.12, 0.26, 0.01, mango, -2.4, MESA + 0.19, 4.335);
  [0.28, 0.12].forEach((y) => C(0.02, 0.02, 0.01, toon(0xe35c27), -2.4, MESA + y - 0.04, 4.328, g, 8).rotateX(Math.PI / 2));
  // incubadora / horno
  B(0.62, 0.46, 0.46, toon(0x34495b), -1.7, MESA + 0.23, 4.55);
  B(0.46, 0.32, 0.01, toon(0x8fb2c6), -1.7, MESA + 0.24, 4.32);
  B(0.1, 0.06, 0.02, toon(0x39d0ff, { emissive: new THREE.Color(0x1aa0ff), emissiveIntensity: 0.9 }), -1.45, MESA + 0.4, 4.32);
  // centrífuga
  C(0.2, 0.22, 0.18, toon(0x3a5164), -0.8, MESA + 0.09, 4.55, g, 24);
  const tapaCentri = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x39d0ff, { transparent: true, opacity: 0.6 }));
  tapaCentri.position.set(-0.8, MESA + 0.18, 4.55); g.add(tapaCentri);
  // gabinetes altos con puertas de vidrio
  B(3.7, 1.0, 0.42, negro, 2.75, 1.05, 4.78);
  for (let i = 0; i < 4; i++) {
    B(0.88, 0.88, 0.02, new THREE.MeshToonMaterial({ color: 0xe6f2fa, gradientMap: GRAD, transparent: true, opacity: 0.4, depthWrite: false }), 1.3 + i * 0.92, 1.05, 4.565);
    B(0.025, 0.28, 0.03, mango, 1.3 + i * 0.92 + 0.12, 1.05, 4.55);
  }
  [1.45, 2.37, 3.29, 4.21].forEach((x, i) => { const col = [0x3ddc84, 0xff6b9a, 0xffd23f, 0x39d0ff][i]; C(0.07, 0.07, 0.2, toon(col, { transparent: true, opacity: 0.85 }), x, 0.78, 4.7, g, 10); });
  // estante de frascos: sube para dejar espacio al mesón
  estante.position.y = 0.55;

  // nevera de vidrio (esquina trasera izquierda)
  const nevera = new THREE.Group(); nevera.position.set(-4.15, Y0 + 1.15, 4.35); g.add(nevera);
  B(1.2, 2.3, 0.8, toon(0x2a3d4c), 0, 0, 0, nevera); B(1.1, 2.1, 0.02, new THREE.MeshBasicMaterial({ color: 0x0d3a4c }), 0, 0.02, -0.39, nevera);
  [-0.29, 0.29].forEach((dx) => { B(0.55, 2.05, 0.02, new THREE.MeshToonMaterial({ color: 0x8dc4de, gradientMap: GRAD, transparent: true, opacity: 0.55, depthWrite: false }), dx, 0.02, -0.41, nevera); B(0.025, 0.7, 0.04, mango, dx + (dx < 0 ? 0.22 : -0.22), 0.02, -0.43, nevera); });
  [-0.7, -0.2, 0.3, 0.8].forEach((y, k) => {
    B(1.1, 0.02, 0.6, gris, 0, y, 0.0, nevera);
    for (let j = 0; j < 4; j++) C(0.05, 0.05, 0.18 + (j % 2) * 0.08, toon([0x3ddc84, 0xb06cff, 0xffd23f, 0xff6b9a, 0x39d0ff][(j + k) % 5]), -0.4 + j * 0.27, y + 0.12, -0.05, nevera, 10);
  });

  // carro con tres bandejas
  const carro = new THREE.Group(); carro.position.set(-2.5, Y0, 3.55); g.add(carro);
  [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.18], [0.24, 0.18]].forEach(([x, z]) => C(0.015, 0.015, 0.95, metal, x, 0.475, z, carro, 8));
  [0.18, 0.55, 0.92].forEach((y, k) => {
    B(0.56, 0.03, 0.44, toon(0x2a3d4c), 0, y, 0, carro);
    const col = [0xffd23f, 0x3ddc84, 0xff6b9a][k];
    B(0.16, 0.1, 0.16, toon(col), -0.12, y + 0.065, 0, carro); C(0.05, 0.05, 0.14, toon(0xffffff, { transparent: true, opacity: 0.6 }), 0.12, y + 0.1, 0.02, carro, 10);
  });
  [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.18], [0.24, 0.18]].forEach(([x, z]) => C(0.03, 0.03, 0.03, mango, x, 0.015, z, carro, 8));

  // pizarras, tabla periódica y moléculas
  const dibujarPizarra = (x, W, H) => {
    x.fillStyle = '#071a26'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(79,227,255,.12)'; x.lineWidth = 1; for (let k = 0; k < W; k += 24) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); } for (let k = 0; k < H; k += 24) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k); x.stroke(); }
    x.strokeStyle = '#4fe3ff'; x.lineWidth = 4; x.strokeRect(4, 4, W - 8, H - 8);
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.fillStyle = '#4fe3ff'; x.font = `700 ${H * 0.085}px "Rajdhani","Trebuchet MS",system-ui`;
    x.fillText('Cristal azul ¿energía?', W * 0.06, H * 0.17);
    x.fillStyle = '#ff5fd2'; x.fillText('E = m · c²', W * 0.06, H * 0.34);
    x.fillStyle = '#5dff8f'; x.fillText('Fe₂O₃ + Al → ?', W * 0.06, H * 0.5);
    x.strokeStyle = '#4fe3ff'; x.lineWidth = H * 0.012; x.beginPath(); x.moveTo(W * 0.06, H * 0.56); x.lineTo(W * 0.52, H * 0.56); x.stroke();
    x.strokeStyle = '#ff5fd2'; x.beginPath(); x.moveTo(W * 0.62, H * 0.1); x.lineTo(W * 0.62, H * 0.62); x.lineTo(W * 0.94, H * 0.62); x.stroke();
    x.strokeStyle = '#5dff8f'; x.beginPath(); for (let i = 0; i <= 20; i++) { const px = W * (0.64 + i * 0.015), py = H * (0.55 - Math.pow(Math.sin(i * 0.3), 2) * 0.3 - i * 0.004); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    x.strokeStyle = '#4fe3ff'; x.lineWidth = H * 0.014; x.beginPath(); x.moveTo(W * 0.16, H * 0.86); x.lineTo(W * 0.16, H * 0.72); x.lineTo(W * 0.08, H * 0.94); x.lineTo(W * 0.24, H * 0.94); x.lineTo(W * 0.16, H * 0.72); x.stroke();
    x.fillStyle = '#ff5fd2'; x.font = `700 ${H * 0.07}px "Rajdhani",system-ui`; x.fillText('¡Cuidado!', W * 0.34, H * 0.9);
    [[W * 0.78, H * 0.86], [W * 0.88, H * 0.8]].forEach(([cx, cy], i) => { x.strokeStyle = i ? '#5dff8f' : '#4fe3ff'; x.beginPath(); x.arc(cx, cy, H * 0.06, 0, Math.PI * 2); x.stroke(); });
  };
  const marco = (w, h, x, y, z, ry, mat = toon(0x22323f)) => {
    const f = B(0.05, h + 0.1, w + 0.1, mat, x, y, z); f.rotation.y = ry === MURO_IZQ ? 0 : 0; return f;
  };
  // pared derecha: pizarra + tabla periódica
  marco(1.4, 0.9, 4.99, 0.65, -3.6, 0); decal(1.4, 0.9, 768, dibujarPizarra, 4.955, 0.65, -3.6, MURO_DER);
  B(0.05, 0.04, 1.2, gris, 4.97, 0.15, -3.6);
  marco(0.95, 0.62, 4.99, 0.65, -2.2, 0, toon(0x2b3138));
  decal(0.95, 0.62, 768, (x, W, H) => {
    x.fillStyle = '#10161c'; x.fillRect(0, 0, W, H);
    const cols = 18, filas = 7, cw = (W - 24) / cols, ch = (H - 24 - 14) / filas;
    const tono = (c, f) => (c === 0 ? '#ff6b6b' : c === 1 ? '#ffb347' : c >= 17 ? '#b69cff' : c >= 12 ? '#4fd1c5' : c >= 2 && c <= 11 ? '#ffe066' : '#8fd3ff');
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      if ((f === 0 && c > 0 && c < 17) || ((f === 1 || f === 2) && c > 1 && c < 12)) continue;
      x.fillStyle = tono(c, f); x.fillRect(12 + c * cw + 1, 12 + f * ch + 1, cw - 2, ch - 2);
    }
    x.fillStyle = 'rgba(255,255,255,.25)'; for (let c = 3; c < 17; c++) { x.fillRect(12 + c * cw + 1, H - 22, cw - 2, 8); }
  }, 4.955, 0.65, -2.2, MURO_DER);
  // pared izquierda: pizarra, estantes con carpetas y moléculas
  marco(1.3, 0.85, -4.99, 0.65, -3.65, 0); decal(1.3, 0.85, 768, dibujarPizarra, -4.955, 0.65, -3.65, MURO_IZQ);
  const carpetas = new THREE.Group(); carpetas.position.set(-4.82, 0, -1.95); g.add(carpetas);
  [0.35, 0.9].forEach((y) => {
    B(0.3, 0.04, 1.3, oscuro, 0, y, 0, carpetas);
    let z = -0.58;
    while (z < 0.58) { const w = rnd(0.045, 0.08); const col = [0xd33a3a, 0x2f6fd6, 0xf2b01e, 0x2fa968, 0x7a4cc4, 0xe9eef3][Math.floor(rnd(0, 6))]; B(0.22, rnd(0.26, 0.34), w, toon(col), 0, y + 0.19, z + w / 2, carpetas); z += w + 0.005; }
  });
  decal(1.3, 1.1, 512, (x, W, H) => {
    const hex = (cx, cy, r, col) => { x.strokeStyle = col; x.lineWidth = 12; x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; i ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.stroke(); };
    hex(W * 0.4, H * 0.32, W * 0.2, '#4fe3ff'); hex(W * 0.62, H * 0.62, W * 0.2, '#ff5fd2'); hex(W * 0.2, H * 0.72, W * 0.13, '#5dff8f');
    x.fillStyle = '#9fefff'; x.font = '700 40px system-ui'; x.fillText('CH₃', W * 0.04, H * 0.46); x.fillText('OH', W * 0.74, H * 0.9);
  }, -4.97, 0.75, 3.1, MURO_IZQ);
  // ventanas (pared frontal)
  [-3.5, 3.5].forEach((vx) => {
    B(1.5, 1.1, 0.06, negro, vx, 0.8, -4.99);
    decal(1.4, 1.0, 512, (x, W, H) => {
      x.fillStyle = '#06202c'; x.fillRect(0, 0, W, H); x.strokeStyle = '#4fe3ff'; x.lineWidth = 6; x.strokeRect(6, 6, W - 12, H - 12);
      x.fillStyle = '#4fe3ff'; x.font = '700 34px "Rajdhani",system-ui'; x.fillText(vx < 0 ? 'MUESTRA · ESPECTRO' : 'SEÑALES VITALES', 26, 50);
      x.strokeStyle = vx < 0 ? '#ff5fd2' : '#5dff8f'; x.lineWidth = 4; x.beginPath();
      for (let i = 0; i <= 60; i++) { const px = 26 + i * (W - 52) / 60, py = H * 0.55 + Math.sin(i * (vx < 0 ? 0.5 : 1.3)) * 40 * (vx < 0 ? 1 : (i % 12 === 0 ? 2.2 : 0.4)); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
      x.fillStyle = 'rgba(79,227,255,.5)'; for (let i = 0; i < 9; i++) x.fillRect(26 + i * 50, H - 40 - (i * 37 % 60), 34, 20 + (i * 37 % 60));
    }, vx, 0.8, -4.95, 0);
  });
  // botiquín y extintor
  B(0.07, 0.34, 0.36, toon(0xf4f6f8), 4.95, 0.45, 3.1); B(0.075, 0.07, 0.2, toon(0xd33a3a), 4.93, 0.45, 3.1); B(0.075, 0.2, 0.07, toon(0xd33a3a), 4.93, 0.45, 3.1);
  const ext = new THREE.Group(); ext.position.set(4.82, -0.15, 3.65); g.add(ext);
  C(0.09, 0.09, 0.5, toon(0xd32f2f), 0, 0, 0, ext, 16); C(0.04, 0.05, 0.1, mango, 0, 0.3, 0, ext, 10); B(0.2, 0.02, 0.03, mango, 0.08, 0.36, 0, ext); C(0.012, 0.012, 0.3, mango, 0.08, 0.2, 0.1, ext, 6);
  B(0.04, 0.05, 0.2, gris, 0.1, 0.1, 0, ext);

  // canecas: biológicos (amarillas) y de residuos
  const caneca = (x, z, col, simbolo) => {
    const k = new THREE.Group(); k.position.set(x, Y0, z); g.add(k);
    C(0.2, 0.17, 0.5, toon(col), 0, 0.25, 0, k, 18); C(0.215, 0.215, 0.05, toon(col), 0, 0.53, 0, k, 18); B(0.08, 0.03, 0.12, mango, 0, 0.05, 0.22, k);
    if (simbolo) { const d = planoCanvas(0.2, 0.2, 128); d.x.fillStyle = '#111'; d.x.font = '900 100px system-ui'; d.x.textAlign = 'center'; d.x.fillText('☣', 64, 100); d.tex.needsUpdate = true; d.m.position.set(0, 0.28, 0.19); k.add(d.m); k.rotation.y = Math.atan2(x, z) + Math.PI; }
    return k;
  };
  caneca(2.15, -2.55, 0xf2c200, true); caneca(-2.0, -2.9, 0xf2c200, true); caneca(4.3, 3.75, 0x4a5560, false);

  // banquetas
  const banqueta = (x, z) => {
    const b = new THREE.Group(); b.position.set(x, Y0, z); g.add(b);
    C(0.19, 0.19, 0.05, toon(0x2a2f36), 0, 0.72, 0, b, 20);
    [0, 1, 2].forEach((i) => { const a = i * Math.PI * 2 / 3; const l = C(0.014, 0.014, 0.72, metal, Math.cos(a) * 0.15, 0.36, Math.sin(a) * 0.15, b, 6); l.rotation.z = Math.cos(a) * 0.08; l.rotation.x = -Math.sin(a) * 0.08; });
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 6, 20), metal); aro.rotation.x = Math.PI / 2; aro.position.y = 0.3; b.add(aro);
  };
  banqueta(-2.2, -0.5); banqueta(2.3, -0.4); banqueta(-0.7, 1.3); banqueta(0.7, 1.3);

  // isla de trabajo (detrás de la persona)
  B(2.8, 1.0, 0.9, blanco, 0, Y0 + 0.5, 2.1); B(2.9, 0.06, 1.0, negro, 0, MESA - 0.03, 2.1); B(2.82, 0.04, 0.92, luzCian, 0, MESA - 0.11, 2.1);
  for (let i = 0; i <= 4; i++) B(0.015, 0.88, 0.01, gris, -1.4 + i * 0.7, Y0 + 0.5, 1.645);
  for (let i = 0; i < 4; i++) B(0.03, 0.24, 0.03, mango, -1.4 + i * 0.7 + 0.3, Y0 + 0.78, 1.63);
  // plancha de calentamiento
  C(0.17, 0.17, 0.05, negro, -0.95, MESA + 0.025, 2.1, g, 24); const aroCalor = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff6a2a })); aroCalor.rotation.x = Math.PI / 2; aroCalor.position.set(-0.95, MESA + 0.055, 2.1); g.add(aroCalor);
  // matraz Erlenmeyer sobre la plancha
  const matraz = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 18, 1, true), vidrioClaro()); matraz.position.set(-0.95, MESA + 0.15, 2.1); g.add(matraz);
  C(0.035, 0.035, 0.12, vidrioClaro(), -0.95, MESA + 0.31, 2.1, g, 12);
  const liquido = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.1, 18), toon(0x39d0ff, { emissive: new THREE.Color(0x1aa0ff), emissiveIntensity: 0.5 })); liquido.position.set(-0.95, MESA + 0.1, 2.1); liquido.rotation.x = Math.PI; g.add(liquido);
  const burbPlancha = crearParticulas(8, 0.04, { tam: 0.03, opacidad: 0.8, vel: 0.2, alto: 0.2, color: 0x9fe6ff }); burbPlancha.position.set(-0.95, MESA + 0.2, 2.1); g.add(burbPlancha);
  // microscopio
  const mic = new THREE.Group(); mic.position.set(0.35, MESA, 2.1); g.add(mic);
  B(0.26, 0.04, 0.2, negro, 0, 0.02, 0, mic); B(0.05, 0.3, 0.05, toon(0x8aa0b2), -0.06, 0.18, 0, mic);
  const tubo = C(0.03, 0.03, 0.22, toon(0xe8ecef), 0.0, 0.3, 0.02, mic, 12); tubo.rotation.x = -0.45; C(0.015, 0.015, 0.1, metal, 0.0, 0.2, 0.09, mic, 8).rotation.x = -0.45; B(0.16, 0.015, 0.1, metal, 0, 0.11, 0.06, mic);
  // gradilla con tubos de ensayo
  B(0.4, 0.04, 0.12, toon(0xc99a5c), 0.95, MESA + 0.14, 2.1); B(0.4, 0.02, 0.12, toon(0xb7894f), 0.95, MESA + 0.03, 2.1);
  [-0.15, -0.075, 0, 0.075, 0.15].forEach((dx, i) => { C(0.016, 0.016, 0.2, toon([0x3ddc84, 0xff6b9a, 0xffd23f, 0x39d0ff, 0xb06cff][i], { transparent: true, opacity: 0.85 }), 0.95 + dx, MESA + 0.12, 2.1, g, 8); });
  // tuberías y ductos de techo
  C(0.07, 0.07, 9.6, toon(0x34495b), 0, 2.26, 3.3, g, 12).rotation.z = Math.PI / 2; C(0.07, 0.07, 9.6, toon(0x34495b), 0, 2.26, -3.3, g, 12).rotation.z = Math.PI / 2;
  [-3, 3].forEach((x) => { B(0.7, 0.1, 0.7, toon(0x22323f), x, 2.35, 0); B(0.5, 0.02, 0.5, luzCian, x, 2.29, 0); });
  // plantas en maceta
  const planta = (x, z) => {
    const p = new THREE.Group(); p.position.set(x, Y0, z); g.add(p);
    C(0.2, 0.14, 0.3, toon(0xc9673a), 0, 0.15, 0, p, 14);
    for (let i = 0; i < 7; i++) { const a = i * 0.9; const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), toon(i % 2 ? 0x2f9e57 : 0x3fbf6a)); h.scale.set(0.5, 1.3, 0.25); h.position.set(Math.cos(a) * 0.12, 0.5 + (i % 3) * 0.12, Math.sin(a) * 0.12); h.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5); p.add(h); }
  };
  
  // tanques de cultivo con líquido brillante (estilo referencia)
  const tanques = [];
  const tanque = (x, z, col, luz) => {
    const t = new THREE.Group(); t.position.set(x, Y0, z); g.add(t);
    C(0.42, 0.46, 0.22, toon(0x22323f), 0, 0.11, 0, t, 24); C(0.44, 0.44, 0.03, luzCian, 0, 0.23, 0, t, 24);
    const liq = C(0.3, 0.3, 1.25, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.75, transparent: true, opacity: 0.8 }), 0, 0.86, 0, t, 24);
    C(0.34, 0.34, 1.4, new THREE.MeshToonMaterial({ color: 0xbfefff, gradientMap: GRAD, transparent: true, opacity: 0.18, depthWrite: false }), 0, 0.93, 0, t, 24);
    C(0.38, 0.4, 0.2, toon(0x22323f), 0, 1.72, 0, t, 24); C(0.12, 0.16, 0.18, toon(0x34495b), 0, 1.9, 0, t, 12);
    [0.5, 1.3].forEach((y) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.018, 6, 28), metal); a.rotation.x = Math.PI / 2; a.position.y = y; t.add(a); });
    const ser = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0x0c2a1c)); ser.scale.set(1, 1.5, 1); ser.position.y = 0.95; t.add(ser);
    const b = crearParticulas(14, 0.22, { tam: 0.04, opacidad: 0.8, vel: 0.25, alto: 1.1, color: 0xe6fff0 }); b.position.y = 0.9; t.add(b);
    const h = brillo(col, 1.8, 0.35); h.position.y = 0.9; t.add(h);
    if (luz) { const l = new THREE.PointLight(col, 1.2, 4.5, 1.6); l.position.set(0, 1.0, 0); t.add(l); }
    tanques.push({ b, ser, liq, fase: Math.random() * 6 });
  };
  tanque(-4.2, -4.2, 0x3dff8f, true); tanque(4.2, -4.2, 0x3dff8f, false); tanque(3.95, 2.45, 0xc05bff, true);

  // plataforma circular central (bajo la persona)
  const plat = new THREE.Group(); plat.position.set(0, Y0 + 0.008, 0); plat.rotation.x = -Math.PI / 2; g.add(plat);
  const disco = (r0, r1, col, a0 = 0, a1 = Math.PI * 2, basic = false) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48, 1, a0, a1), basic ? new THREE.MeshBasicMaterial({ color: col }) : new THREE.MeshLambertMaterial({ color: col })); plat.add(m); return m; };
  disco(0, 1.45, 0x15232e);
  disco(1.36, 1.4, 0x4fe3ff, 0, Math.PI * 2, true);
  for (let i = 0; i < 12; i++) disco(0.85, 1.25, i % 2 ? 0x223747 : 0x1a2c39, i * Math.PI / 6 + 0.03, Math.PI / 6 - 0.06);
  disco(0.62, 0.8, 0x2b3a4f); disco(0.6, 0.63, 0x4fe3ff, 0, Math.PI * 2, true);
  disco(0, 0.58, 0x3a3566); disco(0.36, 0.4, 0xe35c27, 0, Math.PI * 2, true);
  const tri = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), new THREE.MeshBasicMaterial({ color: 0xffd23f })); tri.rotation.z = Math.PI / 2; tri.position.z = 0.002; plat.add(tri);
  const triIn = new THREE.Mesh(new THREE.CircleGeometry(0.08, 3), new THREE.MeshBasicMaterial({ color: 0x2b2340 })); triIn.rotation.z = Math.PI / 2; triIn.position.z = 0.003; plat.add(triIn);
  const anilloPlat = disco(1.0, 1.04, 0x4fe3ff, 0, Math.PI * 0.6, true); anilloPlat.position.z = 0.002;

  // franjas de peligro amarillo/negro en el piso
  const cPel = document.createElement('canvas'); cPel.width = 256; cPel.height = 32; const xp = cPel.getContext('2d');
  xp.fillStyle = '#111'; xp.fillRect(0, 0, 256, 32); xp.fillStyle = '#f2c200'; for (let k = -32; k < 256; k += 32) { xp.beginPath(); xp.moveTo(k, 32); xp.lineTo(k + 16, 0); xp.lineTo(k + 32, 0); xp.lineTo(k + 16, 32); xp.fill(); }
  const tPel = new THREE.CanvasTexture(cPel); tPel.wrapS = THREE.RepeatWrapping; tPel.colorSpace = THREE.SRGBColorSpace;
  const peligro = (l, x, z, rot = 0) => { const tt = tPel.clone(); tt.needsUpdate = true; tt.repeat.set(l / 1.0, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(l, 0.12), new THREE.MeshLambertMaterial({ map: tt })); m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, Y0 + 0.01, z); g.add(m); };
  peligro(3.3, 0, -1.25); peligro(1.4, 4.4, -0.8, Math.PI / 2); peligro(2.9, 0, 1.55); peligro(7.8, 0.55, 4.18);
  // cables por el piso
  [[-4.6, 3.6, -3.0, 4.5], [3.7, 2.3, 4.7, 1.0]].forEach(([x0, z0, x1, z1], i) => {
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, Y0 + 0.03, z0), new THREE.Vector3((x0 + x1) / 2 + 0.3, Y0 + 0.03, (z0 + z1) / 2 - 0.2), new THREE.Vector3(x1, Y0 + 0.03, z1)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 16, 0.025, 6), toon(i ? 0x1b5f8a : 0x2a2a3a)));
  });
  // luz cálida sobre el mesón y motas de polvo en el aire
  const luzCalida = new THREE.PointLight(0x6fd8ff, 0.5, 9, 1.4); luzCalida.position.set(0, 1.6, -1.2); escena.add(luzCalida);
  const polvo = crearParticulas(60, 4.6, { tam: 0.04, opacidad: 0.35, vel: 0.04, alto: 3.8, color: 0x7fe8ff }); polvo.position.y = 0.4; g.add(polvo);

  let alarma = false;
  const setAlarma = (on) => { alarma = on; };
  const setPantalla = (e) => { estadoPantalla = { ...estadoPantalla, ...e }; };
  let acum = 0;
  const actualizar = (dt, t) => {
    chispas.userData.actualizar(dt); luzBobina.material.opacity = rnd(0.3, 0.8);
    burbujasF.forEach((b) => b.userData.actualizar(dt, t));
    burbPlancha.userData.actualizar(dt, t); polvo.userData.actualizar(dt, t);
    tanques.forEach((k) => { k.b.userData.actualizar(dt, t); k.ser.position.y = 0.95 + Math.sin(t * 0.8 + k.fase) * 0.06; k.ser.rotation.y += dt * 0.3; k.liq.material.emissiveIntensity = 0.65 + Math.sin(t * 2 + k.fase) * 0.12; });
    anilloPlat.rotation.z -= dt * 0.4;
    balizas.forEach((z, i) => {
      z.giro.rotation.y += dt * (alarma ? 5 : 0);
      z.haz.material.opacity = alarma ? 0.22 : 0;
      z.cubo.material.color.set(alarma && Math.sin(t * 10 + i) > 0 ? 0xff2222 : 0x551111);
    });
    roja.intensity = alarma ? 2 + Math.sin(t * 8) * 1.5 : 0;
    hemi.intensity = alarma ? 0.5 : 1.05;
    acum += dt; if (acum > 1 / 15) { acum = 0; dibujarPantalla(t); }
  };
  dibujarPantalla(0);
  return {
    escena, grupo: g, MESA, Y0, geiger, recip, botonFrio, compu, zonaCaja,
    puerta: { grupo: puerta, bisagra, timbreLuz }, setAlarma, setPantalla, actualizar,
  };
}

/* ───────────── Caja de envío ───────────── */
export function crearCaja({ imgPatro, patrocinador }) {
  const g = new THREE.Group();
  const carton = toon(0xc99a5c), cinta = toon(0xffe600);
  g.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.4), carton), 0, 0.16, 0));
  g.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.325, 0.405), cinta), 0, 0.16, 0));
  const tapa = new THREE.Group(); tapa.position.set(0, 0.32, -0.2); g.add(tapa);
  tapa.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.42), carton), 0, 0.015, 0.2));
  tapa.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.425), cinta), 0, 0.015, 0.2));
  const et = planoCanvas(0.3, 0.16, 256);
  et.x.fillStyle = '#ffe600'; et.x.fillRect(0, 0, 256, 137);
  if (imgPatro) { const r = Math.min(220 / imgPatro.width, 110 / imgPatro.height); et.x.drawImage(imgPatro, (256 - imgPatro.width * r) / 2, (137 - imgPatro.height * r) / 2, imgPatro.width * r, imgPatro.height * r); }
  else { et.x.fillStyle = '#2d3277'; et.x.font = '800 30px system-ui'; et.x.textAlign = 'center'; et.x.fillText(patrocinador.toLowerCase(), 128, 80); }
  et.tex.needsUpdate = true; et.m.position.set(0.12, 0.17, 0.202); g.add(et.m);
  const et2 = et.m.clone(); et2.position.set(0.12, 0.17, -0.202); et2.rotation.y = Math.PI; g.add(et2);
  g.add(en(zonaToque(new THREE.BoxGeometry(0.8, 0.7, 0.7)), 0, 0.2, 0));
  g.userData = { tapa };
  return g;
}

/* ───────────── Herramientas ───────────── */
export function crearPinzas() {
  const g = new THREE.Group(); const acero = toon(0xc8d3dd), mango = toon(NARANJA);
  [-1, 1].forEach((s) => {
    const brazo = new THREE.Group(); brazo.rotation.z = s * 0.12; g.add(brazo);
    brazo.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.03), acero), 0, -0.21, 0));
    brazo.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.04), mango), 0, -0.06, 0));
  });
  g.add(en(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), acero), 0, 0, 0));
  g.add(en(zonaToque(new THREE.SphereGeometry(0.28, 10, 8)), 0, -0.2, 0));
  return g;
}
export function crearGuantes() {
  const g = new THREE.Group(); const mat = toon(0xff8a3d);
  [-0.13, 0.13].forEach((x, i) => {
    const m = new THREE.Group(); m.position.x = x; m.rotation.z = i ? -0.2 : 0.2; g.add(m);
    m.add(en(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.05), mat), 0, 0, 0));
    for (let k = 0; k < 4; k++) m.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8), mat), -0.05 + k * 0.033, 0.12, 0));
    m.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 8), mat), i ? -0.085 : 0.085, 0.03, 0));
    m.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.1, 16), toon(0x333d48)), 0, -0.12, 0));
  });
  g.add(en(zonaToque(new THREE.SphereGeometry(0.3, 10, 8)), 0, 0, 0));
  return g;
}
export function crearNucleo() {
  const g = new THREE.Group();
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), toon(0x7ef9ff, { emissive: new THREE.Color(0x37e0ff), emissiveIntensity: 1 }));
  g.add(esfera);
  const anillos = [];
  [0, 1].forEach((i) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 32), toon(NARANJA)); a.rotation.x = i ? Math.PI / 2 : 0.6; g.add(a); anillos.push(a); });
  const h = brillo(0x7ef9ff, 0.6, 0.7); g.add(h);
  g.add(zonaToque(new THREE.SphereGeometry(0.28, 10, 8)));
  g.userData = { anillos };
  return g;
}

/* ───────────── Criaturas del cristal ───────────── */
export function crearCriatura(color) {
  const g = new THREE.Group(); const c = new THREE.Color(color);
  const mat = toon(color, { emissive: c, emissiveIntensity: 0.45, transparent: true, opacity: 0.95 });
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), mat); cuerpo.scale.set(1, 0.85, 1); g.add(cuerpo);
  const ojoB = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); ojoB.position.set(0, 0.03, 0.15); g.add(ojoB);
  const pupila = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0x111122 })); pupila.position.set(0, 0.03, 0.215); g.add(pupila);
  [-1, 1].forEach((s) => {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mat); ant.position.set(s * 0.08, 0.22, 0); ant.rotation.z = -s * 0.4; g.add(ant);
    const punta = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.5) })); punta.position.set(s * 0.115, 0.3, 0); g.add(punta);
  });
  const aletas = new THREE.Group(); g.add(aletas);
  for (let i = 0; i < 5; i++) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), mat); const r = (i / 5) * Math.PI * 2; a.position.set(Math.cos(r) * 0.12, -0.18, Math.sin(r) * 0.12); a.rotation.x = Math.PI; aletas.add(a); }
  const h = brillo(color, 0.9, 0.45); g.add(h);
  g.add(en(zonaToque(new THREE.SphereGeometry(0.42, 12, 8)), 0, 0, 0));
  g.userData = { mat, aletas, cuerpo };
  return g;
}

/* ───────────── Cápsula de contención (5 piezas) ───────────── */
export function crearCapsula() {
  const capsula = new THREE.Group();
  const metal = toon(0x8b9bab), oscuro = toon(0x2b3a4a), acento = toon(NARANJA);
  const fantasmaMat = new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.2, depthWrite: false });
  const vidrioMat = new THREE.MeshToonMaterial({ color: 0x9fe8ff, gradientMap: GRAD, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const defs = [
    { nombre: 'base', y: 0.05, partes: () => [new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.1, 32), oscuro), en(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 40).rotateX(Math.PI / 2), acento), 0, 0.05, 0)] },
    { nombre: 'vidrio', y: 0.36, partes: () => [new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.52, 32, 1, true), vidrioMat), en(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 8, 40).rotateX(Math.PI / 2), metal), 0, 0.25, 0), en(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 8, 40).rotateX(Math.PI / 2), metal), 0, -0.25, 0)] },
    { nombre: 'tapa', y: 0.66, partes: () => [new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 32), metal), en(new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), oscuro), 0, 0.04, 0)] },
    { nombre: 'sensor', y: 0.95, partes: () => [new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 8), metal), en(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), toon(0xff3344, { emissive: new THREE.Color(0xff3344), emissiveIntensity: 0.8 })), 0, 0.15, 0)] },
  ];
  const piezas = [];
  defs.forEach((d) => {
    const fantasma = new THREE.Group(); fantasma.position.y = d.y; capsula.add(fantasma);
    d.partes().forEach((m) => { const f = m.clone(); f.material = fantasmaMat; fantasma.add(f); });
    const grupo = new THREE.Group();
    d.partes().forEach((m) => grupo.add(m));
    grupo.add(zonaToque(new THREE.SphereGeometry(0.3, 10, 8)));
    capsula.add(grupo);
    piezas.push({ nombre: d.nombre, grupo, destino: new THREE.Vector3(0, d.y, 0), colocada: false, fantasma });
  });
  // ranura del núcleo (quinta pieza, se pide por la tienda)
  const fantasmaNucleo = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), fantasmaMat.clone()); fantasmaNucleo.position.y = 0.36; fantasmaNucleo.visible = false; capsula.add(fantasmaNucleo);
  const luzInterior = brillo(0x7ef9ff, 0.9, 0); luzInterior.position.y = 0.36; capsula.add(luzInterior);
  return { capsula, piezas, fantasmaMat, fantasmaNucleo, luzInterior, vidrioMat };
}
