import * as THREE from 'three';
import { Mirada } from './controles.js';
import * as M from './modelos.js';
import { audio } from './audio.js';
import { Tienda } from './tienda.js';

/* ───────────── Configuración ───────────── */
const cfg = Object.assign({
  titulo: 'Misión Cristal Azul', institucion: 'ASOOCCIDENTE', logoInstitucion: '', patrocinador: 'Mercado Libre', logoPatrocinador: '',
  segundosEnvio: 5, segundosEstabilidad: 40, segundosCaptura: 30, criaturasObjetivo: 10, criaturasDistractoras: 14, largoCamino: 54,
}, window.DEMO_CONFIG || {});
cfg.final = Object.assign({ titulo: 'Misión cumplida', mensaje: '', contacto: '', qr: '' }, cfg.final || {});
const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = M.rnd;
const vibrar = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ease = {
  io: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
  back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};
const VERDE = 0x3dff8f;
const estado = { choques: 0, tiempoCamino: 0, estabilidad: null, criaturas: null, entregas: 0, tiempoCapsula: 0, fase: 'inicio' };
const nombrados = {};
let imgInst = null, imgPatro = null;

/* ───────────── Interfaz ───────────── */
const mostrar = (el, si = true) => el.classList.toggle('oculto', !si);
let toastTimer = null;
function toast(html, ms) {
  const t = $('#toast'); clearTimeout(toastTimer);
  if (!html) { mostrar(t, false); return; }
  t.innerHTML = html; mostrar(t, false); void t.offsetWidth; mostrar(t);
  if (ms) toastTimer = setTimeout(() => mostrar(t, false), ms);
}
function tarjeta(sobre, titulo, html, boton = 'Continuar') {
  return new Promise((res) => {
    $('#tarjeta-sobre').textContent = sobre; $('#tarjeta-titulo').textContent = titulo;
    $('#tarjeta-texto').innerHTML = html; $('#tarjeta-btn').textContent = boton;
    mostrar($('#tarjeta'));
    $('#tarjeta-btn').onclick = () => { audio.tic(); mostrar($('#tarjeta'), false); res(); };
  });
}
function hud(paso, etapa, info = '') {
  mostrar($('#hud'));
  if (paso) [...document.querySelectorAll('.progreso i')].forEach((el, i) => { el.className = i + 1 < paso ? 'hecho' : i + 1 === paso ? 'activo' : ''; });
  if (etapa != null) $('#hud-etapa').textContent = etapa;
  $('#hud-info').innerHTML = info;
}
async function mostrarTransicion(texto) {
  $('#transicion-texto').textContent = texto;
  const el = $('#transicion'); mostrar(el);
  if (!el.classList.contains('visible')) { void el.offsetWidth; el.classList.add('visible'); await esperar(650); }
}
async function ocultarTransicion() { const el = $('#transicion'); el.classList.remove('visible'); await esperar(650); mostrar(el, false); }
function destello() { const d = $('#destello'); d.classList.add('on'); setTimeout(() => d.classList.remove('on'), 300); }
const medidor = {
  mostrar(txt) { $('#medidor-txt').textContent = txt; mostrar($('#medidor')); },
  valor(v) { $('#medidor-barra').style.width = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`; },
  ocultar() { mostrar($('#medidor'), false); },
};
const ICON = {
  pinzas: '🔧', guantes: '🧤', nucleo: '🔋',
};
const inventario = {
  poner(id) { if ($(`#inventario [data-id="${id}"]`)) return; const s = document.createElement('span'); s.dataset.id = id; s.textContent = ICON[id] || '📦'; $('#inventario').appendChild(s); mostrar($('#inventario')); },
  quitar(id) { const s = $(`#inventario [data-id="${id}"]`); if (s) s.remove(); if (!$('#inventario').children.length) mostrar($('#inventario'), false); },
};

/* ───────────── Motor 3D ───────────── */
let renderer, camara, rig, mirada, escena = null, xrFrame = null;
const reloj = new THREE.Clock();
const tareas = new Set();
let tareasEtapa = [];
let interactivos = [];
let objetivosFlecha = [];
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let conduccion = null; // {x,y} entrada manual mientras se conduce

function tarea(fn, deEtapa = true) { tareas.add(fn); if (deEtapa) tareasEtapa.push(fn); return fn; }
function limpiarTareas() { tareasEtapa.forEach((f) => tareas.delete(f)); tareasEtapa = []; }
function efimero(fn) { const f = (dt, t) => { if (fn(dt, t) === false) tareas.delete(f); }; tareas.add(f); }
function animar(dur, fn, curva = ease.io) {
  return new Promise((res) => {
    let e = 0;
    const f = (dt) => { e += dt; const k = Math.min(e / dur, 1); fn(curva(k), k); if (k >= 1) { tareas.delete(f); res(); } };
    tareas.add(f);
  });
}

function iniciarMotor() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('#vr').appendChild(renderer.domElement);
  camara = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 220);
  rig = new THREE.Group(); rig.add(camara);
  mirada = new Mirada(camara);
  addEventListener('resize', () => { camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  punteros(renderer.domElement);
  teclado();
  mostrar($('#btn-sonido'));
  renderer.setAnimationLoop(bucle);
}

function bucle(_, frame) {
  const dt = Math.min(reloj.getDelta(), 0.05), t = reloj.elapsedTime;
  const enXR = renderer.xr.isPresenting;
  if (!enXR) mirada.update();
  if (frame && xrFrame) xrFrame(frame);
  for (const f of [...tareas]) { try { f(dt, t); } catch (e) { console.error(e); tareas.delete(f); } }
  rig.updateMatrixWorld(true);
  bordeArrastre(dt);
  if (escena) renderer.render(escena, camara);
  if (!enXR) actualizarFlechas();
}

function rayoDesde(ev) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  rig.updateMatrixWorld(true);
  ray.setFromCamera(ndc, camara);
}
function golpe(ev) {
  rayoDesde(ev);
  const hs = ray.intersectObjects(interactivos, true);
  for (const h of hs) {
    let o = h.object;
    while (o) { if (o.userData.alTocar || o.userData.arrastre || o.userData.mantener) return { obj: o, punto: h.point }; o = o.parent; }
  }
  return null;
}

let ptr = null;
function punteros(dom) {
  dom.addEventListener('pointerdown', (ev) => {
    ptr = { x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, movido: false, drag: null, mant: null, ev };
    if (conduccion) { dirigir(ev); try { dom.setPointerCapture(ev.pointerId); } catch (e) {} return; }
    const h = golpe(ev);
    if (h) {
      const u = h.obj.userData;
      if (u.arrastre && u.arrastre.inicio(ev, h)) ptr.drag = h.obj;
      else if (u.mantener) { ptr.mant = h.obj; iniciarMantener(h.obj, ev); }
    }
    try { dom.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  dom.addEventListener('pointermove', (ev) => {
    if (conduccion) { if (ptr || ev.pointerType === 'mouse') dirigir(ev); return; }
    if (!ptr) return;
    const dx = ev.clientX - ptr.lx, dy = ev.clientY - ptr.ly; ptr.lx = ev.clientX; ptr.ly = ev.clientY; ptr.ev = ev;
    if (Math.hypot(ev.clientX - ptr.x, ev.clientY - ptr.y) > 8) ptr.movido = true;
    if (ptr.drag) ptr.drag.userData.arrastre && ptr.drag.userData.arrastre.mover(ev);
    else if (ptr.mant) { posicionarAnillo(ev); if (Math.hypot(ev.clientX - ptr.x, ev.clientY - ptr.y) > 40) cancelarMantener(); }
    else if (ptr.movido) mirada.arrastrar(dx, dy);
  });
  const fin = (ev) => {
    if (!ptr) return;
    if (conduccion) { ptr = null; return; }
    if (ptr.drag) { const a = ptr.drag.userData.arrastre; if (a) a.soltar(ev); }
    else if (ptr.mant) cancelarMantener();
    else if (!ptr.movido && ev.type === 'pointerup') {
      const h = golpe(ev);
      if (h && h.obj.userData.alTocar) h.obj.userData.alTocar(h);
    }
    ptr = null;
  };
  dom.addEventListener('pointerup', fin);
  dom.addEventListener('pointercancel', fin);
}
function dirigir(ev) {
  conduccion.x = THREE.MathUtils.clamp(((ev.clientX / innerWidth) * 2 - 1) * 1.25, -1, 1);
  conduccion.y = THREE.MathUtils.clamp(-((ev.clientY / innerHeight) * 2 - 1) * 1.6 + 0.3, -1, 1);
}
function teclado() {
  addEventListener('keydown', (e) => {
    if (!conduccion) return;
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (k) { conduccion.x = THREE.MathUtils.clamp(conduccion.x + k[0] * 0.35, -1, 1); conduccion.y = THREE.MathUtils.clamp(conduccion.y + k[1] * 0.35, -1, 1); }
  });
}
// sin giroscopio: al arrastrar un objeto cerca del borde, la vista gira
function bordeArrastre(dt) {
  if (!ptr || !ptr.drag || mirada.gyro || !ptr.ev || !(ptr.drag.userData.arrastre && ptr.drag.userData.arrastre.bordes)) return;
  const x = ptr.ev.clientX / innerWidth;
  const v = x < 0.12 ? 1 : x > 0.88 ? -1 : 0;
  if (v) { mirada.yaw += v * dt * 1.4; mirada.update(); rig.updateMatrixWorld(true); ptr.drag.userData.arrastre && ptr.drag.userData.arrastre.mover(ptr.ev); }
}

// ── mantener presionado ──
let mant = null;
function posicionarAnillo(ev) { const a = $('#mantener'); a.style.left = ev.clientX + 'px'; a.style.top = ev.clientY + 'px'; }
function iniciarMantener(obj, ev) {
  const m = obj.userData.mantener; let k = 0;
  posicionarAnillo(ev); mostrar($('#mantener'));
  m.alIniciar && m.alIniciar();
  const f = (dt) => {
    k = Math.min(1, k + dt / m.dur);
    $('#mantener-arco').style.strokeDashoffset = String(100.5 * (1 - k));
    m.alProgreso && m.alProgreso(k, dt);
    if (k >= 1) { tareas.delete(f); mant = null; mostrar($('#mantener'), false); if (ptr) ptr.mant = null; m.alCompletar && m.alCompletar(); }
  };
  mant = { f, m }; tareas.add(f);
}
function cancelarMantener() {
  if (!mant) { mostrar($('#mantener'), false); return; }
  tareas.delete(mant.f); const m = mant.m; mant = null; if (ptr) ptr.mant = null;
  mostrar($('#mantener'), false); m.alSoltar && m.alSoltar();
}

function esperarToque(obj) {
  return new Promise((res) => { obj.userData.alTocar = (h) => { delete obj.userData.alTocar; audio.tic(); res(h); }; });
}

const vtmp = new THREE.Vector3(), vloc = new THREE.Vector3();
function actualizarFlechas() {
  const izq = $('#flecha-izq'), der = $('#flecha-der');
  const vivos = objetivosFlecha.filter((o) => o && o.parent && o.visible && !o.userData.muerta);
  if (!vivos.length || !camara) { mostrar(izq, false); mostrar(der, false); return; }
  let mejor = null, mejorAng = Infinity;
  for (const o of vivos) {
    o.getWorldPosition(vtmp); vloc.copy(vtmp); camara.worldToLocal(vloc);
    const p = vtmp.clone().project(camara);
    if (vloc.z < 0 && Math.abs(p.x) < 0.92 && Math.abs(p.y) < 0.92) { mostrar(izq, false); mostrar(der, false); return; }
    const ang = Math.acos(THREE.MathUtils.clamp(-vloc.z / vloc.length(), -1, 1));
    if (ang < mejorAng) { mejorAng = ang; mejor = vloc.x; }
  }
  mostrar(izq, mejor < 0); mostrar(der, mejor >= 0);
}

/* ───────────── Arrastres reutilizables ───────────── */
// Lleva un objeto flotando a una distancia fija del dedo (sirve para cruzar el cuarto girando el celular)
function arrastreLlevar(obj, { distancia = 2, alMover, alSoltar }) {
  obj.userData.arrastre = {
    bordes: true,
    inicio() { audio.agarrar(); return true; },
    mover(ev) {
      rayoDesde(ev);
      const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, distancia);
      obj.parent.worldToLocal(p); obj.position.copy(p);
      alMover && alMover(obj.getWorldPosition(new THREE.Vector3()));
    },
    soltar() { alSoltar && alSoltar(obj.getWorldPosition(new THREE.Vector3())); },
  };
}
// Arrastra sobre un plano horizontal (la superficie del mesón)
function arrastreMesa(obj, { altura, limites, alMover, alSoltar }) {
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -altura), pt = new THREE.Vector3();
  obj.userData.arrastre = {
    inicio() { audio.agarrar(); return true; },
    mover(ev) {
      rayoDesde(ev);
      if (!ray.ray.intersectPlane(plano, pt)) return;
      if (limites) { pt.x = THREE.MathUtils.clamp(pt.x, limites[0], limites[1]); pt.z = THREE.MathUtils.clamp(pt.z, limites[2], limites[3]); }
      const l = obj.parent.worldToLocal(pt.clone()); obj.position.set(l.x, obj.position.y, l.z);
      alMover && alMover(obj.getWorldPosition(new THREE.Vector3()));
    },
    soltar() { alSoltar && alSoltar(obj.getWorldPosition(new THREE.Vector3())); },
  };
}
// Arrastra sobre un plano vertical que mira a la cámara (armar piezas)
function arrastreFrente(obj, referencia, { alSoltar }) {
  const plano = new THREE.Plane(), pt = new THREE.Vector3(), off = new THREE.Vector3();
  obj.userData.arrastre = {
    inicio(ev) {
      const wp = referencia.getWorldPosition(new THREE.Vector3());
      const n = camara.getWorldPosition(new THREE.Vector3()).sub(wp); n.y = 0; n.normalize();
      plano.setFromNormalAndCoplanarPoint(n, wp);
      rayoDesde(ev);
      if (ray.ray.intersectPlane(plano, pt)) { off.copy(obj.position).sub(obj.parent.worldToLocal(pt.clone())); }
      obj.userData.arrastrando = true; audio.agarrar(); return true;
    },
    mover(ev) {
      rayoDesde(ev);
      if (ray.ray.intersectPlane(plano, pt)) { const l = obj.parent.worldToLocal(pt.clone()).add(off); obj.position.copy(l); }
    },
    soltar() { obj.userData.arrastrando = false; alSoltar && alSoltar(); },
  };
}

/* ───────────── Acto 1a: encontrar la piedra azul ───────────── */
async function actoPiedra() {
  estado.fase = 'piedra';
  const E = M.crearExterior(`${cfg.institucion} · LABORATORIO`); escena = E.escena; tarea(E.actualizar);
  mirada.centrar();
  hud(1, 'La piedra azul', '');
  const colores = [0x7d7f8c, 0xb5523b, 0xe0a030, 0x4caf6a, 0x8c5bd6, 0xd8d8e0, 0x5a6070, 0xc46a9a];
  const piedras = []; const N = 15; const iAzul = 9;
  for (let i = 0; i < N; i++) {
    const azul = i === iAzul;
    const yaw = azul ? Math.PI * 0.72 : (i / N) * Math.PI * 2 + rnd(-0.15, 0.15);
    const r = rnd(3.2, 5), y = rnd(-0.6, 1.1);
    const p = M.crearPiedra(colores[i % colores.length], { cristal: azul, tam: azul ? 0.34 : rnd(0.22, 0.42) });
    p.position.set(-Math.sin(yaw) * r, y, -Math.cos(yaw) * r);
    p.userData.base = p.position.clone(); p.userData.fase = rnd(0, 6); p.userData.azul = azul;
    escena.add(p); piedras.push(p);
    nombrados[azul ? 'piedra-azul' : `piedra-${i}`] = p;
  }
  const azul = piedras[iAzul];
  tarea((dt, t) => piedras.forEach((p) => {
    const u = p.userData; if (u.tomada) return;
    p.position.y = u.base.y + Math.sin(t * 0.9 + u.fase) * 0.15; p.rotation.y += dt * 0.3; p.rotation.x += dt * 0.1;
    if (u.sacudir > 0) { u.sacudir -= dt; p.position.x = u.base.x + Math.sin(t * 50) * 0.06; }
    if (u.halo) u.halo.material.opacity = 0.4 + 0.25 * Math.sin(t * 3);
  }));
  await tarjeta('Acto 1 · La expedición', 'Encuentra la piedra azul',
    `Las muestras de la expedición quedaron flotando frente al laboratorio de <b>${esc(cfg.institucion)}</b>. Solo una guarda el <b class="azul">cristal azul</b>.<br><br>Gira a tu alrededor, encuéntrala y tócala.`, 'Buscar');
  interactivos = piedras;
  setTimeout(() => { if (estado.fase === 'piedra' && !azul.userData.tomada) objetivosFlecha = [azul]; }, 5000);
  toast('Busca la piedra que brilla en azul', 3500);
  await new Promise((res) => piedras.forEach((p) => {
    p.userData.alTocar = () => {
      if (!p.userData.azul) { audio.error(); vibrar(60); p.userData.sacudir = 0.35; toast('Esa no es. Busca la que brilla en azul', 1500); return; }
      res();
    };
  }));
  objetivosFlecha = []; interactivos = []; azul.userData.tomada = true;
  audio.captura(); vibrar(40); efimero(M.estallido(escena, azul.position.clone(), 0x7fb4ff));
  const p0 = azul.position.clone(), destino = camara.localToWorld(new THREE.Vector3(0, -0.15, -1.3));
  await animar(0.9, (k) => { azul.position.lerpVectors(p0, destino, k); }, ease.out);
  toast('¡La tienes! Ahora llévala al laboratorio', 1800);
  await esperar(900);
  limpiarTareas();
}

/* ───────────── Acto 1 (AR): las piedras aparecen en tu piso ───────────── */
async function soportaAR() {
  try { return !!(navigator.xr && window.isSecureContext && await navigator.xr.isSessionSupported('immersive-ar')); } catch (e) { return false; }
}
async function actoAR() {
  const capa = $('#ar-capa'), txt = $('#ar-texto');
  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: capa } });
  } catch (e) { console.warn(e); toast('Tu celular no permitió abrir la realidad aumentada. Seguimos en 360°.', 3000); return 'salir'; }
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  mostrar(capa); mostrar($('#hud'), false);
  const E = new THREE.Scene(); E.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(1, 3, 2); E.add(dl);
  escena = E;
  const reticula = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fb4ff }));
  reticula.matrixAutoUpdate = false; reticula.visible = false; E.add(reticula);
  const espacioVista = await session.requestReferenceSpace('viewer');
  const fuente = await session.requestHitTestSource({ space: espacioVista });
  let colocado = false; const piedras = []; const grupo = new THREE.Group(); E.add(grupo);
  txt.textContent = 'Apunta el celular al piso y muévelo despacio';
  xrFrame = (frame) => {
    if (colocado) return;
    const hits = frame.getHitTestResults(fuente);
    if (hits.length) {
      const pose = hits[0].getPose(renderer.xr.getReferenceSpace());
      reticula.visible = true; reticula.matrix.fromArray(pose.transform.matrix);
      txt.textContent = 'Toca la pantalla para hacer aparecer las piedras';
    } else reticula.visible = false;
  };
  tarea((dt, t) => piedras.forEach((p) => { const u = p.userData; p.position.y = u.baseY + Math.sin(t + u.fase) * 0.05; p.rotation.y += dt * 0.4; }));
  const ctrl = renderer.xr.getController(0); E.add(ctrl);
  const rc = new THREE.Raycaster(), m4 = new THREE.Matrix4();
  return new Promise((res) => {
    let hecho = false;
    const terminar = (r) => { if (hecho) return; hecho = true; xrFrame = null; mostrar(capa, false); limpiarTareas(); try { fuente.cancel(); } catch (e) {} res(r); };
    ctrl.addEventListener('select', () => {
      if (!colocado) {
        if (!reticula.visible) return;
        colocado = true; reticula.visible = false;
        grupo.position.setFromMatrixPosition(reticula.matrix);
        const colores = [0x7d7f8c, 0xb5523b, 0xe0a030, 0x4caf6a, 0x8c5bd6, 0xd8d8e0];
        for (let i = 0; i < 7; i++) {
          const azul = i === 4, a = (i / 7) * Math.PI * 2;
          const p = M.crearPiedra(colores[i % colores.length], { cristal: azul, tam: 0.09 });
          p.userData.baseY = rnd(0.15, 0.4); p.userData.fase = rnd(0, 6); p.userData.azul = azul;
          p.position.set(Math.cos(a) * 0.45, p.userData.baseY, Math.sin(a) * 0.45); grupo.add(p); piedras.push(p);
        }
        audio.pop(); txt.textContent = 'Toca la piedra azul';
        return;
      }
      m4.identity().extractRotation(ctrl.matrixWorld);
      rc.ray.origin.setFromMatrixPosition(ctrl.matrixWorld); rc.ray.direction.set(0, 0, -1).applyMatrix4(m4);
      const h = rc.intersectObjects(piedras, true)[0]; if (!h) return;
      let o = h.object; while (o && !piedras.includes(o)) o = o.parent;
      if (o && o.userData.azul) { audio.captura(); txt.textContent = '¡La tienes!'; setTimeout(() => { session.end(); terminar('ok'); }, 600); }
      else { audio.error(); txt.textContent = 'Esa no es. Toca la piedra azul'; }
    });
    $('#ar-salir').onclick = () => { session.end(); terminar('salir'); };
    session.addEventListener('end', () => terminar('salir'));
  });
}

/* ───────────── Acto 1b: conducir la piedra hasta el laboratorio ───────────── */
async function actoCamino() {
  estado.fase = 'camino';
  const L = cfg.largoCamino;
  await mostrarTransicion('Lleva la piedra hasta el laboratorio');
  const C = M.crearCamino(L, `${cfg.institucion} · LABORATORIO`);
  escena = C.escena; mirada.bloqueo = true; rig.position.set(0, 0, 0);
  const piedra = M.crearPiedra(M.AZUL_CRISTAL, { cristal: true, tam: 0.2 }); escena.add(piedra);
  const obst = [];
  for (let d = 9; d < L - 5; d += 5.5) {
    const n = d > L / 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const r = rnd(0.28, 0.45), m = M.crearPiedra(0x6f6a86, { tam: r });
      const o = { m, z: -d - rnd(-1, 1), x: rnd(-1.3, 1.3), y: rnd(-0.6, 0.6), r: r * 0.95, amp: d > L / 3 ? rnd(0, 0.9) : 0, vel: rnd(0.8, 1.6), fase: rnd(0, 6), roto: false };
      m.position.set(o.x, o.y, o.z); escena.add(m); obst.push(o);
    }
  }
  const controles = [0, L / 3, (2 * L) / 3];
  hud(1, 'Rumbo al laboratorio', '');
  await ocultarTransicion();
  const gyro = !!mirada.inclinacion();
  await tarjeta('Acto 1 · El traslado', 'Lleva la piedra al laboratorio',
    gyro ? 'Sostén el celular frente a ti e <b>inclínalo</b> a los lados y hacia adelante o atrás para guiar la piedra.<br><br>Esquiva las rocas: si chocas, vuelves al último punto de control.'
         : 'Mueve el <b>dedo o el mouse</b> por la pantalla (o usa las flechas del teclado) para guiar la piedra.<br><br>Esquiva las rocas: si chocas, vuelves al último punto de control.', 'Arrancar');
  mirada.calibrar();
  conduccion = { x: 0, y: 0 };
  audio.zumbido(true);
  let dist = 0, control = 0, retroceso = false; const pos = { x: 0, y: 0 }; const t0 = performance.now();
  const VEL = 4.6 * (params.has('rapido') ? 4 : 1); // ?rapido=1 solo para pruebas
  await new Promise((resolver) => {
    tarea((dt, t) => {
      if (!conduccion) return;
      const inc = mirada.inclinacion();
      const obj = inc || conduccion;
      pos.x += (obj.x * 1.5 - pos.x) * Math.min(1, dt * 6);
      pos.y += (obj.y * 0.75 - pos.y) * Math.min(1, dt * 6);
      if (!retroceso) dist = Math.min(L, dist + VEL * dt);
      rig.position.set(pos.x * 0.35, pos.y * 0.25, -dist);
      camara.rotation.z = -pos.x * 0.12;
      const pz = -dist - 2.2;
      piedra.position.set(pos.x, pos.y - 0.15, pz); piedra.rotation.x -= dt * 4; piedra.rotation.y += dt * 1.5;
      audio.velocidad(retroceso ? 0.2 : 1);
      obst.forEach((o) => { if (!o.roto) { o.m.position.x = o.x + Math.sin(t * o.vel + o.fase) * o.amp; o.m.rotation.x += dt * 0.6; } });
      C.arcos.forEach((a, i) => { a.rotation.z += dt * 0.6; a.material.opacity = control > i ? 0.25 : 0.8; });
      if (control < 2 && dist >= controles[control + 1]) { control++; audio.encaje(); toast(`Punto de control ${control} de 2`, 1300); }
      if (!retroceso) {
        for (const o of obst) {
          if (o.roto) continue;
          const dz = Math.abs(pz - o.m.position.z);
          if (dz < 0.35 && Math.hypot(pos.x - o.m.position.x, pos.y - 0.15 - o.m.position.y) < o.r + 0.17) {
            o.roto = true; o.m.visible = false; estado.choques++;
            efimero(M.estallido(escena, o.m.position.clone(), 0xb7a6ff));
            audio.choque(); vibrar([80, 40, 80]); destello();
            toast('¡Choque! Vuelves al punto de control', 1500);
            retroceso = true; const d0 = dist, d1 = controles[control];
            animar(0.8, (k) => { dist = d0 + (d1 - d0) * k; }).then(() => { retroceso = false; });
            break;
          }
        }
      }
      const pct = Math.round((dist / L) * 100);
      hud(0, null, `<span>${pct}%</span><span class="naranja">✕ ${estado.choques}</span>`);
      if (dist >= L) resolver();
    });
  });
  estado.tiempoCamino = Math.round((performance.now() - t0) / 1000);
  conduccion = null; audio.zumbido(false); audio.exito();
  const puerta = C.edificio.userData.pivote;
  await animar(1.0, (k) => { puerta.rotation.y = -1.6 * k; rig.position.z = -L - k * 1.8; });
  await mostrarTransicion(`Laboratorio ${cfg.institucion}`);
  limpiarTareas();
  mirada.bloqueo = false; camara.rotation.z = 0; rig.position.set(0, 0, 0); mirada.centrar();
}

/* ───────────── Laboratorio ───────────── */
let lab = null, cristal = null, pinzas = null, tienda = null;
const MESA = -0.55;
function prepararLab() {
  if (lab) return;
  lab = M.crearLaboratorio({ institucion: cfg.institucion, imgInst, imgPatro, patrocinador: cfg.patrocinador });
  tarea(lab.actualizar, false);
  escena = lab.escena;
  cristal = M.crearPiedra(M.AZUL_CRISTAL, { cristal: true, tam: 0.16 });
  cristal.position.set(0, MESA + 0.13, -1.95); lab.grupo.add(cristal);
  nombrados.cristal = cristal; nombrados.compu = lab.compu; nombrados.geiger = lab.geiger; nombrados.recipiente = lab.recip;
  nombrados.zona = lab.zonaCaja; nombrados.boton = lab.botonFrio;
  lab.recip.userData.tapa.rotation.z = 1.3;
  tarea((dt, t) => {
    if (!cristal.parent || cristal.userData.fijo) return;
    const h = cristal.userData.halo; if (h) h.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * (estado.fase === 'estabilidad' ? 7 : 3)));
    cristal.rotation.y += dt * 0.4;
  }, false);
  tienda = new Tienda({ raiz: $('#tienda'), patrocinador: cfg.patrocinador, logo: imgPatro ? cfg.logoPatrocinador : '', institucion: cfg.institucion, segundos: cfg.segundosEnvio });
}

// Compra en la tienda del computador. Devuelve el producto comprado.
async function comprarEnTienda(id, texto) {
  const compu = lab.compu;
  compu.userData.dibujar('inicio', { texto: 'Abrir tienda' });
  const halo = compu.userData.halo;
  const parpadeo = tarea((dt, t) => { halo.material.opacity = 0.35 + 0.35 * Math.sin(t * 5); });
  interactivos = [compu]; objetivosFlecha = [compu];
  toast(texto);
  let producto = null;
  while (!producto) {
    await esperarToque(compu);
    toast(null); objetivosFlecha = [];
    producto = await tienda.comprar(id, { tic: () => audio.tic(), error: () => audio.error(), compra: () => audio.compra() });
    if (!producto) { toast(texto); objetivosFlecha = [compu]; interactivos = [compu]; }
  }
  tareas.delete(parpadeo); halo.material.opacity = 0; interactivos = [];
  return producto;
}

// Envío con cuenta regresiva; al terminar suena el timbre y aparece la caja en la puerta
function enviar(producto) {
  return new Promise((res) => {
    const dur = cfg.segundosEnvio; let e = 0;
    $('#pedido-nombre').textContent = producto.nombre.split(' ').slice(0, 3).join(' ');
    mostrar($('#pedido'));
    const f = (dt) => {
      e += dt; const k = Math.min(1, e / dur);
      $('#pedido-tiempo').textContent = `Llega en ${Math.max(0, Math.ceil(dur - e))} s`;
      $('#pedido-barra').style.width = `${k * 100}%`;
      lab.compu.userData.dibujar('envio', { producto: producto.nombre.split(' ').slice(0, 3).join(' '), k, seg: dur - e });
      if (k >= 1) { tareas.delete(f); llegar(producto).then(res); }
    };
    tareas.add(f);
  });
}
async function llegar(producto) {
  $('#pedido-tiempo').textContent = '¡Llegó!';
  audio.timbre(); vibrar([100, 80, 100]);
  const p = lab.puerta;
  p.timbreLuz.material.color.set(0xffd23f);
  await animar(0.7, (k) => { p.bisagra.rotation.y = 1.3 * k; });
  const caja = M.crearCaja({ imgPatro, patrocinador: cfg.patrocinador });
  caja.position.set(5.4, lab.Y0, -0.8); caja.rotation.y = -Math.PI / 2; lab.grupo.add(caja);
  await animar(0.9, (k) => { caja.position.x = 5.4 - 1.3 * k; }, ease.out);
  estado.entregas++; nombrados.caja = caja;
  setTimeout(() => { mostrar($('#pedido'), false); p.timbreLuz.material.color.set(0x553300); animar(0.8, (k) => { p.bisagra.rotation.y = 1.3 * (1 - k); }); }, 1200);
  lab.compu.userData.dibujar('inicio', { texto: 'Pedido entregado ✓' });
  toast(`¡Ding dong! Llegó tu pedido de ${esc(cfg.patrocinador)}`, 2000);
  return caja;
}
async function abrirCaja(caja, objeto) {
  audio.abrir();
  await animar(0.5, (k) => { caja.userData.tapa.rotation.x = -2.0 * k; });
  const wp = caja.getWorldPosition(new THREE.Vector3());
  efimero(M.estallido(lab.grupo, wp.clone().add(new THREE.Vector3(0, 0.35, 0)), 0xffe600, { n: 22 }));
  lab.grupo.add(objeto); objeto.position.copy(wp).add(new THREE.Vector3(0, 0.2, 0));
  const y0 = objeto.position.y;
  await animar(0.6, (k) => { objeto.position.y = y0 + 0.35 * k; objeto.rotation.y = k * Math.PI; }, ease.out);
  animar(0.5, (k) => { caja.scale.setScalar(1 - k); }).then(() => caja.removeFromParent());
}

/* ───────────── Acto 2: el primer pedido (pinzas) ───────────── */
async function actoEntrega() {
  estado.fase = 'entrega';
  hud(2, 'Laboratorio', '');
  lab.setPantalla({ titulo: 'CRISTAL INESTABLE', sub: 'Muestra de expedición · requiere manipulación', color: '#ffb02e', valor: 0.18, ruido: 0.8 });
  await ocultarTransicion();
  // la piedra queda sobre el mesón
  efimero(M.estallido(lab.grupo, cristal.position.clone(), 0x7fb4ff));
  audio.pop();
  await tarjeta('Acto 2 · Las herramientas', `Laboratorio ${cfg.institucion}`,
    `Dejaste el cristal sobre el mesón. Para manipularlo necesitas <b>pinzas de precisión</b>… y no hay ninguna en el laboratorio.<br><br>Ve al <b>computador</b> y pídelas en <b>${esc(cfg.patrocinador)}</b>. Llegan a la puerta en ${cfg.segundosEnvio} segundos.`, 'Ir al computador');
  const prod = await comprarEnTienda('pinzas', 'Toca el computador para abrir la tienda');
  toast('Mientras llega, mira el laboratorio. La puerta de entregas está a tu derecha', 3000);
  const caja = await enviar(prod);
  // llevar la caja al mesón
  interactivos = [caja]; objetivosFlecha = [caja];
  toast('Toma la caja y llévala hasta el mesón');
  const zona = lab.zonaCaja; const destinoZona = zona.getWorldPosition(new THREE.Vector3());
  const pulso = tarea((dt, t) => { zona.material.opacity = 0.4 + 0.4 * Math.sin(t * 5); });
  const posPuerta = caja.position.clone();
  await new Promise((res) => {
    arrastreLlevar(caja, {
      distancia: 2.1,
      alMover: () => { objetivosFlecha = [zona]; },
      alSoltar: (wp) => {
        if (Math.hypot(wp.x - destinoZona.x, wp.z - destinoZona.z) < 0.75) {
          delete caja.userData.arrastre; audio.encaje();
          const p0 = caja.position.clone();
          animar(0.35, (k) => { caja.position.lerpVectors(p0, new THREE.Vector3(destinoZona.x, MESA, destinoZona.z), k); caja.rotation.y = -Math.PI / 2 * (1 - k); }).then(res);
        } else {
          toast('Llévala hasta el círculo amarillo del mesón', 1800); objetivosFlecha = [caja];
          const p0 = caja.position.clone(); animar(0.5, (k) => caja.position.lerpVectors(p0, posPuerta, k));
        }
      },
    });
  });
  tareas.delete(pulso); zona.material.opacity = 0; objetivosFlecha = [];
  toast('Toca la caja para abrirla');
  await esperarToque(caja);
  pinzas = M.crearPinzas(); pinzas.rotation.z = Math.PI / 2;
  await abrirCaja(caja, pinzas);
  nombrados.pinzas = pinzas;
  interactivos = [pinzas]; toast('Toca las pinzas para tomarlas');
  await esperarToque(pinzas);
  inventario.poner('pinzas'); audio.encaje();
  sostener(pinzas);
  toast(null);
}
// la herramienta queda "en la mano" (abajo a la derecha de la vista)
let sosteniendo = null;
function sostener(obj) {
  sosteniendo = obj;
  if (obj.userData.tareaMano) tareas.delete(obj.userData.tareaMano);
  obj.userData.tareaMano = tarea((dt, t) => {
    if (sosteniendo !== obj) return;
    const p = camara.localToWorld(new THREE.Vector3(0.2, -0.24, -0.72 + Math.sin(t * 2) * 0.01));
    obj.parent.worldToLocal(p); obj.position.lerp(p, Math.min(1, dt * 10));
    obj.quaternion.copy(camara.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, 0, 0.35)));
  }, false);
}
function soltarMano() { if (sosteniendo && sosteniendo.userData.tareaMano) tareas.delete(sosteniendo.userData.tareaMano); sosteniendo = null; }

/* ───────────── Acto 3: manipular el cristal ───────────── */
async function actoCristal() {
  estado.fase = 'cristal';
  hud(3, 'La muestra', '');
  if (!pinzas) { pinzas = M.crearPinzas(); lab.grupo.add(pinzas); sostener(pinzas); inventario.poner('pinzas'); }
  interactivos = [cristal]; objetivosFlecha = [cristal];
  toast('Toca el cristal para sujetarlo con las pinzas');
  await esperarToque(cristal);
  objetivosFlecha = [];
  soltarMano();
  // las pinzas se posan sobre el cristal y lo siguen
  const sobreCristal = tarea(() => {
    pinzas.position.set(cristal.position.x, cristal.position.y + 0.45, cristal.position.z);
    pinzas.rotation.set(0, 0, 0);
  });
  audio.encaje();
  medidor.mostrar('Estabilidad del cristal'); medidor.valor(0.18);
  let lectura = 0, leido = false, geigerAcum = 0;
  const gpos = lab.geiger.getWorldPosition(new THREE.Vector3()), rpos = lab.recip.getWorldPosition(new THREE.Vector3());
  toast('Desliza el cristal por el mesón hasta el contador Geiger (amarillo)');
  objetivosFlecha = [lab.geiger];
  const sonido = tarea((dt) => {
    const d = Math.hypot(cristal.position.x - gpos.x, cristal.position.z - gpos.z);
    const intensidad = THREE.MathUtils.clamp(1 - d / 1.2, 0.03, 1);
    geigerAcum += dt * (2 + intensidad * 28);
    if (geigerAcum > 1) { geigerAcum = 0; audio.geiger(); lab.geiger.userData.luz.material.color.set(Math.random() < 0.5 ? 0x5fff7a : 0x334433); }
    lab.geiger.userData.dibujarDial(intensidad);
    if (!leido && d < 0.2) {
      lectura += dt / 1.6;
      toast(`Midiendo radiación… ${Math.round(Math.min(1, lectura) * 100)} %`);
      if (lectura >= 1) {
        leido = true; audio.exito(); medidor.valor(0.35); lab.setPantalla({ titulo: 'RADIACIÓN ALTA', sub: 'Lectura completa · trasladar a contención', valor: 0.35, color: '#ffb02e' });
        toast('¡Lectura completa! Ahora llévalo al recipiente de contención'); objetivosFlecha = [lab.recip];
      }
    }
  });
  interactivos = [cristal];
  await new Promise((res) => {
    arrastreMesa(cristal, {
      altura: MESA + 0.13, limites: [-1.1, 1.1, -1.95, -1.95], // se desliza a lo largo del mesón
      alSoltar: (wp) => {
        if (!leido) { if (Math.hypot(wp.x - gpos.x, wp.z - gpos.z) > 0.2) toast('Déjalo cerca del contador Geiger hasta que termine la lectura'); return; }
        if (Math.hypot(wp.x - rpos.x, wp.z - rpos.z) < 0.22) { delete cristal.userData.arrastre; res(); }
        else toast('Llévalo al recipiente de contención (a la derecha)', 1800);
      },
    });
    // permitir que la lectura avance aunque el dedo siga quieto sobre el contador
  });
  objetivosFlecha = []; tareas.delete(sonido); tareas.delete(sobreCristal);
  // dentro del recipiente
  const p0 = cristal.position.clone(), p1 = new THREE.Vector3(rpos.x, MESA + 0.2, rpos.z);
  await animar(0.5, (k) => { cristal.position.lerpVectors(p0, p1, k); pinzas.position.set(cristal.position.x, cristal.position.y + 0.45, cristal.position.z); });
  pinzas.visible = false; inventario.quitar('pinzas');
  audio.encaje();
  await animar(0.5, (k) => { lab.recip.userData.tapa.rotation.z = 1.3 * (1 - k); });
  audio.carga();
  await animar(1.2, (k) => { medidor.valor(0.35 + 0.25 * k); lab.recip.userData.brillo.material.opacity = 0.6 * k; });
  lab.setPantalla({ titulo: 'EN CONTENCIÓN', sub: 'Estabilidad parcial', valor: 0.6, color: '#39d0ff', ruido: 0.4 });
  toast('Cristal en contención. Estabilidad al 60 %', 2000);
  await esperar(1500);
}

/* ───────────── Acto 4: segundo pedido contra el reloj ───────────── */
async function actoEstabilidad() {
  estado.fase = 'estabilidad';
  hud(3, 'Reto · Estabilidad', '');
  audio.alarma(2); lab.setAlarma(true); destello();
  lab.setPantalla({ titulo: '¡ALERTA! PIERDE ESTABILIDAD', sub: 'Se requiere sellado con guantes antirradiación', color: '#ff4757', ruido: 1.2 });
  await tarjeta('Reto · Contra el reloj', 'El cristal se desestabiliza',
    `La estabilidad está bajando. Para sellarlo necesitas <b>guantes antirradiación</b>: pídelos en la tienda.<br><br>Mientras llegan, <b>mantén presionado el botón azul de enfriamiento</b> del mesón para ganar tiempo.`, '¡Vamos!');
  lab.setAlarma(false);
  let est = 0.6, terminado = false, exito = false, enfriando = false;
  const caida = 0.6 / cfg.segundosEstabilidad;
  const frio = M.crearParticulas(40, 0.25, { tam: 0.05, opacidad: 0, vel: 0.4, color: 0xdff6ff, alto: 0.6 });
  frio.position.copy(lab.recip.position).add(new THREE.Vector3(0, 0.3, 0)); lab.grupo.add(frio);
  let resolverFin; const fin = new Promise((r) => (resolverFin = r));
  const acabar = (ok) => { if (terminado) return; terminado = true; exito = ok; resolverFin(); };
  tarea((dt, t) => {
    if (terminado) return;
    est += enfriando ? dt * 0.012 : -dt * caida;
    est = Math.min(0.95, est);
    medidor.valor(est); lab.setPantalla({ valor: Math.max(0, est) });
    frio.userData.actualizar(dt, t); frio.material.opacity += ((enfriando ? 0.7 : 0) - frio.material.opacity) * Math.min(1, dt * 5);
    lab.botonFrio.userData.halo.scale.setScalar(1 + 0.15 * Math.sin(t * 6));
    hud(0, null, `<span class="${est < 0.25 ? 'alerta' : ''}">${Math.max(0, Math.round(est * 100))} %</span>`);
    if (est < 0.25 && Math.random() < dt * 2) { destello(); audio.geiger(); }
    if (est <= 0) acabar(false);
  });
  // botón de enfriamiento (mantener)
  lab.botonFrio.visible = true;
  lab.botonFrio.userData.mantener = {
    dur: 1.6,
    alIniciar: () => { enfriando = true; audio.frio(); lab.botonFrio.userData.tapa.position.y = 0.05; },
    alProgreso: () => {},
    alCompletar: () => { enfriando = false; est = Math.min(0.95, est + 0.1); audio.encaje(); lab.botonFrio.userData.tapa.position.y = 0.07; toast('+10 % de estabilidad. Puedes repetirlo', 1300); },
    alSoltar: () => { enfriando = false; lab.botonFrio.userData.tapa.position.y = 0.07; },
  };
  const flujoPedido = (async () => {
    const prod = await comprarEnTiendaInterrumpible('guantes', 'Toca el computador y pide los guantes', () => terminado);
    if (!prod || terminado) return;
    interactivos = [lab.botonFrio];
    toast('Mientras llegan: mantén presionado el botón azul de enfriamiento');
    objetivosFlecha = [lab.botonFrio];
    const caja = await enviar(prod);
    if (terminado) return;
    interactivos = [caja, lab.botonFrio]; objetivosFlecha = [caja];
    toast('¡Llegaron los guantes! Toca la caja para abrirla');
    await esperarToque(caja); if (terminado) return;
    objetivosFlecha = [];
    const guantes = M.crearGuantes();
    await abrirCaja(caja, guantes); nombrados.guantes = guantes;
    interactivos = [guantes, lab.botonFrio]; toast('Toca los guantes para ponértelos');
    await esperarToque(guantes); if (terminado) return;
    guantes.removeFromParent(); inventario.poner('guantes'); audio.encaje();
    interactivos = [lab.recip, lab.botonFrio]; objetivosFlecha = [lab.recip];
    toast('Ahora mantén presionado el recipiente para sellar el cristal');
    await new Promise((r) => {
      lab.recip.userData.mantener = {
        dur: 2.2,
        alIniciar: () => audio.carga(),
        alProgreso: (k) => { lab.recip.userData.brillo.material.opacity = 0.6 + 0.4 * k; },
        alCompletar: () => { delete lab.recip.userData.mantener; r(); },
        alSoltar: () => toast('Mantenlo presionado hasta que se llene el anillo', 1500),
      };
    });
    if (terminado) return;
    est = 1; medidor.valor(1); acabar(true);
  })();
  await fin;
  limpiarTareas();
  delete lab.botonFrio.userData.mantener; delete lab.recip.userData.mantener;
  lab.botonFrio.visible = false; frio.removeFromParent(); cancelarMantener();
  mostrar($('#tienda'), false); mostrar($('#pedido'), false); interactivos = []; objetivosFlecha = [];
  estado.estabilidad = exito ? 'sellado a tiempo' : 'colapsó';
  void flujoPedido;
  if (exito) {
    audio.exito(); lab.setPantalla({ titulo: 'CRISTAL SELLADO', sub: 'Estabilidad 100 %', valor: 1, color: '#3dff8f', ruido: 0.1 });
    toast('¡Sellado! Estabilidad al 100 %', 2000); await esperar(2200);
  } else {
    lab.setPantalla({ titulo: 'ESTABILIDAD 0 %', sub: 'Falla de contención', valor: 0, color: '#ff4757', ruido: 2 });
    toast('El cristal colapsó…', 1800); await esperar(1500);
  }
  inventario.quitar('guantes');
  medidor.ocultar(); hud(3, 'La muestra', '');
}
async function comprarEnTiendaInterrumpible(id, texto, cancelado) {
  const compra = comprarEnTienda(id, texto);
  while (true) {
    const r = await Promise.race([compra, esperar(250).then(() => null)]);
    if (r) return r;
    if (cancelado()) { mostrar($('#tienda'), false); return null; }
  }
}

/* ───────────── Acto 5 y 6: el giro y la captura ───────────── */
const capturadas = [];
async function actoCriaturas() {
  estado.fase = 'criaturas';
  hud(4, 'Anomalía', '');
  // el cristal se rompe
  lab.recip.userData.tapa.rotation.z = 0;
  audio.grieta(); vibrar([200, 60, 200]);
  await animar(1.4, (k) => { cristal.position.x = lab.recip.position.x + Math.sin(k * 80) * 0.02 * k; cristal.scale.setScalar(1 + k * 0.3); lab.recip.userData.brillo.material.opacity = 0.6 + k; });
  destello(); lab.setAlarma(true); audio.alarma(3);
  lab.setPantalla({ titulo: 'ANOMALÍA DETECTADA', sub: 'Formas de vida no identificadas', color: '#3dff8f', ruido: 2, valor: null });
  const origen = cristal.getWorldPosition(new THREE.Vector3());
  efimero(M.estallido(lab.grupo, origen, 0x7fb4ff, { n: 40, vel: 3.5, dur: 1 }));
  cristal.visible = false; lab.recip.userData.tapa.rotation.z = 1.6;
  // criaturas
  const colores = [0x4aa8ff, 0xff5fd2, 0xffa53d, 0xffe14d];
  const total = cfg.criaturasObjetivo + cfg.criaturasDistractoras; const cs = []; const usados = [];
  for (let i = 0; i < total; i++) {
    const obj = i < cfg.criaturasObjetivo;
    let p;
    for (let k = 0; k < 80; k++) {
      const yaw = (obj && i < 3) || (!obj && i < cfg.criaturasObjetivo + 3) ? rnd(-0.6, 0.6) : rnd(0, Math.PI * 2);
      const el = rnd(-0.15, 0.55), r = rnd(2.2, 3.6);
      p = new THREE.Vector3(-Math.sin(yaw) * Math.cos(el) * r, Math.sin(el) * r, -Math.cos(yaw) * Math.cos(el) * r);
      const dp = p.clone().normalize();
      if (usados.every((q) => dp.dot(q.clone().normalize()) < Math.cos(0.27))) break;
    }
    usados.push(p);
    const c = M.crearCriatura(obj ? VERDE : colores[i % colores.length]);
    c.userData.obj = obj; c.userData.base = p.clone(); c.userData.fase = rnd(0, 6); c.userData.giro = rnd(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1);
    c.position.copy(origen); c.scale.setScalar(0.01); lab.grupo.add(c); cs.push(c);
    nombrados[obj ? `verde-${i}` : `otra-${i - cfg.criaturasObjetivo}`] = c;
  }
  await Promise.all(cs.map((c, i) => esperar(i * 40).then(() => { audio.alien(); return animar(0.9, (k) => { c.position.lerpVectors(origen, c.userData.base, k); c.scale.setScalar(Math.max(0.01, k)); }, ease.out); })));
  const camW = new THREE.Vector3();
  let velocidad = 1;
  tarea((dt, t) => {
    camara.getWorldPosition(camW);
    for (const c of cs) {
      const u = c.userData; if (u.muerta || u.huyendo) continue;
      u.base.applyAxisAngle(new THREE.Vector3(0, 1, 0), u.giro * dt * velocidad);
      c.position.set(u.base.x + Math.sin(t * 2.1 + u.fase) * 0.15, u.base.y + Math.sin(t * 1.4 + u.fase) * 0.2, u.base.z);
      c.lookAt(camW);
      u.aletas.rotation.y += dt * 3; u.cuerpo.scale.y = 0.85 + Math.sin(t * 6 + u.fase) * 0.06;
      if (u.sacudir > 0) { u.sacudir -= dt; c.position.x += Math.sin(t * 60) * 0.05; if (u.sacudir <= 0) u.mat.emissiveIntensity = 0.45; }
    }
  });
  await tarjeta('Acto 3 · El giro', 'El cristal no era de este mundo',
    `Del cristal salieron criaturas que flotan por el laboratorio. Atrapa solo las <b class="verde">verdes</b> antes de que escapen; las de otros colores son inofensivas.<br><br>Tienes <b>${cfg.segundosCaptura} segundos</b>. Si atrapas varias seguidas, multiplicas los puntos.`, '¡A cazar!');
  lab.setAlarma(false);
  hud(4, 'Captura', '');
  let aciertos = 0, errores = 0, puntos = 0, combo = 1, ultimo = -10, tiempo = cfg.segundosCaptura, jugando = true, ultSeg = Math.ceil(tiempo);
  const info = () => hud(0, null, `<span class="verde">● ${aciertos}/${cfg.criaturasObjetivo}</span>${combo > 1 ? `<span class="naranja">x${combo}</span>` : ''}<span class="${tiempo <= 5 ? 'alerta' : ''}">${Math.max(0, Math.ceil(tiempo))} s</span>`);
  info();
  interactivos = cs; objetivosFlecha = cs.filter((c) => c.userData.obj);
  const centroRed = new THREE.Vector3(0, MESA + 1.45, -2.5); // las atrapadas flotan arriba del mesón
  await new Promise((resolver) => {
    const terminar = (completo) => { if (!jugando) return; jugando = false; resolver(completo); };
    cs.forEach((c) => {
      c.userData.alTocar = () => {
        if (!jugando || c.userData.muerta) return;
        const ahora = reloj.elapsedTime;
        if (c.userData.obj) {
          c.userData.muerta = true; aciertos++;
          combo = ahora - ultimo < 1.6 ? Math.min(4, combo + 1) : 1; ultimo = ahora;
          puntos += 100 * combo;
          audio.captura(); vibrar(25);
          efimero(M.estallido(lab.grupo, c.position.clone(), VERDE));
          if (combo > 1) toast(`¡Combo x${combo}!`, 700);
          // se convierte en una burbuja de energía que flota sobre el mesón
          const burbuja = M.brillo(VERDE, 0.28, 0.9); burbuja.position.copy(c.position); lab.grupo.add(burbuja);
          const idx = capturadas.length; capturadas.push(burbuja);
          const destino = centroRed.clone().add(new THREE.Vector3(Math.cos(idx * 0.63) * 0.7, Math.sin(idx * 0.9) * 0.1, Math.sin(idx * 0.63) * 0.15));
          burbuja.userData.base = destino;
          const b0 = burbuja.position.clone();
          animar(0.7, (k) => burbuja.position.lerpVectors(b0, destino, k), ease.out);
          animar(0.2, (k) => c.scale.setScalar(1 - k)).then(() => { c.visible = false; });
          info();
          if (aciertos >= cfg.criaturasObjetivo) terminar(true);
        } else {
          errores++; combo = 1; puntos = Math.max(0, puntos - 50);
          audio.error(); vibrar([60, 40, 60]); c.userData.sacudir = 0.35; c.userData.mat.emissiveIntensity = 1.4;
          toast('¡Esa no es verde!', 900); info();
        }
      };
    });
    tarea((dt, t) => {
      capturadas.forEach((b, i) => { if (b.userData.base && !b.userData.libre) b.position.y = b.userData.base.y + Math.sin(t * 2 + i) * 0.03; });
      if (!jugando) return;
      tiempo -= dt; velocidad = 1 + (1 - tiempo / cfg.segundosCaptura) * 1.2;
      const s = Math.ceil(tiempo);
      if (s !== ultSeg) { ultSeg = s; if (s <= 5 && s > 0) audio.tic(); info(); }
      if (Math.random() < dt * 0.8) audio.alien();
      if (tiempo <= 0) { tiempo = 0; info(); terminar(false); }
    });
  }).then(async (completo) => {
    objetivosFlecha = []; interactivos = [];
    estado.criaturas = { aciertos, errores, puntos, completo };
    if (completo) audio.exito();
    // las que no se atraparon escapan por el techo
    cs.filter((c) => !c.userData.muerta).forEach((c) => { c.userData.huyendo = true; const p0 = c.position.clone(); animar(1.2, (k) => { c.position.set(p0.x, p0.y + k * 3, p0.z); c.scale.setScalar(1 - k * 0.8); }).then(() => c.removeFromParent()); });
    await esperar(600);
    await tarjeta(completo ? '¡Captura completa!' : 'Se acabó el tiempo', completo ? 'Excelentes reflejos' : 'Atrapaste a varias',
      `Atrapaste <b>${aciertos} de ${cfg.criaturasObjetivo}</b> criaturas verdes y tocaste <b>${errores}</b> de otro color.<span class="grande">${puntos} pts</span>Ahora hay que encerrarlas en una cápsula de contención.`, 'Construir la cápsula');
  });
  limpiarTareas();
  // las burbujas siguen flotando
  tarea((dt, t) => capturadas.forEach((b, i) => { if (b.userData.base && !b.userData.libre) b.position.y = b.userData.base.y + Math.sin(t * 2 + i) * 0.03; }), false);
}

/* ───────────── Acto 7: construir la cápsula ───────────── */
async function actoCapsula() {
  estado.fase = 'capsula';
  hud(5, 'La cápsula', '');
  const t0 = performance.now();
  lab.recip.visible = false;
  const C = M.crearCapsula(); C.capsula.position.set(0, MESA, -1.95); lab.grupo.add(C.capsula);
  const D = 1.95;
  const mitadAlto = D * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)), mitadAncho = mitadAlto * camara.aspect;
  const sx = Math.min(mitadAncho * 0.72, 0.62);
  const inicios = [[-sx, 0.95], [sx, 0.85], [-sx, 0.25], [sx, 0.3]].sort(() => Math.random() - 0.5);
  C.piezas.forEach((p, i) => {
    p.grupo.position.set(inicios[i][0], inicios[i][1], 0.15);
    p.grupo.rotation.set(rnd(-0.8, 0.8), rnd(-1, 1), rnd(-0.8, 0.8));
    p.base = p.grupo.position.clone(); p.fase = rnd(0, 6);
    nombrados[`pieza-${i}`] = p.grupo; nombrados[`ranura-${i}`] = p.fantasma;
  });
  const id = new THREE.Quaternion();
  let colocadas = 0;
  tarea((dt, t) => {
    C.fantasmaMat.opacity = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(t * 3));
    for (const p of C.piezas) {
      if (p.colocada) continue;
      if (p.grupo.userData.arrastrando) p.grupo.quaternion.slerp(id, 1 - Math.pow(0.002, dt));
      else { p.grupo.position.y = p.base.y + Math.sin(t * 1.3 + p.fase) * 0.03; p.grupo.rotation.y += dt * 0.5; }
    }
  });
  await tarjeta('Acto 4 · La contención', 'Construye la cápsula',
    'Arrastra cada pieza hasta su silueta sobre el mesón: <b>base, vidrio, tapa y sensor</b>. Cuando esté en su lugar, encaja sola.', 'Armar');
  hud(0, null, '<span>◆ 0/4</span>');
  interactivos = C.piezas.map((p) => p.grupo);
  await new Promise((res) => {
    C.piezas.forEach((p) => {
      arrastreFrente(p.grupo, C.capsula, {
        alSoltar: () => {
          const d = new THREE.Vector2(p.grupo.position.x - p.destino.x, p.grupo.position.y - p.destino.y).length();
          if (d < 0.18) {
            p.colocada = true; delete p.grupo.userData.arrastre;
            const q0 = p.grupo.quaternion.clone(), p0 = p.grupo.position.clone();
            animar(0.3, (k) => { p.grupo.position.lerpVectors(p0, p.destino, k); p.grupo.quaternion.slerpQuaternions(q0, id, k); }, ease.out).then(() => { p.fantasma.visible = false; });
            audio.encaje(); vibrar(30); colocadas++;
            hud(0, null, `<span>◆ ${colocadas}/4</span>`);
            if (colocadas === 4) res();
          } else p.base.copy(p.grupo.position);
        },
      });
    });
  });
  interactivos = [];
  await esperar(500);
  // falta el núcleo
  C.fantasmaNucleo.visible = true; audio.error(); nombrados.ranuraNucleo = C.fantasmaNucleo;
  lab.setPantalla({ titulo: 'FALTA NÚCLEO DE ENERGÍA', sub: 'La cápsula no puede activarse', color: '#ffb02e', ruido: 0.8 });
  const parpadeo = tarea((dt, t) => { C.fantasmaNucleo.material.opacity = 0.2 + 0.3 * Math.abs(Math.sin(t * 4)); });
  await tarjeta('Pieza faltante', 'Falta el núcleo de energía',
    `La cápsula está armada, pero no tiene con qué activarse. Pide un <b>núcleo de energía</b> en <b>${esc(cfg.patrocinador)}</b>.`, 'Ir al computador');
  const prod = await comprarEnTienda('nucleo', 'Toca el computador y pide el núcleo de energía');
  const caja = await enviar(prod);
  interactivos = [caja]; objetivosFlecha = [caja]; toast('Toca la caja para abrirla');
  await esperarToque(caja); objetivosFlecha = [];
  const nucleo = M.crearNucleo(); await abrirCaja(caja, nucleo); nombrados.nucleo = nucleo;
  tarea((dt) => nucleo.userData.anillos.forEach((a, i) => { a.rotation.y += dt * (i ? 2 : -3); }));
  interactivos = [nucleo];
  toast('Lleva el núcleo hasta el centro de la cápsula');
  const slot = C.fantasmaNucleo.getWorldPosition(new THREE.Vector3());
  const posInicial = nucleo.position.clone();
  await new Promise((res) => {
    arrastreLlevar(nucleo, {
      distancia: 1.7,
      alMover: () => { objetivosFlecha = [C.capsula]; },
      alSoltar: (wp) => {
        if (wp.distanceTo(slot) < 0.4) { delete nucleo.userData.arrastre; res(); }
        else { toast('Suéltalo dentro de la cápsula, en el centro del vidrio', 1600); const p0 = nucleo.position.clone(); animar(0.4, (k) => nucleo.position.lerpVectors(p0, posInicial, k)); }
      },
    });
  });
  objetivosFlecha = []; interactivos = []; tareas.delete(parpadeo);
  const n0 = nucleo.position.clone(), slotLocal = lab.grupo.worldToLocal(slot.clone());
  await animar(0.4, (k) => nucleo.position.lerpVectors(n0, slotLocal, k), ease.out);
  C.fantasmaNucleo.visible = false; audio.encaje(); toast(null);
  // activación: las criaturas entran a la cápsula
  audio.carga(); lab.setPantalla({ titulo: 'CÁPSULA ACTIVADA', sub: 'Contención en curso', color: '#7ef9ff', ruido: 1 });
  await animar(0.8, (k) => { C.luzInterior.material.opacity = k; C.vidrioMat.opacity = 0.35 + k * 0.25; });
  for (const b of capturadas) {
    b.userData.libre = true; const b0 = b.position.clone();
    animar(0.6, (k) => { b.position.lerpVectors(b0, slot, k); b.scale.setScalar(0.28 * (1 - k * 0.6)); }, ease.in).then(() => { b.removeFromParent(); audio.captura(); });
    await esperar(160);
  }
  await esperar(700);
  efimero(M.estallido(lab.grupo, slot.clone(), 0x7ef9ff, { n: 50, vel: 3, dur: 1.2 }));
  efimero(M.estallido(lab.grupo, slot.clone(), M.NARANJA, { n: 30, vel: 2.5, dur: 1.2 }));
  audio.exito(); vibrar([60, 40, 160]);
  lab.setPantalla({ titulo: 'MISIÓN CUMPLIDA', sub: `Laboratorio ${cfg.institucion}`, color: '#3dff8f', valor: 1, ruido: 0.1 });
  estado.tiempoCapsula = Math.round((performance.now() - t0) / 1000);
  await esperar(1500);
}

/* ───────────── Final ───────────── */
function mostrarFinal() {
  const f = cfg.final;
  const li = $('#fin-logo-inst'), lp = $('#fin-logo-patro');
  if (imgInst) li.src = cfg.logoInstitucion; else mostrar(li, false);
  if (imgPatro) lp.src = cfg.logoPatrocinador; else lp.replaceWith(Object.assign(document.createElement('b'), { textContent: cfg.patrocinador, className: 'patro-txt' }));
  $('#fin-titulo').textContent = f.titulo;
  $('#fin-mensaje').innerHTML = esc(f.mensaje || '').replace(/\n/g, '<br>');
  $('#fin-contacto').textContent = f.contacto || '';
  if (f.qr && window.qrcode) {
    const q = window.qrcode(0, 'M'); q.addData(f.qr); q.make();
    $('#fin-qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); mostrar($('#fin-qr-cont'));
  }
  const r = [];
  r.push(`Traslado: ${estado.choques} ${estado.choques === 1 ? 'choque' : 'choques'}`);
  if (estado.estabilidad) r.push(`Cristal: ${estado.estabilidad}`);
  if (estado.criaturas) r.push(`Criaturas: ${estado.criaturas.aciertos}/${cfg.criaturasObjetivo} · ${estado.criaturas.puntos} pts`);
  r.push(`Entregas de ${cfg.patrocinador}: ${estado.entregas}`);
  $('#fin-resumen').innerHTML = r.map((x) => `<li>${esc(x)}</li>`).join('');
  hud(6, 'Misión cumplida', '');
  mostrar($('#final')); audio.exito();
}

/* ───────────── Arranque ───────────── */
function cargarImg(src) {
  return new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
async function prepararIntro() {
  document.title = `${cfg.titulo} · ${cfg.institucion}`;
  $('#intro-titulo').textContent = cfg.titulo;
  [imgInst, imgPatro] = await Promise.all([cargarImg(cfg.logoInstitucion), cargarImg(cfg.logoPatrocinador)]);
  const li = $('#intro-logo-inst'), lp = $('#intro-logo-patro');
  if (imgInst) li.src = cfg.logoInstitucion; else mostrar(li, false);
  if (imgPatro) lp.src = cfg.logoPatrocinador; else { lp.replaceWith(Object.assign(document.createElement('b'), { textContent: cfg.patrocinador, className: 'patro-txt' })); }
  if (!imgInst || !imgPatro) mostrar(document.querySelector('.logos-intro .mas'), !!(imgInst || imgPatro));
  $('#btn-sonido').onclick = () => { audio.silenciar(!audio.mudo); $('#btn-sonido').textContent = audio.mudo ? '🔇' : '🔊'; };
  $('#fin-repetir').onclick = () => location.reload();
  $('#fin-explorar').onclick = () => { mostrar($('#final'), false); toast('Mira el laboratorio. Recarga la página para repetir.', 3000); };
  const arranque = async (modoAR) => {
    const permiso = Mirada.pedirPermiso(); // debe llamarse dentro del toque (iPhone)
    audio.iniciar();
    mostrar($('#intro'), false);
    await permiso;
    iniciarMotor();
    flujo(modoAR).catch((e) => { console.error(e); toast('Ocurrió un error. Recarga la página.'); });
  };
  $('#btn-comenzar').onclick = () => arranque(false);
  $('#btn-ar').onclick = () => arranque(true);
  if (await soportaAR()) mostrar($('#btn-ar'));
}

async function flujo(modoAR) {
  const orden = ['piedra', 'camino', 'entrega', 'cristal', 'estabilidad', 'criaturas', 'capsula'];
  let desde = Math.max(0, orden.indexOf(params.get('etapa')));
  if (desde <= 0) {
    let r = 'salir';
    if (modoAR) r = await actoAR();
    if (r !== 'ok') await actoPiedra();
  }
  if (desde <= 1) await actoCamino(); else await mostrarTransicion(`Laboratorio ${cfg.institucion}`);
  mirada.centrar();
  prepararLab();
  if (desde <= 2) await actoEntrega(); else await ocultarTransicion();
  if (desde <= 3) await actoCristal();
  else { cristal.position.set(lab.recip.position.x, MESA + 0.2, lab.recip.position.z); lab.recip.userData.tapa.rotation.z = 0; lab.recip.userData.brillo.material.opacity = 0.6; }
  if (desde <= 4) await actoEstabilidad();
  if (desde <= 5) await actoCriaturas();
  await actoCapsula();
  mostrarFinal();
}

window.__demo = {
  pantalla(nombre) {
    const o = nombrados[nombre]; if (!o || !camara) return null;
    rig.updateMatrixWorld(true);
    const p = o.getWorldPosition(new THREE.Vector3()).project(camara);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, frente: p.z < 1 };
  },
  mirarA(nombre) {
    const o = nombrados[nombre]; if (!o) return;
    const p = o.getWorldPosition(new THREE.Vector3()).sub(camara.getWorldPosition(new THREE.Vector3()));
    mirada.yaw = Math.atan2(-p.x, -p.z); mirada.pitch = Math.atan2(p.y, Math.hypot(p.x, p.z));
  },
  mirar(yaw, pitch = 0) { mirada.yaw = yaw; mirada.pitch = pitch; },
  get nombres() { return Object.keys(nombrados); },
  estado,
};

prepararIntro();
