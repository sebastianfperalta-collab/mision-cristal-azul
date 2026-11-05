// Tienda del patrocinador (simulación para el demo)
const ICONOS = {
  pinzas: '<svg viewBox="0 0 100 100"><g stroke="#8a96a3" stroke-width="7" stroke-linecap="round"><line x1="50" y1="12" x2="36" y2="88"/><line x1="50" y1="12" x2="64" y2="88"/></g><g stroke="#e35c27" stroke-width="12" stroke-linecap="round"><line x1="47" y1="22" x2="43" y2="44"/><line x1="53" y1="22" x2="57" y2="44"/></g><circle cx="50" cy="12" r="7" fill="#5b6672"/></svg>',
  guantes: '<svg viewBox="0 0 100 100"><path d="M30 88V52l-8-20c-2-6 6-9 9-3l7 15V18c0-6 9-6 9 0v22-28c0-6 9-6 9 0v28-24c0-6 9-6 9 0v26-18c0-6 9-6 9 0v44c0 12-8 18-18 18H30z" fill="#ff8a3d"/><rect x="30" y="80" width="44" height="12" rx="3" fill="#333d48"/></svg>',
  nucleo: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="18" fill="#7ef9ff"/><circle cx="50" cy="50" r="28" fill="none" stroke="#7ef9ff" stroke-opacity=".35" stroke-width="10"/><ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="#e35c27" stroke-width="5"/><ellipse cx="50" cy="50" rx="14" ry="40" fill="none" stroke="#e35c27" stroke-width="5"/></svg>',
  probetas: '<svg viewBox="0 0 100 100"><g fill="#bfeaff" stroke="#6b7a88" stroke-width="3"><rect x="20" y="20" width="14" height="60" rx="7"/><rect x="43" y="20" width="14" height="60" rx="7"/><rect x="66" y="20" width="14" height="60" rx="7"/></g><rect x="20" y="55" width="14" height="25" rx="7" fill="#3ddc84"/><rect x="43" y="45" width="14" height="35" rx="7" fill="#b06cff"/><rect x="66" y="60" width="14" height="20" rx="7" fill="#ffd23f"/></svg>',
  gafas: '<svg viewBox="0 0 100 100"><path d="M10 45h80v12c0 10-8 16-18 16-9 0-14-6-17-13h-10c-3 7-8 13-17 13-10 0-18-6-18-16z" fill="#bfeaff" stroke="#2d3277" stroke-width="5"/></svg>',
  bata: '<svg viewBox="0 0 100 100"><path d="M35 12l15 12 15-12 20 10v68H15V22z" fill="#f4f6f8" stroke="#9aa7b3" stroke-width="4"/><line x1="50" y1="24" x2="50" y2="90" stroke="#9aa7b3" stroke-width="3"/></svg>',
};

export const CATALOGO = [
  { id: 'pinzas', nombre: 'Pinzas de precisión para laboratorio en acero inoxidable', precio: 38900 },
  { id: 'guantes', nombre: 'Guantes de protección antirradiación (par)', precio: 64900 },
  { id: 'nucleo', nombre: 'Núcleo de energía para cápsula de contención', precio: 129900 },
  { id: 'probetas', nombre: 'Kit de probetas de vidrio x3', precio: 52000 },
  { id: 'gafas', nombre: 'Gafas de seguridad antiempañantes', precio: 24900 },
  { id: 'bata', nombre: 'Bata de laboratorio manga larga', precio: 79900 },
];
const pesos = (n) => '$ ' + n.toLocaleString('es-CO');

export class Tienda {
  constructor({ raiz, patrocinador, logo, institucion, segundos }) {
    this.raiz = raiz; this.segundos = segundos;
    raiz.innerHTML = `
      <div class="ml-panel">
        <header class="ml-top">
          <div class="ml-marca">${logo ? `<img src="${logo}" alt="${patrocinador}">` : `<b>${patrocinador.toLowerCase()}</b>`}</div>
          <div class="ml-buscar">Buscar productos, marcas y más…</div>
          <button class="ml-cerrar" aria-label="Cerrar">✕</button>
        </header>
        <div class="ml-dir">📍 Enviar a <b>Laboratorio ${institucion}</b></div>
        <div class="ml-lista"></div>
        <div class="ml-checkout oculto"></div>
      </div>`;
    this.lista = raiz.querySelector('.ml-lista');
    this.checkout = raiz.querySelector('.ml-checkout');
    if (logo) raiz.querySelector('.ml-marca img').onerror = (e) => { e.target.replaceWith(Object.assign(document.createElement('b'), { textContent: patrocinador.toLowerCase() })); };
  }

  // Abre la tienda y resuelve cuando el usuario compra el producto requerido
  comprar(idRequerido, alSonido = {}) {
    return new Promise((resolver) => {
      const r = this.raiz;
      this.checkout.classList.add('oculto'); this.lista.classList.remove('oculto');
      const orden = [idRequerido, ...CATALOGO.map((p) => p.id).filter((i) => i !== idRequerido)];
      this.lista.innerHTML = orden.map((id) => {
        const p = CATALOGO.find((x) => x.id === id), req = id === idRequerido;
        return `<article class="ml-card ${req ? 'req' : ''}" data-id="${id}">
          <div class="ml-img">${ICONOS[id]}</div>
          <div class="ml-info">
            ${req ? '<span class="ml-badge">Lo necesitas para tu misión</span>' : ''}
            <p class="ml-nombre">${p.nombre}</p>
            <p class="ml-precio">${pesos(p.precio)}</p>
            <p class="ml-envio">Llega gratis <b>en ${this.segundos} segundos</b> <span class="ml-full">⚡FULL</span></p>
            ${req ? '<button class="ml-btn">Comprar ahora</button>' : '<button class="ml-btn gris">No lo necesitas ahora</button>'}
          </div></article>`;
      }).join('');
      r.classList.remove('oculto'); r.scrollTop = 0; this.lista.scrollTop = 0;
      const cerrar = r.querySelector('.ml-cerrar');
      cerrar.onclick = () => { r.classList.add('oculto'); alSonido.cerrar && alSonido.cerrar(); this._cerrada = true; resolver(null); };
      this.lista.querySelectorAll('.ml-card').forEach((card) => {
        const id = card.dataset.id, btn = card.querySelector('.ml-btn');
        btn.onclick = () => {
          if (id !== idRequerido) { card.classList.add('sacudir'); setTimeout(() => card.classList.remove('sacudir'), 400); alSonido.error && alSonido.error(); return; }
          alSonido.tic && alSonido.tic();
          const p = CATALOGO.find((x) => x.id === id);
          this.lista.classList.add('oculto'); this.checkout.classList.remove('oculto');
          this.checkout.innerHTML = `
            <h3>Confirma tu compra</h3>
            <div class="ml-resumen"><div class="ml-img chica">${ICONOS[id]}</div><div><p class="ml-nombre">${p.nombre}</p><p class="ml-precio">${pesos(p.precio)}</p></div></div>
            <div class="ml-linea"><span>Envío</span><b class="verde">Gratis</b></div>
            <div class="ml-linea"><span>Llega</span><b>en ${this.segundos} s a la puerta del laboratorio</b></div>
            <button class="ml-btn grande">Confirmar compra</button>
            <p class="ml-nota">Compra simulada para el demo. No se realiza ningún cobro.</p>`;
          this.checkout.querySelector('.ml-btn').onclick = () => {
            alSonido.compra && alSonido.compra();
            this.checkout.innerHTML = `<div class="ml-ok"><div class="ml-check">✓</div><h3>¡Listo! Tu compra está en camino</h3><p>${p.nombre}</p></div>`;
            setTimeout(() => { r.classList.add('oculto'); resolver(p); }, 1300);
          };
        };
      });
    });
  }
}
