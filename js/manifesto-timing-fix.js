/* Ajusta la entrada del manifiesto en la versión publicada, que usa main.min.js. */
(function initManifestoTimingFix() {
  const run = () => {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const manifesto = document.querySelector(".ln-manifesto");

    if (!gsap || !ScrollTrigger || !manifesto) return;

    const stage = manifesto.querySelector(".ln-manifesto-stage");
    const lines = [...manifesto.querySelectorAll(".ln-manifesto-copy > span")];
    const blocks = [...manifesto.querySelectorAll(".ln-wipe-grid > span")];
    const copies = [...manifesto.querySelectorAll(".ln-manifesto-copy")];

    ScrollTrigger.getAll()
      .filter((trigger) => trigger.trigger === stage || trigger.trigger === manifesto)
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
      scrollTrigger: {
        trigger: stage || manifesto,
        start: "top top",
        end: () => "+=" + stickyTravel(),
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    if (copies.length) {
      timeline.fromTo(
        copies,
        { yPercent: -2 },
        { yPercent: 8, ease: "none", duration: 2.16 },
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
          duration: 4.8,
        },
        index * 1.4
      );
    });

    blocks.forEach((block) => {
      timeline.fromTo(
        block,
        { scaleY: 0 },
        { scaleY: 1, ease: "power1.inOut", duration: 3 },
        1.2
      ).to(
        block,
        { scaleY: 0, ease: "power1.inOut", duration: 2.5 },
        4.35
      );
    });

    if (copies.length) timeline.to({}, { duration: 8 }, 9);
    ScrollTrigger.refresh();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(run), { once: true });
  } else {
    requestAnimationFrame(run);
  }
})();
