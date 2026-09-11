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
    if (document.documentElement.classList.contains("lando-anim")) queueRun();

    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains("lando-anim")) queueRun();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("resize", queueRun, { passive: true });
    window.addEventListener("orientationchange", queueRun, { passive: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
