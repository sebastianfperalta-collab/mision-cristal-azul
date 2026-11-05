// Mirar alrededor (giroscopio + arrastre) e inclinación del celular para conducir
import * as THREE from 'three';

const ejeZ = new THREE.Vector3(0, 0, 1);
const ejeY = new THREE.Vector3(0, 1, 0);
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const eul = new THREE.Euler();
const d2r = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;

export class Mirada {
  constructor(camara) {
    this.camara = camara;
    this.yaw = 0; this.pitch = 0;
    this.offset = 0; this.base = 0;
    this.gyro = false; this.dev = null; this.alineado = false;
    this.bloqueo = false;            // true = cámara fija mirando al frente (modo conducción)
    this.orient = 0; this.cal = { beta: 50, gamma: 0 };
    this.qDev = new THREE.Quaternion(); this.qOff = new THREE.Quaternion();
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha == null || e.beta == null) return;
      this.dev = e; this.gyro = true;
    });
    const or = () => { this.orient = (screen.orientation && screen.orientation.angle) || window.orientation || 0; };
    window.addEventListener('orientationchange', or); or();
  }

  static async pedirPermiso() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        return (await DeviceOrientationEvent.requestPermission()) === 'granted';
      }
    } catch (e) { /* sin permiso: se usa arrastre */ }
    return true;
  }

  arrastrar(dx, dy) {
    const k = 0.0055;
    if (this.gyro) this.offset += dx * k;
    else {
      this.yaw += dx * k;
      this.pitch = clamp(this.pitch + dy * k, -1.35, 1.35);
    }
  }

  // guarda la posición actual del celular como "centro" para conducir
  calibrar() { if (this.dev) this.cal = { beta: this.dev.beta, gamma: this.dev.gamma || 0 }; }

  // inclinación normalizada (-1..1) respecto a la calibración
  inclinacion() {
    if (!this.gyro || !this.dev) return null;
    let dx = (this.dev.gamma || 0) - this.cal.gamma;
    let dy = this.dev.beta - this.cal.beta;
    const o = Math.round(this.orient);
    if (o === 90) [dx, dy] = [dy, -dx];
    else if (o === -90 || o === 270) [dx, dy] = [-dy, dx];
    return { x: clamp(dx / 22, -1, 1), y: clamp(-dy / 18, -1, 1) };
  }

  update() {
    const c = this.camara;
    if (this.bloqueo) { c.rotation.set(0, 0, 0); return; }
    if (this.gyro && this.dev) {
      const d = this.dev;
      eul.set(d2r(d.beta), d2r(d.alpha), -d2r(d.gamma || 0), 'YXZ');
      this.qDev.setFromEuler(eul).multiply(q1).multiply(q0.setFromAxisAngle(ejeZ, -d2r(this.orient)));
      if (!this.alineado) {
        const e = new THREE.Euler().setFromQuaternion(this.qDev, 'YXZ');
        this.base = this.yaw - e.y; this.alineado = true;
      }
      this.qOff.setFromAxisAngle(ejeY, this.base + this.offset);
      c.quaternion.copy(this.qOff).multiply(this.qDev);
    } else {
      c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
  }

  // reinicia la vista mirando al frente (útil al cambiar de escena)
  centrar() {
    if (this.gyro && this.dev) {
      const e = new THREE.Euler().setFromQuaternion(this.qDev, 'YXZ');
      this.offset = 0; this.base = -e.y;
    } else { this.yaw = 0; this.pitch = 0; }
  }

  yawActual() {
    return new THREE.Euler().setFromQuaternion(this.camara.quaternion, 'YXZ').y;
  }
}
