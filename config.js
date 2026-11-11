/*
  CONFIGURACIÓN DEL DEMO · Misión Cristal Azul
  ────────────────────────────────────────────
  Cambia los textos entre comillas y guarda. No borres las comas.
*/
window.DEMO_CONFIG = {

  titulo: "Misión Cristal Azul",

  // Institución (aparece en la pared del laboratorio, en el computador y en el cierre)
  institucion: "ASOOCCIDENTE",
  logoInstitucion: "logos/asooccidente.png",

  // Patrocinador (la tienda del computador). Pon su logo en la carpeta "logos".
  // Si el archivo no existe, se muestra el nombre escrito.
  patrocinador: "Mercado Libre",
  logoPatrocinador: "logos/mercado-libre.png",

  // ── TIEMPOS Y DIFICULTAD ─────────────────────────────
  segundosEnvio: 5,          // lo que tarda cada pedido en llegar a la puerta
  segundosEstabilidad: 40,   // tiempo antes de que el cristal se desestabilice (acto 4)
  segundosCaptura: 30,       // tiempo para atrapar criaturas
  criaturasObjetivo: 10,     // criaturas verdes que hay que atrapar
  criaturasDistractoras: 14, // criaturas de otros colores (no se tocan)
  largoCamino: 54,           // metros del recorrido conduciendo la piedra

  // ── CIERRE ──────────────────────────────────────────
  final: {
    titulo: "Misión cumplida",
    mensaje: "Con buena ciencia, buenas herramientas y entregas a tiempo, cualquier descubrimiento es posible.",
    contacto: "",
    qr: ""   // enlace para el QR (vacío = sin QR)
  }
};
