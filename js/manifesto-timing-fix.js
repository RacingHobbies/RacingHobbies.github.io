/* Ajusta la entrada del manifiesto en la versión publicada, que usa main.min.js. */
(function initManifestoTimingFix() {
  let queued = false;

  const isMobileScene = () =>
    window.matchMedia("(max-width: 599px) and (orientation: portrait)").matches;

  const run = () => {
    queued = false;

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const manifesto = document.querySelector(".ln-manifesto");
    if (!gsap || !ScrollTrigger || !manifesto) return;

    const stage = manifesto.querySelector(".ln-manifesto-stage");
    const lines = [...manifesto.querySelectorAll(".ln-manifesto-copy > span")];
    const blocks = [...manifesto.querySelectorAll(".ln-wipe-grid > span")];
    const copies = [...manifesto.querySelectorAll(".ln-manifesto-copy")];
    const mobile = isMobileScene();

    // main.min.js crea su propia línea tras la introducción inicial. Esta
    // corre después y elimina cualquier versión previa para que los dos
    // recorridos no apliquen transformaciones opuestas al mismo texto.
    ScrollTrigger.getAll()
      .filter(
        (trigger) =>
          trigger.trigger === stage ||
          trigger.vars.id === "rh-manifesto-timing-fix"
      )
      .forEach((trigger) => trigger.kill());

    const stickyTravel = () => {
      const styles = getComputedStyle(manifesto);
      return Math.max(
        1,
        manifesto.offsetHeight -
          parseFloat(styles.paddingTop) -
          parseFloat(styles.paddingBottom) -
          (stage ? stage.offsetHeight : 0)
      );
    };

    const timeline = gsap.timeline({
      scrollTrigger: mobile
        ? {
            // En móvil la escena mide exactamente una pantalla: el tramo
            // sticky de escritorio quedaba en 1 px. Se fija durante un gesto
            // completo para que la escena siga ocupando una sola pantalla
            // visual y no se mezcle a media animación con Categorías.
            trigger: manifesto,
            id: "rh-manifesto-timing-fix",
            start: "top top",
            end: "+=100%",
            pin: true,
            anticipatePin: 1,
            scrub: 0.24,
            invalidateOnRefresh: true,
          }
        : {
            trigger: stage || manifesto,
            id: "rh-manifesto-timing-fix",
            start: "top top",
            end: () => "+=" + stickyTravel(),
            scrub: true,
            invalidateOnRefresh: true,
          },
    });

    if (copies.length) {
      timeline.fromTo(
        copies,
        { yPercent: mobile ? -1 : -2 },
        { yPercent: mobile ? 5 : 8, ease: "none", duration: mobile ? 5.4 : 2.16 },
        0
      );
    }

    lines.forEach((line) => {
      const index = Array.prototype.indexOf.call(line.parentElement.children, line);
      timeline.fromTo(
        line,
        { xPercent: index % 2 ? 6 : -6, yPercent: -13, opacity: 0.25 },
        {
          xPercent: 0,
          yPercent: 0,
          opacity: 1,
          ease: "power1.inOut",
          duration: mobile ? 2.7 : 4.8,
        },
        index * (mobile ? 0.7 : 1.4)
      );
    });

    blocks.forEach((block) => {
      timeline
        .fromTo(
          block,
          { scaleY: 0 },
          { scaleY: 1, ease: "power1.inOut", duration: mobile ? 1.7 : 3 },
          mobile ? 0.7 : 1.2
        )
        .to(
          block,
          { scaleY: 0, ease: "power1.inOut", duration: mobile ? 1.5 : 2.5 },
          mobile ? 2.9 : 4.35
        );
    });

    if (copies.length) timeline.to({}, { duration: mobile ? 1.2 : 8 }, mobile ? 5.4 : 9);
    ScrollTrigger.refresh();
  };

  const queueRun = () => {
    if (queued) return;
    queued = true;
    // Dos cuadros dejan que main.min.js complete su montaje antes de sustituir
    // su timeline por esta versión calibrada.
    requestAnimationFrame(() => requestAnimationFrame(run));
  };

  const boot = () => {
    const tieneEscena = () =>
      document.documentElement.classList.contains("lando-anim");

    if (tieneEscena()) queueRun();

    // Sólo interesa el momento en que aparece `lando-anim`. Un MutationObserver
    // se dispara en CADA escritura del atributo `class`, aunque el valor no
    // cambie: `classList.add`/`remove` reescriben el atributo igual. La cabecera
    // que se retira llama a `remove` en cada cuadro de scroll, así que sin esta
    // comparación la escena se reconstruía ~10 veces por segundo mientras el
    // usuario desliza, y cada reconstrucción arrastraba un `ScrollTrigger`
    // .refresh() de casi cincuenta escenas: ~130 ms de bloqueo por cuadro.
    let escenaPrevia = tieneEscena();
    const observer = new MutationObserver(() => {
      const escenaActual = tieneEscena();
      if (escenaActual === escenaPrevia) return;
      escenaPrevia = escenaActual;
      if (escenaActual) queueRun();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Reconstruir la escena arrastra un `ScrollTrigger.refresh()` de casi
    // cincuenta escenas —140 ms medidos con la CPU a 1/6—, así que sólo puede
    // ocurrir cuando la maqueta cambia de verdad. En un teléfono el `resize`
    // más frecuente con diferencia es la barra de direcciones entrando y
    // saliendo: cambia el alto, nunca el ancho, y no altera el reparto de la
    // escena. Nos quedamos con los cambios de ancho y con el giro del
    // aparato, que sí la cambian.
    let anchoPrevio = window.innerWidth;
    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth === anchoPrevio) return;
        anchoPrevio = window.innerWidth;
        queueRun();
      },
      { passive: true }
    );
    window.addEventListener(
      "orientationchange",
      () => {
        anchoPrevio = window.innerWidth;
        queueRun();
      },
      { passive: true }
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
