# Misión Cristal Azul: guía rápida

Demo web interactivo para la feria de ciencia de ASOOCCIDENTE, con Mercado Libre como patrocinador. Funciona desde el navegador del celular, sin instalar nada.

## La historia, acto por acto
1. **La expedición**: las piedras flotan frente al laboratorio y hay que encontrar y tocar la azul. En celulares Android compatibles hay además un botón para empezar en realidad aumentada, donde las piedras aparecen sobre tu piso.
2. **El traslado**: hay que llevar la piedra al laboratorio **inclinando el celular**, esquivando rocas. Si chocas, vuelves al último punto de control. En computador se guía con el mouse o con las flechas.
3. **Las herramientas**: en el computador del laboratorio se abre la tienda de Mercado Libre y se piden unas pinzas. Suena el timbre y la caja llega a la puerta. Hay que llevarla al mesón y abrirla.
4. **La muestra**: con las pinzas se desliza el cristal hasta el contador Geiger y luego al recipiente de contención.
5. **Contra el reloj**: el cristal pierde estabilidad. Hay que pedir guantes y, mientras llegan, **mantener presionado** el botón de enfriamiento. Con los guantes se sella el cristal.
6. **El giro**: el cristal libera criaturas. Hay que atrapar solo las verdes, con combos, tiempo y puntaje.
7. **La contención**: se arrastran 4 piezas para armar la cápsula. Falta el núcleo de energía, que se pide en Mercado Libre. Al ponerlo, las criaturas entran a la cápsula.
8. **Cierre**: logos, mensaje, contacto, QR opcional y resumen de la partida.

## Qué se edita (config.js)
- `institucion`, `logoInstitucion`: ASOOCCIDENTE y su logo (ya incluido en `logos/`).
- `patrocinador`, `logoPatrocinador`: Mercado Libre y su logo (ya incluido en `logos/`).
- Tiempos y dificultad: `segundosEnvio`, `segundosEstabilidad`, `segundosCaptura`, `criaturasObjetivo`, `largoCamino`.
- `final`: título, mensaje, contacto y QR.

## Publicarlo
Necesita HTTPS (GitHub Pages o Netlify). No funciona con doble clic sobre `index.html`.

## Atajos para probar
- `?etapa=camino`, `entrega`, `cristal`, `estabilidad`, `criaturas` o `capsula`: salta directo a ese acto.
- `?rapido=1`: el traslado va 4 veces más rápido (solo para pruebas).

## Notas
- La tienda es una **simulación**: no cobra nada y lo dice en pantalla.
- La realidad aumentada usa WebXR, que hoy funciona en Chrome de Android. En iPhone el botón no aparece y la experiencia arranca en 360°.
