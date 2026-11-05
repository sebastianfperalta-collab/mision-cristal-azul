// Sonidos sintetizados con Web Audio (no requieren archivos)
let ctx = null, master = null, amb = null, mudo = false;
let bufRuido = null;

function ruidoBuffer() {
  if (bufRuido) return bufRuido;
  const n = ctx.sampleRate * 2;
  bufRuido = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = bufRuido.getChannelData(0);
  let ult = 0;
  for (let i = 0; i < n; i++) { // ruido "café": más grave y suave
    const b = Math.random() * 2 - 1;
    ult = (ult + 0.02 * b) / 1.02;
    d[i] = ult * 3.5;
  }
  return bufRuido;
}

export const audio = {
  iniciar() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  },
  get mudo() { return mudo; },
  silenciar(m) { mudo = m; if (master) master.gain.value = m ? 0 : 0.8; },

  tono(f, dur, { tipo = 'sine', vol = 0.25, hasta = null, retardo = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + retardo;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t0);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  ruido(dur, { vol = 0.2, filtro = 800, hasta = null, retardo = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + retardo;
    const s = ctx.createBufferSource(); s.buffer = ruidoBuffer();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filtro, t0);
    if (hasta) f.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t0); s.stop(t0 + dur + 0.1);
  },

  pop() { this.tono(520, 0.14, { hasta: 1500, vol: 0.28 }); this.tono(1100, 0.08, { tipo: 'triangle', vol: 0.12, retardo: 0.04 }); },
  error() { this.tono(210, 0.24, { tipo: 'square', vol: 0.1, hasta: 110 }); },
  tic() { this.tono(1250, 0.05, { tipo: 'square', vol: 0.05 }); },
  agarrar() { this.tono(660, 0.07, { tipo: 'triangle', vol: 0.12 }); },
  encaje() { this.tono(320, 0.07, { tipo: 'square', vol: 0.1 }); this.tono(960, 0.2, { tipo: 'triangle', vol: 0.2, retardo: 0.05 }); },
  exito() { [523, 659, 784, 1047].forEach((f, i) => this.tono(f, 0.4, { tipo: 'triangle', vol: 0.18, retardo: i * 0.11 })); },
  burbujas() { for (let i = 0; i < 8; i++) this.tono(300 + Math.random() * 500, 0.09, { hasta: 900 + Math.random() * 600, vol: 0.06, retardo: i * 0.07 + Math.random() * 0.05 }); },
  escotilla() { this.ruido(0.9, { vol: 0.35, filtro: 900, hasta: 120 }); this.tono(95, 0.7, { tipo: 'sawtooth', vol: 0.07, hasta: 55 }); this.tono(1400, 0.12, { tipo: 'square', vol: 0.05, retardo: 0.75 }); },
  boton() { this.tono(180, 0.08, { tipo: 'square', vol: 0.12 }); },
  motor() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(38, t0); o.frequency.exponentialRampToValueAtTime(95, t0 + 1.8);
    f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.4);
    g.gain.setValueAtTime(0.22, t0 + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
    o.connect(f).connect(g).connect(master); o.start(t0); o.stop(t0 + 4.1);
    this.ruido(3, { vol: 0.15, filtro: 300, hasta: 900 });
    [392, 523, 659, 784].forEach((fr, i) => this.tono(fr, 0.5, { tipo: 'triangle', vol: 0.12, retardo: 1.6 + i * 0.12 }));
  },

  timbre() { this.tono(988, 0.55, { tipo: 'triangle', vol: 0.25 }); this.tono(784, 0.8, { tipo: 'triangle', vol: 0.25, retardo: 0.45 }); },
  compra() { this.tono(1318, 0.12, { tipo: 'square', vol: 0.08 }); this.tono(1760, 0.3, { tipo: 'triangle', vol: 0.15, retardo: 0.09 }); },
  geiger() { this.ruido(0.025, { vol: 0.25, filtro: 4000 }); },
  choque() { this.ruido(0.35, { vol: 0.5, filtro: 600, hasta: 80 }); this.tono(90, 0.3, { tipo: 'square', vol: 0.12, hasta: 50 }); },
  alien() { const f = 600 + Math.random() * 500; this.tono(f, 0.16, { tipo: 'sine', vol: 0.12, hasta: f * 2.2 }); },
  captura() { this.tono(880, 0.08, { tipo: 'square', vol: 0.08 }); this.tono(1320, 0.18, { tipo: 'sine', vol: 0.2, hasta: 2400, retardo: 0.05 }); },
  abrir() { this.ruido(0.3, { vol: 0.2, filtro: 2500, hasta: 600 }); this.tono(520, 0.2, { tipo: 'triangle', vol: 0.1, hasta: 900 }); },
  frio() { this.ruido(0.5, { vol: 0.12, filtro: 6000, hasta: 2500 }); },
  carga() { this.tono(300, 1.2, { tipo: 'sawtooth', vol: 0.05, hasta: 1200 }); },
  grieta() { this.ruido(0.6, { vol: 0.45, filtro: 3000, hasta: 200 }); this.tono(140, 0.9, { tipo: 'sawtooth', vol: 0.1, hasta: 40 }); },
  alarma(veces = 3) { for (let i = 0; i < veces; i++) { this.tono(620, 0.45, { tipo: 'square', vol: 0.07, hasta: 920, retardo: i * 0.9 }); this.tono(920, 0.45, { tipo: 'square', vol: 0.07, hasta: 620, retardo: i * 0.9 + 0.45 }); } },
  zumbido(on) {
    if (!ctx) return;
    if (on && !this._z) {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 70; f.type = 'lowpass'; f.frequency.value = 300;
      g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.5);
      o.connect(f).connect(g).connect(master); o.start(); this._z = { o, g };
    } else if (!on && this._z) {
      const z = this._z; this._z = null;
      z.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4); setTimeout(() => z.o.stop(), 500);
    }
  },
  velocidad(v) { if (this._z) this._z.o.frequency.value = 60 + v * 40; },

  ambiente(on) {
    if (!ctx) return;
    if (on && !amb) {
      const s = ctx.createBufferSource(); s.buffer = ruidoBuffer(); s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 2);
      s.connect(f).connect(g).connect(master); s.start();
      amb = { s, g };
    } else if (!on && amb) {
      amb.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      const a = amb; amb = null; setTimeout(() => a.s.stop(), 700);
    }
  }
};
