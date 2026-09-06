/* ==========================================================================
   Racing Hobbies Ecuador — Anti-clickjacking
   Parche de cliente: GitHub Pages no deja enviar X-Frame-Options, y
   `frame-ancestors` se IGNORA cuando va en <meta>. Sin esto la página se puede
   enmarcar y superponer (comprobado). La solución de verdad es poner un proxy
   delante (Cloudflare gratis) que sí mande las cabeceras; mientras tanto,
   este guardia corta el caso habitual.
   Se carga sin `defer` y de primero para actuar antes del primer pintado.
   ========================================================================== */

(function () {
  "use strict";

  if (window.top === window.self) return;

  // En local se trabaja dentro de iframes de previsualización: no estorbar.
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "") return;

  // Oculta primero: aunque la navegación falle, no queda nada que superponer.
  const root = document.documentElement;
  root.style.setProperty("display", "none", "important");

  try {
    window.top.location = window.self.location;
  } catch (err) {
    /* Marco de otro origen que impide navegar: la página queda oculta. */
  }
})();
