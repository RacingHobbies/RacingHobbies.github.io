/* ==========================================================================
   Racing Hobbies Ecuador — Núcleo del sitio (v2)
   Header, menú móvil, carrito (localStorage), drawer, modal de producto,
   toasts, reveals y animaciones de interfaz.
   ========================================================================== */

(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Las animaciones decorativas no deben competir con el gesto de scroll en
  // equipos con poca memoria o pocos núcleos. Lenis y las pausas de lectura se
  // conservan; sólo se omiten capas visuales que el CSS ya sabe mostrar de
  // forma estática.
  const LOW_POWER_DEVICE =
    Number(navigator.deviceMemory || 8) <= 4 ||
    Number(navigator.hardwareConcurrency || 8) <= 4;

  // Señala que JS está activo: habilita las animaciones en CSS.
  document.documentElement.classList.add("js");

  /* ---------- Utilidades ---------- */

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ---------- Altura del documento, cacheada ----------
     Leer `documentElement.scrollHeight` obliga al navegador a maquetar la
     página entera. La cabecera, el raíl y el indicador lo leían cada uno en su
     propio frame de scroll y, como entre esas lecturas se escriben estilos,
     cada una forzaba un reflujo síncrono. El valor sólo cambia al redimensionar
     o cuando crece el documento, así que se cachea y se invalida por evento. */

  let docHeightCache = 0;
  let docHeightStale = true;
  const invalidateDocHeight = () => {
    docHeightStale = true;
  };

  function docHeight() {
    if (docHeightStale) {
      docHeightCache = document.documentElement.scrollHeight;
      docHeightStale = false;
    }
    return docHeightCache;
  }

  // Recorrido de scroll disponible, la cuenta que repetían los tres handlers.
  function scrollRange() {
    return docHeight() - window.innerHeight;
  }

  window.addEventListener("resize", invalidateDocHeight, { passive: true });
  window.addEventListener("load", invalidateDocHeight);
  if ("ResizeObserver" in window) {
    // El alto cambia al revelarse secciones o al maquetar imágenes diferidas.
    new ResizeObserver(invalidateDocHeight).observe(document.documentElement);
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatUSD(n) {
    const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
    return "$" + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function getProduct(id) {
    return RH_PRODUCTS.find((p) => p.id === id) || null;
  }

  function catLabel(slug) {
    const c = RH_CATEGORIES.find((c) => c.slug === slug);
    return c ? c.label : slug;
  }

  function waLink(message) {
    const phone = String(RH_CONFIG.whatsapp || "").trim();
    if (!/^\d{8,15}$/.test(phone)) return "#";
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(String(message).slice(0, 4000));
  }

  function safeProductAsset(value) {
    const asset = String(value || "");
    return /^assets\/img\/[a-z0-9][a-z0-9/_-]*\.webp$/i.test(asset)
      ? asset
      : "assets/img/logo-mark-180.webp";
  }

  function productImg(p) {
    const img = document.createElement("img");
    const asset = safeProductAsset(p.img);
    img.src = asset;
    img.srcset =
      asset.replace(/\.webp$/, "-480.webp") +
      " 480w, " +
      asset.replace(/\.webp$/, "-640.webp") +
      " 640w, " +
      asset +
      (p.id === "tmaxx" ? " 600w" : " 800w");
    img.sizes = "(max-width: 680px) 84vw, (max-width: 1100px) 44vw, 300px";
    img.alt = p.name;
    img.width = p.id === "tmaxx" ? 600 : 800;
    img.height = p.id === "tmaxx" ? 466 : 800;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    return img;
  }

  /* ---------- Carrito (localStorage) ---------- */

  const CART_KEY = "rh_cart_v1";

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      // El carrito es un dato de conveniencia, no una entrada confiable. Un
      // valor artificialmente grande no debe bloquear la carga del sitio.
      if (!raw || raw.length > 16 * 1024) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const seen = new Set();
      return parsed.filter((it) => {
        const valid =
          it &&
          Object.prototype.toString.call(it) === "[object Object]" &&
          typeof it.id === "string" &&
          it.id.length <= 80 &&
          !seen.has(it.id) &&
          Number.isInteger(it.qty) &&
          it.qty > 0 &&
          it.qty <= 99 &&
          getProduct(it.id);
        if (valid) seen.add(it.id);
        return Boolean(valid);
      });
    } catch {
      return [];
    }
  }

  let cart = loadCart();

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* localStorage no disponible: el carrito vive en memoria */
    }
  }

  function cartCount() {
    return cart.reduce((sum, it) => sum + it.qty, 0);
  }

  function cartTotal() {
    return cart.reduce((sum, it) => {
      const p = getProduct(it.id);
      return p ? sum + p.price * it.qty : sum;
    }, 0);
  }

  function addToCart(id, qty) {
    const p = getProduct(id);
    if (!p) return;
    const n = Math.max(1, Math.min(99, qty || 1));
    const existing = cart.find((it) => it.id === id);
    if (existing) {
      existing.qty = Math.min(99, existing.qty + n);
    } else {
      cart.push({ id, qty: n });
    }
    saveCart();
    renderCartUI(true);
    showToast(p.name + " agregado al carrito 🏁");
  }

  function setQty(id, qty) {
    const it = cart.find((x) => x.id === id);
    if (!it) return;
    if (!Number.isInteger(qty)) return;
    it.qty = Math.min(99, qty);
    if (it.qty <= 0) {
      cart = cart.filter((x) => x.id !== id);
    }
    saveCart();
    renderCartUI(false);
  }

  function removeFromCart(id) {
    cart = cart.filter((x) => x.id !== id);
    saveCart();
    renderCartUI(false);
  }

  function clearCart() {
    if (cart.length === 0) return;
    cart = [];
    saveCart();
    renderCartUI(false);
    showToast("Carrito vaciado.");
  }

  /* ---------- Toast ---------- */

  let toastTimer = null;

  function showToast(msg) {
    const el = $("#rh-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  /* ---------- Inyección de UI global (drawer, modal, toast) ---------- */

  function injectGlobalUI() {
    const host = document.createElement("div");
    host.id = "rh-global-ui";
    // Solo markup estático controlado por el sitio: sin datos externos.
    // `data-lenis-prevent` en el modal y en el carrito: Lenis arranca con
    // `syncTouch`, así que se apropia del gesto táctil de toda la página. Al
    // abrir un overlay sólo se llama a `lenis.stop()`, que impide mover el
    // fondo pero NO retira sus escuchadores, de modo que también se comía el
    // arrastre dentro de la ficha: 82px de contenido —el precio y el botón de
    // "Agregar"— quedaban inalcanzables en el móvil. Este atributo es la vía
    // que Lenis define para que un contenedor con scroll propio se libre.
    host.innerHTML = `
      <div class="drawer-backdrop" id="rh-drawer-backdrop" hidden></div>
      <aside class="cart-drawer" id="rh-cart-drawer" role="dialog" aria-modal="true" aria-labelledby="rh-cart-title" aria-describedby="rh-cart-note" data-lenis-prevent hidden>
        <div class="cart-head">
          <h2 id="rh-cart-title">Tu carrito</h2>
          <button class="modal-close" type="button" data-close-cart aria-label="Cerrar carrito">✕</button>
        </div>
        <div class="cart-items" id="rh-cart-items"></div>
        <div class="cart-foot" id="rh-cart-foot" hidden>
          <div class="cart-total-row">
            <span>Total</span>
            <strong id="rh-cart-total">$0</strong>
          </div>
          <a class="btn btn-volt" id="rh-checkout" href="#" target="_blank" rel="noopener noreferrer">
            Pedir por WhatsApp <span class="arrow" aria-hidden="true">→</span>
          </a>
          <button class="cart-clear" type="button" data-clear-cart>Vaciar carrito</button>
          <p class="cart-note" id="rh-cart-note">El total es referencial. La tienda confirma disponibilidad, pago y entrega por WhatsApp.</p>
        </div>
      </aside>
      <div class="modal-backdrop" id="rh-modal-backdrop" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rh-modal-title" data-lenis-prevent>
          <button class="modal-close" type="button" data-close-modal aria-label="Cerrar detalle">✕</button>
          <div class="modal-media" id="rh-modal-media"></div>
          <div class="modal-body" id="rh-modal-body"></div>
        </div>
      </div>
      <button class="back-top" id="rh-back-top" type="button" aria-label="Volver al inicio de la página">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="m6 14 6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="toast" id="rh-toast" role="status" aria-live="polite"></div>`;
    document.body.appendChild(host);
  }

  /* ---------- Drawer del carrito ---------- */

  let cartReturnFocus = null;
  let modalReturnFocus = null;
  let cartHideTimer = null;
  let modalHideTimer = null;

  /* --- Bloqueo real del scroll de fondo ---------------------------------
     `overflow: hidden` sobre el body NO ata el scroll táctil en Safari de iOS:
     el fondo seguía avanzando a la vez que la ficha, en vez de cederle la
     prioridad. Fijar el body y compensar con `top` sí lo detiene en todos los
     navegadores. Al soltar se restituye la posición exacta y se resincroniza
     Lenis, que si no volvería con la que tenía guardada.

     El estado se deduce de las clases y no de un booleano suelto, para que
     abrir el carrito desde el menú (dos capas a la vez) no desbloquee el
     fondo al cerrar sólo una de ellas. */
  let lockedScrollY = 0;
  let scrollLocked = false;

  function syncPageScrollLock() {
    const body = document.body;
    const shouldLock =
      body.classList.contains("overlay-open") ||
      body.classList.contains("menu-open");
    if (shouldLock === scrollLocked) return;
    scrollLocked = shouldLock;
    if (shouldLock) {
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      body.style.top = `-${lockedScrollY}px`;
      body.classList.add("scroll-locked");
    } else {
      body.classList.remove("scroll-locked");
      body.style.top = "";
      window.scrollTo(0, lockedScrollY);
      if (window.rhLenis) {
        window.rhLenis.scrollTo(lockedScrollY, { immediate: true, force: true });
      }
    }
  }

  /* --- La cabecera se retira al bajar y vuelve al subir -----------------
     El logo y los botones son `fixed`, así que el contenido pasaba por detrás
     de ellos: medido recorriendo las siete páginas, había texto bajo la
     cabecera en 86 posiciones de scroll. Un velo por detrás no vale (el que
     hubo aquí destapaba un verde en las escenas fijadas), y agrandar los
     márgenes de cada sección tampoco: el choque ocurre a mitad de recorrido,
     no en los bordes. Retirar la cabecera al bajar lo resuelve de raíz y
     además devuelve esos 62px de pantalla mientras se lee. */
  (function cabeceraQueSeRetira() {
    const raiz = document.documentElement;
    let ultimo = window.scrollY || 0;
    let pedido = false;

    const evaluar = () => {
      pedido = false;
      const y = window.scrollY || 0;
      const delta = y - ultimo;
      // Con una capa abierta el fondo está bloqueado: la cabecera se queda.
      const bloqueado =
        document.body.classList.contains("menu-open") ||
        document.body.classList.contains("cart-open") ||
        document.body.classList.contains("overlay-open");

      if (bloqueado || y < 170) {
        raiz.classList.remove("rh-cabecera-oculta");
      } else if (delta > 6) {
        raiz.classList.add("rh-cabecera-oculta");
      } else if (delta < -6) {
        raiz.classList.remove("rh-cabecera-oculta");
      }
      // El umbral de 6px evita que el rebote del scroll suave la haga parpadear.
      if (Math.abs(delta) > 6) ultimo = y;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (pedido) return;
        pedido = true;
        window.requestAnimationFrame(evaluar);
      },
      { passive: true }
    );
  })();

  function setBackgroundInert(active) {
    Array.from(document.body.children).forEach((child) => {
      if (child.id !== "rh-global-ui" && child.tagName !== "SCRIPT") {
        child.inert = active;
      }
    });
    document.body.classList.toggle("overlay-open", active);
    syncPageScrollLock();
  }

  function openCart(returnFocus) {
    const drawer = $("#rh-cart-drawer");
    const backdrop = $("#rh-drawer-backdrop");
    if (!drawer) return;
    clearTimeout(cartHideTimer);
    cartReturnFocus = returnFocus || document.activeElement;
    drawer.hidden = false;
    backdrop.hidden = false;
    setBackgroundInert(true);
    requestAnimationFrame(() => {
      drawer.classList.add("open");
      backdrop.classList.add("open");
      // Entrada escalonada de los items solo al abrir (no en cada cambio de qty).
      drawer.classList.add("just-opened");
      window.setTimeout(() => drawer.classList.remove("just-opened"), 700);
    });
    const closeBtn = $("[data-close-cart]", drawer);
    if (closeBtn) closeBtn.focus();
  }

  function closeCart() {
    const drawer = $("#rh-cart-drawer");
    const backdrop = $("#rh-drawer-backdrop");
    if (!drawer || !drawer.classList.contains("open")) return;
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    setBackgroundInert(false);
    cartHideTimer = setTimeout(() => {
      drawer.hidden = true;
      backdrop.hidden = true;
    }, 460);
    if (cartReturnFocus && typeof cartReturnFocus.focus === "function") {
      cartReturnFocus.focus();
    }
  }

  function renderCartUI(bump) {
    const count = cartCount();
    $$(".cart-count").forEach((badge) => {
      badge.textContent = count === 0 ? "" : count > 99 ? "99+" : String(count);
      badge.classList.toggle("show", count > 0);
      if (bump && count > 0) {
        badge.classList.remove("pulse");
        void badge.offsetWidth; // reinicia la animación
        badge.classList.add("pulse");
      }
    });
    if (bump && count > 0) {
      $$(".cart-btn").forEach((btn) => {
        btn.classList.remove("bump");
        void btn.offsetWidth; // reinicia la animación
        btn.classList.add("bump");
      });
    }
    $$("[data-open-cart]").forEach((button) => {
      button.setAttribute(
        "aria-label",
        count === 0
          ? "Abrir carrito, está vacío"
          : `Abrir carrito, ${count} ${count === 1 ? "producto" : "productos"}`
      );
    });

    const wrap = $("#rh-cart-items");
    const foot = $("#rh-cart-foot");
    if (!wrap) return;
    wrap.textContent = "";

    if (cart.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cart-empty";
      empty.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M3 4h2l2.6 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 8H6" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>
        </svg>
        <p><strong>Tu carrito está vacío.</strong><br>Es hora de encender motores.</p>`;
      wrap.appendChild(empty);
      if (foot) foot.hidden = true;
      return;
    }

    cart.forEach((it) => {
      const p = getProduct(it.id);
      if (!p) return;
      const row = document.createElement("div");
      row.className = "cart-item";
      const media = document.createElement("div");
      media.className = "cart-item-media";
      media.appendChild(productImg(p));
      const info = document.createElement("div");
      info.innerHTML = `
        <div class="cart-item-name">${escapeHTML(p.name)}</div>
        <div class="cart-item-price">${formatUSD(p.price * it.qty)} <small>${formatUSD(p.price)} c/u</small></div>
        <div class="qty-controls">
          <button class="qty-btn" type="button" data-qty="-1" data-id="${escapeHTML(p.id)}" aria-label="Reducir cantidad">−</button>
          <span class="qty-val" aria-live="polite">${it.qty}</span>
          <button class="qty-btn" type="button" data-qty="1" data-id="${escapeHTML(p.id)}" aria-label="Aumentar cantidad">+</button>
        </div>`;
      const remove = document.createElement("button");
      remove.className = "cart-item-remove";
      remove.type = "button";
      remove.dataset.remove = p.id;
      remove.setAttribute("aria-label", "Quitar " + p.name + " del carrito");
      remove.textContent = "Quitar";
      row.append(media, info, remove);
      wrap.appendChild(row);
    });

    if (foot) {
      foot.hidden = false;
      const totalEl = $("#rh-cart-total");
      if (totalEl) totalEl.textContent = formatUSD(cartTotal());
      const checkout = $("#rh-checkout");
      if (checkout) checkout.href = buildOrderLink();
    }
  }

  function buildOrderLink() {
    const lines = ["¡Hola Racing Hobbies! Quiero hacer este pedido:", ""];
    cart.forEach((it) => {
      const p = getProduct(it.id);
      if (!p) return;
      lines.push(`- ${it.qty} × ${p.name} — ${formatUSD(p.price * it.qty)}`);
    });
    lines.push("", "Total: " + formatUSD(cartTotal()));
    lines.push("", "¿Me confirman disponibilidad y formas de pago? ¡Gracias!");
    return waLink(lines.join("\n"));
  }

  /* ---------- Modal de producto ---------- */

  function openProductModal(id) {
    const p = getProduct(id);
    const backdrop = $("#rh-modal-backdrop");
    if (!p || !backdrop) return;
    clearTimeout(modalHideTimer);
    modalReturnFocus = document.activeElement;

    const media = $("#rh-modal-media");
    media.textContent = "";
    media.appendChild(productImg(p));

    const body = $("#rh-modal-body");
    body.textContent = "";

    const cat = document.createElement("p");
    cat.className = "prod-cat";
    cat.textContent = catLabel(p.cat);

    const title = document.createElement("h2");
    title.id = "rh-modal-title";
    title.textContent = p.name;

    const desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = p.desc;

    const specs = document.createElement("ul");
    specs.className = "modal-specs";
    p.specs.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      specs.appendChild(li);
    });

    const foot = document.createElement("div");
    foot.className = "modal-foot";
    const price = document.createElement("div");
    price.className = "prod-price";
    const small = document.createElement("small");
    small.textContent = "USD";
    price.appendChild(small);
    price.appendChild(document.createTextNode(formatUSD(p.price)));
    const btn = document.createElement("button");
    btn.className = "btn btn-ink btn-sm";
    btn.type = "button";
    btn.textContent = "Agregar al carrito";
    btn.addEventListener("click", () => {
      addToCart(p.id, 1);
      const returnTarget = modalReturnFocus;
      closeProductModal(false);
      openCart(returnTarget);
    });
    foot.append(price, btn);

    body.append(cat, title, desc, specs, foot);

    backdrop.hidden = false;
    setBackgroundInert(true);
    requestAnimationFrame(() => backdrop.classList.add("open"));
    $("[data-close-modal]", backdrop).focus();
  }

  function closeProductModal(restoreFocus = true) {
    const backdrop = $("#rh-modal-backdrop");
    if (!backdrop || !backdrop.classList.contains("open")) return;
    backdrop.classList.remove("open");
    setBackgroundInert(false);
    modalHideTimer = setTimeout(() => {
      backdrop.hidden = true;
    }, 320);
    if (
      restoreFocus &&
      modalReturnFocus &&
      typeof modalReturnFocus.focus === "function"
    ) {
      modalReturnFocus.focus();
    }
  }

  /* ---------- Tarjetas de producto ----------
     variant "tile"  → sección oscura (vitrina)
     variant "card"  → catálogo sobre crema                      */

  function productCard(p, delayIndex, variant) {
    const dark = variant === "tile";
    const card = document.createElement("article");
    card.className = (dark ? "tile" : "prod-card") + " reveal";
    // Toda la tarjeta abre la ficha rápida (el handler prioriza [data-add],
    // así que el botón "Agregar" sigue funcionando sin abrir el modal).
    card.dataset.detail = p.id;
    if (typeof delayIndex === "number") {
      card.style.setProperty("--d", Math.min(delayIndex * 0.06, 0.4) + "s");
    }

    const media = document.createElement("button");
    media.className = dark ? "tile-media" : "prod-media";
    media.type = "button";
    media.setAttribute("aria-label", "Ver detalle de " + p.name);
    media.dataset.detail = p.id;
    media.appendChild(productImg(p));
    if (p.tag) {
      const tag = document.createElement("span");
      tag.className = (dark ? "tile-tag" : "prod-tag") + (p.tag === "oferta" ? " hot" : "");
      tag.textContent =
        p.tag === "top" ? "Top ventas" : p.tag === "nuevo" ? "Nuevo" : "Oferta";
      card.appendChild(tag);
    }

    const body = document.createElement("div");
    body.className = dark ? "tile-body" : "prod-body";

    const cat = document.createElement("p");
    cat.className = dark ? "tile-cat" : "prod-cat";
    cat.textContent = catLabel(p.cat);

    const name = document.createElement("h3");
    name.className = dark ? "tile-name" : "prod-name";
    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.dataset.detail = p.id;
    nameBtn.textContent = p.name;
    name.appendChild(nameBtn);

    const foot = document.createElement("div");
    foot.className = dark ? "tile-foot" : "prod-foot";
    const price = document.createElement("div");
    price.className = dark ? "tile-price" : "prod-price";
    const small = document.createElement("small");
    small.textContent = "USD";
    price.appendChild(small);
    price.appendChild(document.createTextNode(formatUSD(p.price)));

    const add = document.createElement("button");
    add.className = "add-btn";
    add.type = "button";
    add.dataset.add = p.id;
    add.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg> Agregar`;

    foot.append(price, add);
    body.append(cat, name, foot);
    card.append(media, body);
    return card;
  }

  /* ---------- Coreografía: escalonar reveals en grupos ---------- */

  function initStagger() {
    // Cualquier contenedor con 3+ hijos directos .reveal se revela en cascada.
    $$("section, div, ul").forEach((group) => {
      const kids = Array.from(group.children).filter((c) =>
        c.classList.contains("reveal")
      );
      if (kids.length < 3) return;
      kids.forEach((el, i) => {
        el.style.setProperty("--d", Math.min(i * 0.07, 0.42) + "s");
      });
    });
  }

  /* ---------- Animaciones de aparición ---------- */

  let revealObserver = null;

  function initReveals() {
    const els = $$(".reveal:not(.in), .statement:not(.in), .hero-script:not(.in)");
    if (REDUCED) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              revealObserver.unobserve(e.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
      );
    }
    els.forEach((el) => revealObserver.observe(el));
    collectScrollReveals();
  }

  /* ---------- Aparición conducida por el scroll ----------
     Antes cada `.reveal` era una transición CSS de duración fija que se
     disparaba al entrar en pantalla: alargarla no la hacía "durar más
     mientras scrolleas", sólo la hacía tardar más en aparecer, y si bajabas
     rápido te la perdías entera.

     Aquí el progreso NO depende del reloj sino de dónde está la pieza en la
     pantalla: `--rv` va de 0 a 1 mientras su borde superior recorre el tramo
     entre el 94% y el 60% del alto del viewport. La animación avanza a tu
     ritmo, se puede parar a medias y retroceder; nunca "se pasa rápido" ni
     te deja esperando delante de un hueco en blanco.

     `opacity` y `translate` quedan FUERA de la lista de `transition` (ver
     el bloque V51 del CSS) para que sigan a `--rv` fotograma a fotograma;
     `transform` se reserva para el hover, que conserva su curva de 0.72s. */

  const REVEAL_START = 0.94; // el borde superior entra por aquí (× alto de pantalla)
  const REVEAL_END = 0.6;    // y aquí la pieza ya está totalmente asentada
  let scrollRevealItems = [];
  let scrollRevealActive = [];
  let scrollRevealFrame = null;
  let scrollRevealOn = false;
  let scrollRevealObserver = null;
  const scrollRevealActiveSet = new Set();
  // Medidas y valores de la pasada anterior. Se reaprovechan los mismos arrays
  // para no generar basura en cada frame del ticker.
  const scrollRevealTops = [];
  const scrollRevealValues = new WeakMap();
  let lastRevealScroll = -1;
  let lastRevealVh = -1;
  let lastRevealDoc = -1;

  function collectScrollReveals() {
    if (!scrollRevealOn) return;
    scrollRevealItems = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      scrollRevealActive = scrollRevealItems;
      return;
    }

    if (!scrollRevealObserver) {
      // Sólo las piezas que pueden aparecer durante el siguiente gesto se
      // miden por frame. En portada evita leer el layout de todas las tarjetas
      // y secciones, incluso cuando están varios pantallazos lejos.
      scrollRevealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) scrollRevealActiveSet.add(entry.target);
            else scrollRevealActiveSet.delete(entry.target);
          });
          scrollRevealActive = Array.from(scrollRevealActiveSet);
          lastRevealScroll = -1;
          queueScrollReveals();
        },
        { rootMargin: "55% 0px 55% 0px" }
      );
    }

    scrollRevealObserver.disconnect();
    scrollRevealActiveSet.clear();
    scrollRevealActive = [];
    scrollRevealItems.forEach((item) => scrollRevealObserver.observe(item));
  }

  /* Esto corre en CADA frame del ticker de GSAP, así que el coste se nota. Tres
     detalles evitan que el navegador rehaga el layout una vez por pieza:
     - si la página está quieta y el documento mide lo mismo, ninguna medida
       puede haber cambiado y el frame se salta entero;
     - primero se mide todo y sólo después se escribe (alternarlo obligaba a un
       recálculo síncrono en cada vuelta del bucle);
     - no se reescribe un valor idéntico al anterior, que invalidaría el estilo
       sin mover un solo píxel.
     Los valores de `--rv` y el momento en que se aplican son los mismos: la
     animación no cambia, sólo el trabajo que cuesta pintarla. */
  function paintScrollReveals(options) {
    scrollRevealFrame = null;
    // GSAP y requestAnimationFrame pasan su tiempo actual como argumento. Sólo
    // el arranque pide explícitamente la pasada completa; de otro modo ese
    // número convertiría por accidente todos los reveals en activos.
    const forceAll = options === true;
    const items = forceAll ? scrollRevealItems : scrollRevealActive;
    const total = items.length;
    if (!total) return;

    const vh = window.innerHeight || 1;
    const y = window.scrollY;
    const doc = docHeight();
    if (y === lastRevealScroll && vh === lastRevealVh && doc === lastRevealDoc) return;
    lastRevealScroll = y;
    lastRevealVh = vh;
    lastRevealDoc = doc;

    const from = vh * REVEAL_START;
    const span = vh * (REVEAL_START - REVEAL_END) || 1;

    // 1. Sólo medidas.
    for (let i = 0; i < total; i++) {
      const rect = items[i].getBoundingClientRect();
      // Fuera de pantalla con margen: no se toca. Lo que ya pasó conserva su
      // último valor (1) y lo que aún no llega se queda sin `--rv`, o sea en 0.
      scrollRevealTops[i] =
        rect.bottom < -240 || rect.top > vh + 240 ? null : rect.top;
    }

    // 2. Sólo escrituras.
    for (let i = 0; i < total; i++) {
      const top = scrollRevealTops[i];
      if (top === null) continue;
      const el = items[i];
      let p = (from - top) / span;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      const value = p.toFixed(4);
      if (scrollRevealValues.get(el) !== value) {
        scrollRevealValues.set(el, value);
        el.style.setProperty("--rv", value);
      }
      // `.in` sigue gobernando los acentos que se dibujan una vez (la línea
      // del kicker, el subrayado del titular). Se enciende en cuanto la pieza
      // asoma, para que vayan en el mismo gesto y no con dos tiempos.
      if (p > 0 && !el.classList.contains("in")) el.classList.add("in");
    }
  }

  // Repintado forzado: lo usan los eventos que sí pueden mover las piezas sin
  // que cambie el scroll (redimensionar, `load`, rehacer la lista).
  function repaintScrollReveals() {
    lastRevealScroll = -1;
    paintScrollReveals();
  }

  function queueScrollReveals() {
    if (scrollRevealFrame) return;
    scrollRevealFrame = requestAnimationFrame(paintScrollReveals);
  }

  function initScrollReveals() {
    if (REDUCED || LOW_POWER_DEVICE) return;
    scrollRevealOn = true;
    collectScrollReveals();
    if (!scrollRevealItems.length) {
      scrollRevealOn = false;
      return;
    }
    // Se pinta ANTES de declarar el modo: si algo fallara aquí, la clase no
    // llega a ponerse y el sitio se queda con las transiciones de siempre en
    // vez de con todo invisible esperando un `--rv` que nadie escribe.
    paintScrollReveals(true);
    document.documentElement.classList.add("rh-scroll-reveal");

    // El scroll suave lo mueve Lenis dentro del ticker de GSAP: engancharse
    // ahí da un valor por fotograma ya sincronizado. Sin GSAP se cae al
    // evento de scroll con rAF, que es el patrón del resto del archivo.
    if (window.gsap && window.gsap.ticker) {
      window.gsap.ticker.add(paintScrollReveals);
    } else {
      window.addEventListener("scroll", queueScrollReveals, { passive: true });
    }
    window.addEventListener("resize", repaintScrollReveals, { passive: true });
    window.addEventListener("load", repaintScrollReveals);
  }

  function unobserveReveals(container) {
    if (!revealObserver || !container) return;
    $$(".reveal", container).forEach((el) => revealObserver.unobserve(el));
  }

  /* ---------- Titular de portada ---------- */

  function initStatement() {
    $$(".statement").forEach((statement) => {
      $$(".w", statement).forEach((word, index) => {
        word.style.setProperty("--wd", (0.08 + index * 0.055).toFixed(3) + "s");
      });
    });
  }

  /* ---------- Profundidad editorial ---------- */

  function initParallax() {
    if (REDUCED || LOW_POWER_DEVICE) return;
    const elements = $$("[data-plx]");
    if (elements.length === 0) return;
    let ticking = false;
    // El factor no cambia nunca: se resuelve una vez y no en cada frame.
    const factors = elements.map(
      (element) => Number.parseFloat(element.dataset.plx) || 0.2
    );
    const centers = [];
    const values = [];

    // Igual que en los reveals: medir todo, escribir después. El navegador
    // maqueta una vez por frame en lugar de una vez por elemento.
    function update() {
      const viewportHeight = window.innerHeight;
      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        centers[i] =
          rect.bottom < -120 || rect.top > viewportHeight + 120
            ? null
            : rect.top + rect.height / 2;
      }
      for (let i = 0; i < elements.length; i++) {
        const center = centers[i];
        if (center === null) continue;
        const progress = (center - viewportHeight / 2) / viewportHeight;
        const value = (progress * factors[i] * -38).toFixed(1) + "px";
        if (values[i] === value) continue;
        values[i] = value;
        elements[i].style.setProperty("--plx-y", value);
      }
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ---------- Tilt del producto protagonista (botón accionable) ---------- */

  function initTilt() {
    if (REDUCED) return;
    $$("[data-tilt]").forEach((element) => {
      let frame = null;
      element.addEventListener("pointermove", (event) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          element.style.transform =
            "perspective(1200px) rotateX(" + (-y * 4).toFixed(2) +
            "deg) rotateY(" + (x * 5.5).toFixed(2) +
            "deg) translateY(-4px)";
          frame = null;
        });
      });
      element.addEventListener("pointerleave", () => {
        element.style.transform = "";
      });
    });
  }

  /* ---------- Apertura cinematográfica (una vez por sesión) ---------- */

  function initLoader() {
    const loader = document.getElementById("rh-loader");
    if (!loader) return;
    const KEY = "rh_start_lights_seen_v2";
    const forcePreview = new URLSearchParams(window.location.search).get("intro") === "1";
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      /* sessionStorage no disponible */
    }
    if ((seen && !forcePreview) || REDUCED) {
      document.body.classList.add("rh-intro-complete");
      loader.classList.add("done");
      loader.remove();
      return;
    }
    document.documentElement.classList.add("rh-intro-lock");
    document.body.classList.add("rh-intro-running");
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignora */
    }

    /* Las tres fases van encadenadas al final REAL de la coreografía, no a un
       reloj aparte. Antes eran `setTimeout(1820/2480/3200)` contados desde
       `DOMContentLoaded`, mientras las animaciones CSS corrían desde el primer
       pintado: dos relojes distintos que se separaban tanto como tardase el
       arranque. Medido en móvil, entre el final del semáforo y el relevo
       quedaba medio segundo largo de pantalla negra sin nada; y como el hueco
       depende de la red y del equipo, en un móvil lento crecía sin tope.

       Aquí el relevo arranca cuando la marca termina su salida — la última
       pieza en moverse — y cada fase dura exactamente lo que declara el CSS,
       leído del CSS. Los dos relojes ya no pueden separarse porque ahora sólo hay uno. */

    const mark = loader.querySelector(".rh-start-mark");

    const toMs = (value) => {
      const part = String(value || "").trim();
      const n = parseFloat(part) || 0;
      return /ms$/.test(part) ? n : n * 1000;
    };

    // Duración declarada en CSS de una transición, para no repetir el número
    // aquí y que un retoque de diseño deje la mitad del relevo desincronizada.
    const transitionMs = (el, pseudo) => {
      const cs = window.getComputedStyle(el, pseudo || null);
      return String(cs.transitionDuration || "0s")
        .split(",")
        .reduce((max, part) => Math.max(max, toMs(part)), 0);
    };

    // Lo que le queda por delante a la coreografía, preguntado a las propias
    // animaciones. Si el hilo principal se atasca y la línea de tiempo se
    // retrasa, este número crece solo: el relevo espera en vez de cortar.
    const choreographyLeft = () => {
      if (!mark || !mark.getAnimations) return 2200;
      let left = 0;
      for (const animation of mark.getAnimations()) {
        const timing = animation.effect && animation.effect.getComputedTiming
          ? animation.effect.getComputedTiming()
          : null;
        if (!timing || timing.endTime == null) continue;
        left = Math.max(left, timing.endTime - (animation.currentTime || 0));
      }
      return left;
    };

    let phase = 0;
    let guard = null;
    const at = (ms, fn) => {
      window.clearTimeout(guard);
      guard = window.setTimeout(fn, Math.max(0, ms));
    };

    const complete = () => {
      if (phase > 2) return;
      phase = 3;
      window.clearTimeout(guard);
      document.documentElement.classList.remove("rh-intro-lock");
      document.body.classList.remove("rh-intro-running", "rh-intro-reveal", "rh-intro-release");
      document.body.classList.add("rh-intro-complete");
      loader.remove();
      runMotionLayer();
    };

    const release = () => {
      if (phase > 1) return;
      phase = 2;
      // Una sola clase, puesta una vez y nunca retirada: es lo que dispara la
      // entrada del hero (capa V61 del CSS). Va en `<html>` a propósito, para
      // que las clases de fase que entran y salen de `<body>` no puedan volver
      // a resolver —y por tanto reiniciar— la entrada a mitad de camino.
      document.documentElement.classList.add("rh-hero-in");
      document.body.classList.add("rh-intro-release");
      at(transitionMs(loader) + 60, complete);
    };

    const handoff = () => {
      if (phase > 0) return;
      phase = 1;
      // El negro entra por encima de la escena. A partir de aquí no se ve nada
      // de lo que pase debajo, así que es el hueco donde montar la capa de
      // movimiento: su reflow queda tapado y el hero aparece ya asentado.
      document.body.classList.add("rh-intro-reveal");
      const blackout = transitionMs(loader, "::before");
      const blackoutStart = performance.now();
      // Un frame de margen para que el fundido llegue al compositor antes de
      // que el hilo principal se ocupe: así el negro entra aunque el montaje
      // de las escenas tarde.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          runMotionLayer();
          // La cortina no se levanta hasta que las escenas están montadas y
          // medidas. Si el montaje termina antes de que el negro acabe de
          // entrar, se espera a que acabe; si tarda más, se sigue en cuanto
          // pueda. En los dos casos el hero aparece ya compuesto, sin que nada
          // se recoloque a la vista.
          const left = blackout - (performance.now() - blackoutStart);
          at(Math.max(80, left), release);
        });
      });
      at(blackout + 900, release);
    };

    if (mark) {
      mark.addEventListener("animationend", (event) => {
        if (/launch/i.test(event.animationName)) handoff();
      });
    }
    // Respaldo: si el nombre de la animación cambia o el evento no llega, el
    // relevo se dispara igualmente en cuanto la coreografía debería haber
    // terminado. Y un tope duro para que la apertura no pueda quedarse colgada.
    at(choreographyLeft() + 260, handoff);
    window.setTimeout(complete, 7000);
  }

  /* ---------- Cuándo se monta la capa de movimiento ----------
     `initLando`, `initLandoExperience` e `initReferenceParityMotion` son con
     diferencia lo más caro del arranque: 349 ms de los 467 que ocupa entero el
     `DOMContentLoaded` (medido con CPU ×4 sobre un viewport de teléfono).

     Ese bloque caía justo encima de los primeros fotogramas de la apertura, y
     ahí está el fallo de raíz: mientras el hilo principal está ocupado el
     navegador no pinta NADA, y la línea de tiempo que gobierna las animaciones
     CSS sólo avanza cuando hay fotograma. Medido con `getAnimations()`, el
     semáforo seguía marcando `currentTime = 0` casi 700 ms después de haber
     arrancado: no iba lento, estaba congelado. Al descongelarse, las cinco
     luces aparecían ya encendidas de golpe y la secuencia escalonada se perdía
     entera. No era cuestión de qué propiedad se anima, sino de que no había
     fotogramas donde animarla.

     Mientras la apertura corre, la página está bloqueada (`rh-intro-lock`) y
     estas tres funciones sólo sirven al scroll, así que no hacen falta todavía.
     Se montan al retirarse la cortina, con la maquetación ya asentada — que
     además es el momento correcto para medirla. Si no hay apertura (visita
     repetida, movimiento reducido) el orden es exactamente el de siempre. */
  let motionLayerStarted = false;

  function runMotionLayer() {
    if (motionLayerStarted) return;
    motionLayerStarted = true;
    initLando();
    initLandoExperience();
    initReferenceParityMotion();
  }

  function startMotionLayer() {
    if (!document.body.classList.contains("rh-intro-running")) {
      runMotionLayer();
      return;
    }
    // Red de seguridad: si la apertura no llegara a cerrarse, el sitio no puede
    // quedarse sin scroll suave ni sin sus escenas.
    window.setTimeout(runMotionLayer, 5000);
  }

  /* ---------- (Retirado) Magnetic hover en CTAs primarios ----------
     El seguimiento del cursor competía con el lift/press del hover y hacía que
     los botones "siguieran" el puntero de forma inconsistente. El hover/press
     ahora es puramente CSS, unificado y limpio (bloque BOTONES v9). */
  function initMagnetic() {}

  /* ---------- Enlaces de contacto dinámicos ---------- */

  function wireContactLinks() {
    $$("[data-wa-link]").forEach((a) => {
      const msg =
        a.dataset.waLink ||
        "¡Hola Racing Hobbies! Quiero más información sobre sus productos.";
      a.href = waLink(msg);
    });
    $$("[data-tel-link]").forEach((a) => {
      a.href = "tel:" + RH_CONFIG.phoneIntl;
      if (!a.textContent.trim()) a.textContent = RH_CONFIG.phoneDisplay;
    });
    $$("[data-year]").forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------- Estado del local en tiempo real (zona de Quito) ---------- */

  function initStoreStatus() {
    const targets = $$("[data-store-status]");
    if (targets.length === 0) return;

    const schedule = {
      1: { open: "10:00", close: "14:00" },
      2: { open: "09:30", close: "18:30" },
      3: { open: "09:30", close: "18:30" },
      4: { open: "09:30", close: "18:30" },
      5: { open: "09:30", close: "18:30" },
      6: { open: "09:30", close: "16:30" },
    };
    const weekdayIndex = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guayaquil",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    const toMinutes = (value) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };

    function update() {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
      );
      const day = weekdayIndex[parts.weekday];
      const now = Number(parts.hour) * 60 + Number(parts.minute);
      const today = schedule[day];
      const isOpen =
        today && now >= toMinutes(today.open) && now < toMinutes(today.close);

      let label;
      if (isOpen) {
        label = "Abierto — Cierra a las " + today.close;
      } else {
        let nextOpening = null;
        for (let offset = 0; offset < 7; offset += 1) {
          const nextDay = (day + offset) % 7;
          if (schedule[nextDay]) {
            if (offset > 0 || now < toMinutes(schedule[nextDay].open)) {
              nextOpening = schedule[nextDay].open;
              break;
            }
          }
        }
        label = nextOpening ? "Cerrado — Abre a las " + nextOpening : "Cerrado";
      }

      targets.forEach((target) => {
        target.textContent = label;
        target.classList.toggle("is-open", Boolean(isOpen));
        target.classList.toggle("is-closed", !isOpen);
      });
    }

    update();
    window.setInterval(update, 60 * 1000);
  }

  /* ---------- Mapa bajo demanda: evita conexiones externas anticipadas ---------- */

  function initMapConsent() {
    $$("[data-map-consent]").forEach((host) => {
      const button = $("[data-load-map]", host);
      const consent = $(".map-consent", host);
      if (!button || !consent) return;

      button.addEventListener("click", () => {
        const scrollPosition = { x: window.scrollX, y: window.scrollY };
        button.disabled = true;
        button.textContent = "Cargando mapa…";

        const frame = document.createElement("iframe");
        frame.title = "Ubicación de Racing Hobbies en Quito";
        frame.src =
          "https://www.google.com/maps?q=Racing%20Hobbies%2C%20Av.%20Eloy%20Alfaro%20N40-413%20y%20Granados%2C%20Quito%2C%20Ecuador&output=embed";
        frame.loading = "eager";
        frame.referrerPolicy = "no-referrer";
        // Marco de terceros: solo lo mínimo para que el mapa funcione. Sin
        // navegación superior, popups, descargas ni formularios, el mapa no
        // puede secuestrar la pestaña ni convertir el consentimiento en una
        // vía de salida.
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
        frame.setAttribute("allow", "fullscreen");
        frame.addEventListener("load", () => {
          host.classList.add("map-loaded");
          showToast("Mapa listo. Te esperamos en Quito 🏁");
        }, { once: true });

        host.insertBefore(frame, consent);
        consent.remove();
        // Evita que el anclaje automático del navegador salte al desaparecer
        // el botón que tenía el foco.
        requestAnimationFrame(() => {
          window.scrollTo(scrollPosition.x, scrollPosition.y);
        });
      }, { once: true });
    });
  }

  /* ---------- Atmósfera de circuito y líneas de meta por sección ---------- */

  function initRacingAtmosphere() {
    const main = $("main");
    if (!main) return;

    // Normaliza los separadores históricos y genera una línea de meta en cada
    // cambio de sector. Así cualquier sección futura queda cubierta también.
    Array.from(main.children)
      .filter((child) =>
        child.classList.contains("checkers") ||
        child.classList.contains("race-divider")
      )
      .forEach((divider) => divider.remove());

    const sections = Array.from(main.children).filter(
      (child) => child.tagName === "SECTION"
    );

    const createFinishLine = () => {
      const divider = document.createElement("div");
      divider.className = "race-divider race-divider-full";
      divider.setAttribute("aria-hidden", "true");
      divider.append(
        document.createElement("span"),
        document.createElement("i")
      );
      return divider;
    };

    sections.forEach((section, index) => {
      section.classList.add("race-sector");
      section.dataset.raceSector = String(index + 1).padStart(2, "0");

      if (index > 0) {
        main.insertBefore(createFinishLine(), section);
      }

      if (!$(".race-atmosphere", section)) {
        const atmosphere = document.createElement("div");
        atmosphere.className = "race-atmosphere";
        atmosphere.setAttribute("aria-hidden", "true");
        section.prepend(atmosphere);
      }

    });

    if (sections.length > 0) {
      main.appendChild(createFinishLine());
    }

    initAtmosphereLoading(sections);

    if (REDUCED || !("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("race-sector-live"));
    } else {
      const sectorObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("race-sector-live");
            }
          });
        },
        { threshold: 0.12, rootMargin: "-8% 0px -8% 0px" }
      );
      sections.forEach((section) => sectorObserver.observe(section));
    }

    if (REDUCED || !window.matchMedia("(pointer:fine)").matches) return;
    let pointerFrame = null;
    let pendingPointer = null;
    document.addEventListener("pointermove", (event) => {
      pendingPointer = event;
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        const target = pendingPointer.target.closest(
          ".prod-card, .tile, .collage-item:not(.static-story-visual), .deck-card"
        );
        if (target) {
          const rect = target.getBoundingClientRect();
          const x = ((pendingPointer.clientX - rect.left) / rect.width) * 100;
          const y = ((pendingPointer.clientY - rect.top) / rect.height) * 100;
          target.style.setProperty("--race-x", x.toFixed(1) + "%");
          target.style.setProperty("--race-y", y.toFixed(1) + "%");
        }
        pointerFrame = null;
      });
    }, { passive: true });
  }

  /* ---------- Carga asíncrona de imágenes ----------
     Los fondos de atmósfera son CSS (`background-image`), y el navegador no
     les aplica lazy loading: sin esto la portada descarga ~870 KB de textura
     en el primer paint y compite con el héroe. Aquí cada sector espera a
     acercarse al viewport, precarga su arte fuera del hilo principal y sólo
     entonces recibe la clase que activa el fondo en CSS. */

  const SAVE_DATA = (() => {
    const c = navigator.connection;
    if (!c) return false;
    return Boolean(c.saveData) || /^(slow-)?2g$/.test(c.effectiveType || "");
  })();

  // Debe invocarse con `window` como receptor: desligada, Chrome la rechaza
  // con "Illegal invocation".
  const idle = window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn)
    : (fn) => window.setTimeout(fn, 200);

  // Descarga una imagen a la caché del navegador sin tocar el DOM. Resuelve al
  // dispararse `load`: no se usa img.decode() porque en una imagen que no está
  // insertada en el documento Chrome deja esa promesa pendiente para siempre y
  // el precargado no terminaría nunca.
  const imageCache = new Map();

  function preloadImage(src) {
    if (!src) return Promise.reject(new Error("sin src"));
    const cached = imageCache.get(src);
    if (cached) return cached;

    const task = new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener("load", () => resolve(img), { once: true });
      img.addEventListener("error", () => reject(new Error(src)), { once: true });
      img.src = src;
    });

    imageCache.set(src, task);
    task.catch(() => imageCache.delete(src));
    return task;
  }

  // Cola con concurrencia limitada: dos descargas a la vez dejan ancho de banda
  // libre para el producto visible en lugar de saturar la conexión.
  const preloadQueue = [];
  let preloadActive = 0;

  function queuePreload(src) {
    return new Promise((resolve, reject) => {
      preloadQueue.push({ src, resolve, reject });
      drainPreloadQueue();
    });
  }

  function drainPreloadQueue() {
    while (preloadActive < 2 && preloadQueue.length) {
      const job = preloadQueue.shift();
      preloadActive += 1;
      const release = () => {
        preloadActive -= 1;
        drainPreloadQueue();
      };
      preloadImage(job.src).then(
        (img) => { release(); job.resolve(img); },
        (err) => { release(); job.reject(err); }
      );
    }
  }

  // Extrae la URL de `--sector-art` / `--section-art`, declaradas en el CSS
  // como `url("../assets/…")` y por tanto relativas a la carpeta css/.
  function sectorArtURL(section) {
    const style = getComputedStyle(section);
    const raw =
      style.getPropertyValue("--sector-art") ||
      style.getPropertyValue("--section-art");
    const match = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(raw.trim());
    if (!match) return "";
    try {
      return new URL(match[1], new URL("css/", document.baseURI)).href;
    } catch {
      return "";
    }
  }

  function initAtmosphereLoading(sections) {
    // Con ahorro de datos la atmósfera es puro adorno: se omite y cada sección
    // se queda con su degradado.
    if (SAVE_DATA) return;

    const activate = (section) => {
      const src = sectorArtURL(section);
      if (!src) return;
      queuePreload(src).then(
        () => section.classList.add("atmo-on"),
        () => section.classList.add("atmo-failed")
      );
    };

    if (!("IntersectionObserver" in window)) {
      idle(() => sections.forEach(activate));
      return;
    }

    // El primer sector siempre está sobre el pliegue: esperar al observador
    // sólo le añadiría latencia.
    const [first, ...rest] = sections;
    if (first) activate(first);

    // 800 px de margen: el arte termina de descargar antes de que la sección
    // entre en pantalla, así que nunca se ve aparecer a medias.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          activate(entry.target);
        });
      },
      { rootMargin: "800px 0px" }
    );
    rest.forEach((section) => observer.observe(section));
  }

  // Las <img> del catálogo se insertan por JS y aparecen de golpe al terminar
  // de bajar. Este marcado permite que CSS las funda al entrar y que un fallo
  // de red no deje el icono de imagen rota.
  function trackImage(img) {
    if (img.dataset.asyncImg) return;
    img.dataset.asyncImg = "1";
    if (!img.getAttribute("decoding")) img.decoding = "async";

    // Lo ya pintado (héroe, logotipo) se deja en paz: fundirlo retrasaría el
    // LCP y provocaría un parpadeo en el primer frame. Tampoco se deduce un
    // fallo de `complete && !naturalWidth`: al reevaluar un srcset la imagen
    // pasa por ese estado un instante aunque esté perfectamente sana.
    if (img.complete) return;

    img.classList.add("img-fade");
    img.addEventListener(
      "load",
      () => {
        img.classList.remove("img-failed");
        img.classList.add("img-ready");
      },
      { once: true }
    );
    img.addEventListener("error", () => {
      // Si ya hay píxeles, el error es el descarte de un candidato del srcset,
      // no una imagen caída.
      if (img.naturalWidth > 0) return;
      // Un srcset roto no debe tumbar la imagen: se reintenta con el `src` base
      // antes de rendirse.
      if (img.srcset) {
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        return;
      }
      img.classList.add("img-failed");
    });
  }

  function initAsyncImages() {
    $$("img").forEach(trackImage);

    // El catálogo, el carrito y el modal insertan <img> después del arranque.
    if (!("MutationObserver" in window)) return;

    /* Escanear el subárbol de cada nodo insertado sale caro: al partir los
       titulares se añaden miles de <span>, y cada uno disparaba su propio
       recorrido. En vez de eso se agrupa toda la ráfaga en una única pasada
       por frame sobre las imágenes aún sin marcar. */
    let scanFrame = null;
    const scanSoon = () => {
      if (scanFrame) return;
      scanFrame = requestAnimationFrame(() => {
        scanFrame = null;
        $$("img:not([data-async-img])").forEach(trackImage);
      });
    };

    new MutationObserver(scanSoon).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /* ---------- Header ---------- */

  function initHeader() {
    const header = $(".site-header");
    const backTop = $("#rh-back-top");
    if (header) {
      let headerFrame = null;
      const onScroll = () => {
        if (headerFrame) return;
        headerFrame = requestAnimationFrame(() => {
          header.classList.toggle("scrolled", window.scrollY > 12);
          if (backTop) {
            backTop.classList.toggle("is-visible", window.scrollY > 720);
          }
          const max = scrollRange();
          const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
          header.style.setProperty("--scroll-progress", String(progress));
          headerFrame = null;
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    if (backTop) {
      backTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
      });
    }

    const menuBtn = $(".menu-btn");
    const nav = $(".main-nav");
    if (!menuBtn || !nav) return;

    const sourceLinks = $$("a", nav);
    const panel = document.createElement("aside");
    panel.className = "rh-nav-panel";
    panel.id = "rh-nav-panel";
    // Aunque visualmente es un panel de navegación, mientras está abierto
    // se comporta como una capa modal: así los lectores de pantalla anuncian
    // el cambio de contexto y el foco no se escapa al contenido de la página.
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("aria-label", "Navegación principal");

    const gallery = document.createElement("div");
    gallery.className = "rh-nav-gallery";
    // Previews editoriales: cada imagen representa la sección que activa.
    // Se mantienen en WebP reducido para que el panel siga abriendo rápido.
    const navShots = [
    ["assets/img/menu-catalog.webp?v=4", "Selección de modelos RC de catálogo"],
    ["assets/img/menu-service.webp?v=4", "Técnico ajustando el chasis de un auto RC"],
    ["assets/img/menu-about.webp?v=8", "Rincón del taller de Racing Hobbies con autos RC y logo de la marca"],
    ["assets/img/menu-contact.webp?v=4", "Cliente contactando a Racing Hobbies desde su teléfono"],
    ];
    navShots.forEach(([src, alt], index) => {
      const shot = document.createElement("div");
      shot.className = "rh-nav-shot";
      shot.dataset.navPreview = String(index);
      const img = document.createElement("img");
      img.dataset.src = src;
      img.alt = alt;
      img.width = 640;
      img.height = 800;
      img.loading = "lazy";
      img.decoding = "async";
      shot.appendChild(img);
      gallery.appendChild(shot);
    });

    // El panel está fuera de pantalla pero maquetado, y ahí `loading="lazy"`
    // no salva nada: el navegador bajaba las cuatro fotos —240 KB— durante la
    // carga inicial aunque nadie llegara a abrir el menú. Nacen sin `src` y se
    // piden al primer gesto de intención sobre el botón, con los 460 ms de la
    // apertura por delante para taparlas. Abrir el menú las pide también, por
    // si no hubo gesto previo o si el ahorro de datos frenó el adelanto.
    const navShotImages = $$("img", gallery);
    let navShotsWarmed = false;
    const warmNavShots = () => {
      if (navShotsWarmed) return;
      navShotsWarmed = true;
      navShotImages.forEach((img) => {
        const src = img.dataset.src;
        if (!src) return;
        delete img.dataset.src;
        // `trackImage` ya la marcó cuando todavía no tenía origen, y con una
        // imagen vacía se dio por completa. Se le quita la marca para que al
        // asignar el origen recupere su fundido de entrada.
        delete img.dataset.asyncImg;
        // Nació diferida para que el navegador no la pidiera durante la carga.
        // Ahora la queremos ya: dentro de un panel fuera de pantalla, una
        // imagen `lazy` no se descarga por mucho que reciba un origen.
        img.loading = "eager";
        img.src = src;
        trackImage(img);
      });
    };
    const warmNavShotsAhead = () => {
      if (!SAVE_DATA) warmNavShots();
    };
    menuBtn.addEventListener("pointerenter", warmNavShotsAhead, { once: true });
    menuBtn.addEventListener("pointerdown", warmNavShotsAhead, { once: true });
    menuBtn.addEventListener("focus", warmNavShotsAhead, { once: true });

    const content = document.createElement("div");
    content.className = "rh-nav-content";
    const eyebrow = document.createElement("p");
    eyebrow.className = "rh-nav-eyebrow";
    eyebrow.innerHTML = "<span>Racing Hobbies</span><span> - </span><span>Quito, EC</span>";
    const links = document.createElement("nav");
    links.className = "rh-nav-links";
    links.setAttribute("aria-label", "Páginas");

    sourceLinks.forEach((source, index) => {
      const link = document.createElement("a");
      const label = source.textContent.trim();
      link.className = "rh-nav-link";
      link.href = source.href;
      link.dataset.navPreview = index === 0 ? "all" : String((index - 1) % 4);
      link.style.setProperty("--nav-i", String(index));
      if (source.hasAttribute("aria-current")) {
        link.setAttribute("aria-current", "page");
      }
      const span = document.createElement("span");
      span.dataset.label = label;
      span.textContent = label;
      link.appendChild(span);
      links.appendChild(link);
    });

    const meta = document.createElement("div");
    meta.className = "rh-nav-meta";
    meta.innerHTML =
      '<a href="https://www.instagram.com/racinghobbies/" target="_blank" rel="noopener noreferrer">Instagram</a>' +
      '<a href="https://www.tiktok.com/@racinghobbies" target="_blank" rel="noopener noreferrer">TikTok</a>' +
      '<a data-wa-link href="https://wa.me/593989019836" target="_blank" rel="noopener noreferrer">WhatsApp</a>';

    content.append(eyebrow, links, meta);
    panel.append(gallery, content);
    document.body.appendChild(panel);
    menuBtn.setAttribute("aria-controls", panel.id);

    const panelLinks = $$("a", panel);
    const routeLinks = $$(".rh-nav-link", panel);
    const previewShots = $$(".rh-nav-shot", panel);
    const setPreview = (value) => {
      panel.dataset.preview = value;
      previewShots.forEach((shot) => {
        const active = value === "all" || shot.dataset.navPreview === value;
        shot.classList.toggle("is-active", active);
        shot.classList.toggle("is-muted", !active);
      });
    };
    const clearPreview = () => setPreview("all");

    routeLinks.forEach((link) => {
      const activate = () => setPreview(link.dataset.navPreview || "all");
      link.addEventListener("pointerenter", activate);
      link.addEventListener("focus", activate);
    });
    content.addEventListener("pointerleave", clearPreview);

    const closeMenu = (restoreFocus) => {
      if (!panel.classList.contains("is-open")) return;
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Abrir menú");
      document.body.classList.remove("menu-open");
      syncPageScrollLock();
      clearPreview();
      if (restoreFocus) menuBtn.focus();
    };

    // El panel de navegación cubre toda la pantalla. Si se abre el carrito
    // desde allí, primero se retira el panel para no dejar dos capas activas
    // ni devolver foco a un control que quedó detrás del diálogo.
    const cartButton = $("[data-open-cart]");
    if (cartButton) {
      cartButton.addEventListener("click", () => closeMenu(false));
    }

    const openMenu = () => {
      warmNavShots();
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      menuBtn.setAttribute("aria-expanded", "true");
      menuBtn.setAttribute("aria-label", "Cerrar menú");
      document.body.classList.add("menu-open");
      syncPageScrollLock();
      clearPreview();
      window.setTimeout(() => {
        const current = $('[aria-current="page"]', panel) || panelLinks[0];
        if (current) current.focus({ preventScroll: true });
      }, REDUCED ? 0 : 460);
    };

    menuBtn.addEventListener("click", () => {
      if (panel.classList.contains("is-open")) closeMenu(false);
      else openMenu();
    });
    panel.addEventListener("click", (e) => {
      if (e.target.closest("a")) closeMenu(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu(true);
      if (e.key !== "Tab" || !panel.classList.contains("is-open")) return;
      // El botón visible de cerrar forma parte del recorrido. Antes el foco
      // saltaba entre enlaces y para cerrar con teclado había que conocer ESC.
      const visible = [menuBtn, ...panelLinks.filter((link) => link.offsetParent !== null)];
      if (!visible.length) return;
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

  }

  /* ---------- Adelanto de la siguiente página ----------
     Al cambiar de página, CSS y JS ya están en caché: lo único que se espera es
     el documento. Cuando el puntero se posa sobre un enlace interno se pide por
     adelantado y con prioridad baja, así el clic lo encuentra descargado y la
     cortina de transición no acaba tapando una pantalla en blanco. No cambia
     nada de lo que se ve ni de lo que se anima. */
  function initRoutePrefetch() {
    if (SAVE_DATA) return;
    const probe = document.createElement("link");
    if (!probe.relList || !probe.relList.supports || !probe.relList.supports("prefetch")) {
      return;
    }

    // Una sola petición por página de destino, y un tope por si alguien pasea
    // el puntero por todo el pie.
    const asked = new Set([window.location.pathname]);
    let budget = 5;

    const consider = (target) => {
      if (budget <= 0) return;
      const link = target && target.closest ? target.closest("a[href]") : null;
      if (!link || link.target || link.hasAttribute("download")) return;
      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== "/" && !/\.html$/.test(url.pathname)) return;
      if (asked.has(url.pathname)) return;
      asked.add(url.pathname);
      budget -= 1;
      const hint = document.createElement("link");
      hint.rel = "prefetch";
      hint.href = url.origin + url.pathname + url.search;
      document.head.appendChild(hint);
    };

    document.addEventListener("pointerover", (event) => consider(event.target), { passive: true });
    document.addEventListener("touchstart", (event) => consider(event.target), { passive: true });
    document.addEventListener("focusin", (event) => consider(event.target));
  }

  /* ---------- "Inicio" cuando ya estás en Inicio ----------
     En la portada el enlace de Inicio apunta a `index.html`, que es la URL que
     el navegador ya tiene abierta. Ir a una URL idéntica no es cambiar de
     página: Safari de iOS lo resuelve como una recarga y, al recargar, devuelve
     el scroll al punto donde estabas. De ahí que pulsar "Inicio" en el menú del
     celular te dejara en el manifiesto ("Encuentra tu modelo ideal") en lugar
     del hero. Aquí no se navega: se sube al principio, que es lo que significa
     esa pulsación, y así el resultado no depende de lo que cada navegador
     decida restituir.

     `/` e `/index.html` son la misma página aunque el enlace escriba una y la
     barra de direcciones muestre la otra, por eso se comparan normalizadas.

     Escucha en captura para adelantarse a la cortina de transición —que se
     retira sola al ver `defaultPrevented`— y el desplazamiento se aplaza un
     frame: el panel móvil se cierra en el mismo clic y al soltar el bloqueo de
     fondo restituye la posición guardada, que si no llegaría después y ganaría. */
  function samePagePath(url) {
    return url.pathname.replace(/(^|\/)index\.html$/, "$1");
  }

  function initSamePageLinks() {
    document.addEventListener(
      "click",
      (event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) return;
        const target = event.target;
        const link = target && target.closest ? target.closest("a[href]") : null;
        if (!link || link.target || link.hasAttribute("download")) return;
        let url;
        try {
          url = new URL(link.href, window.location.href);
        } catch {
          return;
        }
        // Los anclas (`#seccion`) tienen su propio camino y su propio destino.
        if (url.hash) return;
        if (
          url.origin !== window.location.origin ||
          url.search !== window.location.search ||
          samePagePath(url) !== samePagePath(window.location)
        ) return;
        event.preventDefault();
        // Con el menú abierto la pantalla está cubierta: el salto seco imita el
        // cambio de página. Sin él, el recorrido suave mantiene la referencia.
        const instant = REDUCED || document.body.classList.contains("menu-open");
        requestAnimationFrame(() => {
          if (window.rhLenis) {
            window.rhLenis.scrollTo(
              0,
              instant ? { immediate: true, force: true } : { duration: 1.1, force: true }
            );
          } else {
            window.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
          }
        });
      },
      true
    );
  }

  function confirmAddButton(button) {
    if (!button) return;
    clearTimeout(Number(button.dataset.feedbackTimer));
    const original = button.dataset.originalMarkup || button.innerHTML;
    button.dataset.originalMarkup = original;
    button.classList.add("is-added");
    button.textContent = "Agregado ✓";
    const timer = window.setTimeout(() => {
      button.innerHTML = original;
      button.classList.remove("is-added");
      delete button.dataset.feedbackTimer;
    }, 1200);
    button.dataset.feedbackTimer = String(timer);
  }

  /* ---------- Delegación global de eventos ---------- */

  function initEvents() {
    document.addEventListener("click", (e) => {
      const t = e.target;

      const openCartBtn = t.closest("[data-open-cart]");
      if (openCartBtn) {
        e.preventDefault();
        openCart();
        return;
      }
      if (t.closest("[data-close-cart]") || t.id === "rh-drawer-backdrop") {
        closeCart();
        return;
      }

      const addBtn = t.closest("[data-add]");
      if (addBtn) {
        addToCart(addBtn.dataset.add, 1);
        confirmAddButton(addBtn);
        return;
      }

      const detailBtn = t.closest("[data-detail]");
      if (detailBtn) {
        openProductModal(detailBtn.dataset.detail);
        return;
      }
      if (t.closest("[data-close-modal]") || t.id === "rh-modal-backdrop") {
        closeProductModal();
        return;
      }

      const qtyBtn = t.closest("[data-qty]");
      if (qtyBtn) {
        const it = cart.find((x) => x.id === qtyBtn.dataset.id);
        if (it) setQty(it.id, it.qty + Number(qtyBtn.dataset.qty));
        return;
      }

      const removeBtn = t.closest("[data-remove]");
      if (removeBtn) {
        removeFromCart(removeBtn.dataset.remove);
        return;
      }

      if (t.closest("[data-clear-cart]")) {
        clearCart();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeProductModal();
        closeCart();
        return;
      }
      if (e.key !== "Tab") return;
      const mobileNav = $(".main-nav");
      const menuBtn = $(".menu-btn");
      if (mobileNav && mobileNav.classList.contains("open") && menuBtn) {
        const links = $$("a", mobileNav);
        if (links.length === 0) return;
        const firstLink = links[0];
        const lastLink = links[links.length - 1];
        if (e.shiftKey && document.activeElement === firstLink) {
          e.preventDefault();
          menuBtn.focus();
        } else if (e.shiftKey && document.activeElement === menuBtn) {
          e.preventDefault();
          lastLink.focus();
        } else if (!e.shiftKey && document.activeElement === lastLink) {
          e.preventDefault();
          menuBtn.focus();
        } else if (!e.shiftKey && document.activeElement === menuBtn) {
          e.preventDefault();
          firstLink.focus();
        }
        return;
      }
      // Focus trap: mientras un diálogo esté abierto, Tab circula dentro de él.
      const drawer = $("#rh-cart-drawer");
      const modalBackdrop = $("#rh-modal-backdrop");
      const container =
        drawer && drawer.classList.contains("open")
          ? drawer
          : modalBackdrop && modalBackdrop.classList.contains("open")
            ? modalBackdrop
            : null;
      if (!container) return;
      const focusables = $$(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        container
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || !container.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ---------- Vitrina en la portada ---------- */

  function renderFeatured() {
    const grid = $("#featured-grid");
    if (!grid) return;
    // Cinco fichas, las mismas que categorías: con cuatro el carril horizontal
    // se quedaba corto y la sección caía a cuadrícula mientras la de al lado
    // seguía siendo galería.
    const featured = RH_PRODUCTS.filter((p) => p.tag === "top" || p.tag === "nuevo").slice(0, 5);
    featured.forEach((p, i) => grid.appendChild(productCard(p, i, "tile")));
  }

  /* ==========================================================================
     Sistema de movimiento tipo landonorris.com
     Lenis (scroll suave con su config EXACTA) + GSAP/ScrollTrigger para
     reveals por carácter, hover cinematográfico, marquee, sección horizontal
     y "conducción vertical" (pinned scrub). Todo degrada a estático sin JS o
     con prefers-reduced-motion (el CSS legacy queda como respaldo).
     ========================================================================== */

  // Parte un elemento en palabras/caracteres enmascarados preservando los
  // <span> internos (.accent, .w-ink…) y la accesibilidad (aria-label).
  function splitChars(el) {
    const original = el.textContent.replace(/\s+/g, " ").trim();
    el.setAttribute("aria-label", original);
    const chars = [];

    function wrapTextNode(node) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (part === "") return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(" "));
          return;
        }
        const word = document.createElement("span");
        word.className = "rh-word";
        for (const ch of part) {
          const mask = document.createElement("span");
          const normalized = Array.from(ch.normalize("NFD"));
          const baseChar = normalized[0] || ch;
          const combiningMarks = normalized.slice(1);
          const diacriticSymbols = {
            "\u0300": "`",
            "\u0301": "´",
            "\u0303": "˜",
            "\u0308": "¨",
            "\u0327": "¸",
          };
          const diacritic = combiningMarks.map((mark) => diacriticSymbols[mark] || mark).join("");
          const hasDiacritic = combiningMarks.length > 0;
          mask.className = `rh-cmask${hasDiacritic ? " rh-cmask-diacritic" : ""}`;
          if (hasDiacritic) mask.dataset.diacritic = diacritic;
          const inner = document.createElement("span");
          inner.className = "rh-char";
          inner.textContent = hasDiacritic ? baseChar : ch;
          mask.appendChild(inner);
          word.appendChild(mask);
          chars.push(inner);
        }
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    }

    (function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          if (child.textContent.trim() !== "") wrapTextNode(child);
        } else if (child.nodeType === 1) {
          child.setAttribute("aria-hidden", "true");
          walk(child);
        }
      });
    })(el);

    if (el.querySelector(".rh-cmask-diacritic")) {
      el.classList.add("rh-has-diacritic");
    }

    return chars;
  }

  /* Parte un elemento en palabras envueltas en <span>, conservando los nodos
     de elemento internos. Devuelve las palabras en orden de documento. */
  function splitWords(el) {
    const words = [];
    (function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          if (!child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (part === "") return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            const word = document.createElement("span");
            word.className = "rh-word";
            word.textContent = part;
            frag.appendChild(word);
            words.push(word);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    return words;
  }

  /* Agrupa palabras ya maquetadas en líneas visuales por su desplazamiento
     vertical. Es la base del barrido de resaltado, que actúa línea a línea. */
  function groupLines(words) {
    const lines = [];
    let top = null;
    words.forEach((word) => {
      const y = Math.round(word.offsetTop);
      if (top === null || Math.abs(y - top) > 4) {
        lines.push([]);
        top = y;
      }
      lines[lines.length - 1].push(word);
    });
    return lines.filter((line) => line.length);
  }

  function initLando() {
    if (REDUCED) return;
    document.documentElement.classList.add("lando-anim");

    const g = window.gsap;
    const ST = window.ScrollTrigger;
    if (g && ST) g.registerPlugin(ST);

    /* ==================================================================
       1. Reveal de imágenes por máscara
       ================================================================== */
    $$(
      ".collage-item, .deck-card, .feature-visual, .map-card, .prod-card, .tile"
    ).forEach((element, index) => {
      element.classList.add("rh-clip-reveal");
      element.style.setProperty("--clip-i", String(index % 6));
      element.style.setProperty("--clip-delay", ((index % 6) * 0.045).toFixed(3) + "s");
    });

    /* ==================================================================
       2. Reveal de titulares carácter a carácter, con máscara por letra
       ================================================================== */
    const heads = $$("[data-reveal-lines]");
    if (heads.length) {
      const io =
        "IntersectionObserver" in window
          ? new IntersectionObserver(
              (entries) => {
                entries.forEach((en) => {
                  if (en.isIntersecting) {
                    en.target.classList.add("rh-in");
                    io.unobserve(en.target);
                  }
                });
              },
              { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
            )
          : null;
      heads.forEach((el) => {
        const chars = splitChars(el);
        if (!chars.length) return;
        chars.forEach((c, i) => c.style.setProperty("--i", i));
        const reveal = () => el.classList.add("rh-in");
        if (!io) {
          reveal();
          return;
        }
        const rect = el.getBoundingClientRect();
        const inView = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
        // Arriba del pliegue se revela al cargar: el titular nunca se queda
        // atascado invisible si el observer tarda.
        if (inView) {
          // Con la apertura todavía tapando la escena, el titular se compone en
          // el acto y sin rodaje. Rodarlo detrás del negro no se vería, y en
          // cambio dejaría el hero a medio escribir en el momento exacto en que
          // se levanta la cortina: es el hueco por el que antes se colaba un
          // salto al final de la apertura.
          if (document.body.classList.contains("rh-intro-reveal")) {
            el.classList.add("rh-in", "rh-in-instant");
          } else {
            setTimeout(reveal, 60);
          }
        } else io.observe(el);
      });
    }

    /* ==================================================================
       3. Salvaguarda anti-blanco: nada visible puede quedar sin revelar
       ================================================================== */
    function revealVisible() {
      $$(".reveal:not(.in)").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in");
      });
    }
    window.addEventListener("load", () => setTimeout(revealVisible, 500));
    // IntersectionObserver hace el trabajo principal. Esta salvaguarda queda
    // limitada a una comprobación cada 140 ms para no forzar lecturas de layout
    // en cada frame del scroll suave.
    let revealFrame = null;
    let lastRevealCheck = 0;
    const queueRevealVisible = () => {
      if (revealFrame) return;
      revealFrame = requestAnimationFrame(() => {
        revealFrame = null;
        const now = performance.now();
        if (now - lastRevealCheck < 140) return;
        lastRevealCheck = now;
        revealVisible();
      });
    };
    window.addEventListener("scroll", queueRevealVisible, { passive: true });

    /* Las páginas internas comparten ahora el mismo pulso cinemático de la
       portada: controles, datos y campos entran individualmente en cascada,
       en lugar de aparecer como un bloque estático. */
    if (!document.body.classList.contains("page-home")) {
      const internalItems = $$([
        ".page-service .feature",
        ".page-service .step",
        ".page-about .step",
        ".page-about .collage-item",
        ".page-contact .field",
        ".page-contact .info-item",
        ".page-catalog .pit-band .btn",
      ].join(", "));

      internalItems.forEach((item, index) => {
        item.classList.add("rh-internal-item");
        item.style.setProperty("--rh-internal-i", String(index % 4));
      });

      if (!("IntersectionObserver" in window)) {
        internalItems.forEach((item) => item.classList.add("rh-internal-in"));
      } else {
        const internalObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("rh-internal-in");
              internalObserver.unobserve(entry.target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
        );
        internalItems.forEach((item) => internalObserver.observe(item));
      }
    }

    /* ==================================================================
       4. Hover letra a letra en botones y enlaces  [data-anim="text-hover"]
       El texto rueda hacia arriba mientras una copia idéntica entra desde
       abajo, con un desfase por letra. La copia accesible original queda
       como aria-label; las capas visuales van ocultas al lector.
       ================================================================== */
    function buildRoll(host) {
      const text = host.textContent.replace(/\s+/g, " ").trim();
      if (!text || text.length > 48) return null;
      host.setAttribute("aria-label", text);
      host.textContent = "";
      // El recorte va en una caja propia que ciñe al texto, NO en el <a>: los
      // enlaces llevan padding, así que recortar sobre ellos dejaría la capa
      // trasera visible dentro del hueco sobrante y el rótulo saldría doble.
      const box = document.createElement("span");
      box.className = "rh-roll";
      const layer = (cls) => {
        const wrap = document.createElement("span");
        wrap.className = "rh-roll-layer " + cls;
        wrap.setAttribute("aria-hidden", "true");
        for (const ch of text) {
          const span = document.createElement("span");
          span.className = "rh-roll-char";
          span.textContent = ch === " " ? " " : ch;
          wrap.appendChild(span);
        }
        return wrap;
      };
      const front = layer("is-front");
      const back = layer("is-back");
      box.appendChild(front);
      box.appendChild(back);
      host.appendChild(box);
      return {
        front: Array.from(front.children),
        back: Array.from(back.children),
      };
    }

    if (g && window.matchMedia("(pointer:fine)").matches) {
      $$('[data-anim="text-hover"]').forEach((host) => {
        const target = host.querySelector("[data-roll-text]") || host;
        const roll = buildRoll(target);
        if (!roll) return;
        const stagger = 0.014;
        g.set(roll.back, { yPercent: 105 });

        // Tweens sin estado en lugar de un timeline con play()/reverse(): con
        // `overwrite` cada gesto cancela el anterior, así que el rótulo no
        // puede quedarse a medio rodar si se entra y sale rápido o si el
        // navegador congela el ticker (pestaña en segundo plano) justo en
        // mitad de la animación.
        const roll2 = (frontY, backY) => {
          g.to(roll.front, {
            yPercent: frontY,
            duration: 0.42,
            ease: "power3.inOut",
            stagger,
            overwrite: true,
          });
          g.to(roll.back, {
            yPercent: backY,
            duration: 0.42,
            ease: "power3.inOut",
            stagger,
            overwrite: true,
          });
        };
        const enter = () => roll2(-105, 0);
        const leave = () => roll2(0, 105);

        host.addEventListener("pointerenter", enter);
        host.addEventListener("pointerleave", leave);
        host.addEventListener("pointercancel", leave);
        host.addEventListener("focus", enter);
        host.addEventListener("blur", leave);
      });
    }

    /* ==================================================================
       5. Barrido de resaltado  [data-anim-high="left|right"]
       Una barra de color cruza cada línea del texto y, justo cuando la
       cubre, la línea cambia al color de acento. Se recalcula al cambiar
       el ancho porque el reparto de líneas depende de la maquetación.
       ================================================================== */
    if (g && ST) {
      $$("[data-anim-high]").forEach((host) => {
        const source = host.innerHTML;
        let trigger = null;

        const build = () => {
          if (trigger) {
            trigger.kill();
            trigger = null;
          }
          host.innerHTML = source;
          host.classList.add("rh-high");
          const lines = groupLines(splitWords(host));
          if (!lines.length) return;

          // Cada línea pasa a ser un bloque propio con su barra: así la barra
          // mide exactamente el ancho del texto de esa línea, no del párrafo.
          const bars = lines.map((words) => {
            const line = document.createElement("span");
            line.className = "rh-high-line";
            words[0].parentNode.insertBefore(line, words[0]);
            words.forEach((word, i) => {
              if (i) line.appendChild(document.createTextNode(" "));
              line.appendChild(word);
            });
            const bar = document.createElement("span");
            bar.className = "rh-high-bar";
            bar.setAttribute("aria-hidden", "true");
            line.appendChild(bar);
            return { line, bar };
          });

          const dir = (host.dataset.animHigh || "right").trim().toLowerCase();
          const from = dir === "left" ? "right" : "left";
          const to = dir === "left" ? "left" : "right";

          const tl = g.timeline({
            scrollTrigger: {
              trigger: host,
              start: "top 82%",
              once: true,
            },
          });
          bars.forEach(({ line, bar }, i) => {
            const at = i * 0.09;
            tl.fromTo(
              bar,
              { scaleX: 0, transformOrigin: from + " center" },
              { scaleX: 1, duration: 0.42, ease: "power2.inOut" },
              at
            )
              .add(() => line.classList.add("is-lit"), at + 0.4)
              .set(bar, { transformOrigin: to + " center" }, at + 0.42)
              .to(bar, { scaleX: 0, duration: 0.42, ease: "power2.inOut" }, at + 0.42);
          });
          trigger = tl.scrollTrigger;
        };

        // El barrido hace cirugía sobre el DOM del titular: si algo falla en un
        // elemento concreto, se deja ese texto intacto en vez de tumbar el
        // resto del motor de animación.
        const safeBuild = () => {
          try {
            build();
          } catch (err) {
            host.innerHTML = source;
            if (window.console) console.warn("rh: barrido omitido", err);
          }
        };

        safeBuild();
        let resizeTimer = null;
        let lastWidth = window.innerWidth;
        window.addEventListener("resize", () => {
          if (window.innerWidth === lastWidth) return;
          lastWidth = window.innerWidth;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(safeBuild, 220);
        });
      });
    }

    /* ==================================================================
       6. Marquee acoplado al scroll  [data-marquee]
       Avanza solo a velocidad constante, acelera con la inercia del scroll
       e invierte el sentido cuando se sube. Duplica su contenido hasta
       cubrir dos veces el ancho de pantalla para que el bucle no tenga
       costuras visibles.
       ================================================================== */
    $$("[data-marquee]").forEach((host) => {
      const track = host.querySelector("[data-marquee-track]");
      if (!track) return;
      const base = Number(host.dataset.marqueeSpeed || 40); // px/s
      const dirAttr = host.dataset.marqueeDirection === "right" ? 1 : -1;

      const original = track.innerHTML;
      let unit = track.scrollWidth;
      if (!unit) return;
      let copies = 1;
      while (unit * copies < window.innerWidth * 2 && copies < 12) copies += 1;
      track.innerHTML = original.repeat(copies + 1);
      // `original` se captura DESPUÉS de que `trackImage` haya marcado las
      // imágenes, así que el HTML duplicado ya trae `class="img-fade"` (opacidad
      // 0) y `data-async-img="1"`. Los nodos nuevos no heredan el listener de
      // `load`, y el observador los descarta por ese atributo: el carrusel de
      // marcas se quedaba invisible en todos los formatos. Se limpian las marcas
      // y se vuelven a adoptar.
      track.querySelectorAll("img").forEach((img) => {
        img.classList.remove("img-fade", "img-ready", "img-failed");
        delete img.dataset.asyncImg;
        trackImage(img);
      });
      unit = track.scrollWidth / (copies + 1);

      let x = 0;
      let boost = 0; // px/s añadidos por la inercia del scroll
      let last = performance.now();
      let frame = null;

      const step = (now) => {
        const dt = Math.min(64, now - last) / 1000;
        last = now;
        // El texto avanza constantemente hacia adelante, sin decaimiento
        // Un tramo puede medir 0 si las imágenes `lazy` todavía no han
        // maquetado cuando arranca el motor. Con `unit` a 0 el módulo da NaN,
        // el navegador descarta el translate y el marquee queda parado para
        // siempre: por eso se remide hasta obtener un ancho válido.
        if (!(unit > 0)) {
          unit = track.scrollWidth / (copies + 1);
          frame = requestAnimationFrame(step);
          return;
        }
        // Mantiene el movimiento lento y evita que el impulso del scroll se acumule.
        boost *= Math.exp(-1.4 * dt);
        x += (base * dirAttr + boost) * dt;
        // Se mantiene dentro de un tramo para que el bucle no tenga costura.
        x = (((x % unit) + unit) % unit) - unit;
        track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
        frame = requestAnimationFrame(step);
      };

      /* Fuera de pantalla el marquee escribía igualmente un transform por
         frame, para siempre. Pararlo mientras no se ve no cambia nada
         observable: la tira es un bucle sin costura, así que su fase no es
         perceptible, y al volver retoma exactamente en la misma `x`.
         `last` se reinicia al arrancar para que el tiempo en pausa no entre
         en `dt` y provoque un salto. `boost` se pone a cero porque el
         original, corriendo con `exp(-1.4·dt)`, ya lo habría amortiguado a
         ~0 tras un segundo fuera de vista. */
      const startMarquee = () => {
        if (frame) return;
        last = performance.now();
        frame = requestAnimationFrame(step);
      };
      const stopMarquee = () => {
        if (!frame) return;
        cancelAnimationFrame(frame);
        frame = null;
        boost = 0;
      };

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) =>
              entry.isIntersecting ? startMarquee() : stopMarquee()
            );
          },
          { rootMargin: "200px 0px" }
        ).observe(host);
      } else {
        startMarquee();
      }

      let lastScroll = window.scrollY;
      window.addEventListener("scroll", () => {
        const delta = window.scrollY - lastScroll;
        lastScroll = window.scrollY;
        // En pausa no se acumula impulso: si no, al reaparecer arrancaría
        // disparado con el `boost` sumado durante todo el recorrido.
        if (!frame) return;
        // Solo acelera hacia adelante, nunca invierte la dirección
        if (delta > 0) {
        boost = Math.max(-150, Math.min(150, boost + delta * 2.5 * dirAttr));
        }
      }, { passive: true });
    });

    /* ==================================================================
       7. Hero fijado: el hero se queda quieto mientras su contenido se aleja
       y se desvanece, y la seccion siguiente entra por encima. Con
       `pinSpacing:false` no se anade recorrido extra, asi que el scroll
       total de la pagina no cambia. En todos los anchos.
       ================================================================== */
    if (g && ST) {
      const hero = $(".hero");
      const heroInner = hero && $(".container", hero);
      const heroArt = hero && $(".hero-machine", hero);
      if (hero && heroInner) {
        const heroTl = g.timeline({
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: true,
            pin: true,
            pinSpacing: false,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        heroTl.fromTo(
          heroInner,
          { yPercent: 0, scale: 1, opacity: 1 },
          {
            yPercent: -14,
            scale: 0.94,
            opacity: 0,
            ease: "none",
            immediateRender: false,
          },
          0
        );
        if (heroArt) {
          // El arte se aleja mas despacio: da profundidad entre las dos capas.
          heroTl.fromTo(
          heroArt,
            { x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1, opacity: 1 },
            {
              x: 0,
              y: 0,
              xPercent: 0,
              yPercent: -7,
              scale: 1.06,
              opacity: 0,
              ease: "none",
              immediateRender: false,
            },
            0
          );
        }
      }
    }

    /* ==================================================================
       9. Hover cinematográfico en tarjetas que sí usan tilt
       Las tarjetas de categorías conservan únicamente el barrido de luz.
       ================================================================== */
    if (window.matchMedia("(pointer:fine)").matches) {
      $$(".collage-item, .deck-card").forEach((card) => {
        if (card.closest(".editorial-garage")) return;
        const img = card.querySelector("img");
        let frame = null;
        let pending = null;
        card.addEventListener("pointermove", (e) => {
          pending = e;
          if (frame) return;
          frame = requestAnimationFrame(() => {
            const r = card.getBoundingClientRect();
            const x = (pending.clientX - r.left) / r.width - 0.5;
            const y = (pending.clientY - r.top) / r.height - 0.5;
            card.style.transform =
              "perspective(900px) rotateX(" + (-y * 4).toFixed(2) +
              "deg) rotateY(" + (x * 4).toFixed(2) + "deg)";
            if (img) img.style.transform = "scale(1.05)";
            frame = null;
          });
        });
        card.addEventListener("pointerleave", () => {
          card.style.transform = "";
          if (img) img.style.transform = "";
        });
      });
    }

    /* ==================================================================
       10. Galerías laterales  [data-lando-horizontal]
       La sección se fija y su fila avanza en horizontal mientras haces
       scroll normal. Cada tarjeta crece al acercarse al centro y se
       encoge al salir, con la foto en parallax dentro de su marco.
       Se aplica en todos los anchos: móvil y tablet reciben la misma escena
       fijada que escritorio, con las tarjetas dimensionadas en vw.
       ================================================================== */
    if (g && ST) {
      $$("[data-lando-horizontal]").forEach((sec) => {
        try {
          buildHorizontalRail(sec);
        } catch (err) {
          // Una galería que falle no puede llevarse por delante el resto de la
          // capa de movimiento (la otra galería, el riel de scroll, la cortina
          // de navegación): se degrada a cuadrícula y se sigue.
          sec.removeAttribute("data-lando-horizontal");
          const orphanBar = sec.querySelector(".rh-hbar");
          if (orphanBar) orphanBar.remove();
          console.error("Galería horizontal no inicializada:", sec.className, err);
        }
      });

      function buildHorizontalRail(sec) {
        const track = sec.querySelector("[data-lando-htrack]");
        const cards = track
          ? Array.from(track.children).filter((n) => n.nodeType === 1)
          : [];
        if (!track || cards.length < 2) {
          sec.removeAttribute("data-lando-horizontal");
          return;
        }
        document.documentElement.classList.add("lando-hscroll");

        // Cada tarjeta recibe un envoltorio propio y su número: los `.reveal`
        // del sitio llevan `transform: none !important`, que anularía la
        // animación de profundidad si se aplicara a la tarjeta directamente.
        cards.forEach((card, i) => {
          card.classList.add("rh-hcard");
          const inner = document.createElement("span");
          inner.className = "rh-card";
          while (card.firstChild) inner.appendChild(card.firstChild);
          const num = document.createElement("span");
          num.className = "rh-card-num";
          num.setAttribute("aria-hidden", "true");
          num.textContent = String(i + 1).padStart(2, "0");
          inner.insertBefore(num, inner.firstChild);
          card.appendChild(inner);
        });

        // Barra de progreso de la galería. Cuelga del `.container`, no de la
        // sección: así comparte el mismo carril que el titular y las tarjetas
        // en vez de arrancar 60px más a la izquierda.
        const bar = document.createElement("div");
        bar.className = "rh-hbar";
        bar.setAttribute("aria-hidden", "true");
        bar.innerHTML = '<span class="rh-hbar-fill"></span>';
        (sec.querySelector(":scope > .container") || sec).appendChild(bar);
        const fill = bar.firstElementChild;

        // Margen de salida proporcional: 120px sobre un viewport ancho, pero en
        // un móvil de 390px esa cifra fija se comía un tercio de la pantalla y
        // la última tarjeta quedaba a media altura al final del recorrido.
        const tailGap = () => Math.min(120, Math.round(window.innerWidth * 0.1));
        const distance = () =>
          Math.max(0, track.scrollWidth - window.innerWidth + tailGap());
        if (distance() < 300) {
          // Sin recorrido no hay progreso que mostrar: la barra se quedaría
          // fija en cero bajo una fila estática.
          bar.remove();
          sec.removeAttribute("data-lando-horizontal");
          return;
        }

        // Recorrido más largo que la distancia: cada píxel lateral cuesta más
        // scroll, así el desplazamiento se siente amplio y cinematográfico.
        // En móvil ese 1.4 no compensa: la sección fijada ya vale una pantalla
        // entera, y con el multiplicador el carril pedía casi dos pantallas de
        // scroll para pasar cinco fichas. A 1 cada píxel lateral cuesta uno
        // vertical, que se lee como un gesto directo y acorta la escena.
        const travelFactor = () => (window.innerWidth <= 899 ? 1 : 1.4);
        const scrollTween = g.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: sec,
            start: "top top",
            end: () => "+=" + distance() * travelFactor(),
            scrub: true,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              fill.style.transform = "scaleX(" + self.progress.toFixed(4) + ")";
            },
            // La barra vive en el `.container`, que es mucho más alto que la
            // pantalla fijada, así que al soltarse el pin se quedaba colgada
            // sola en una franja vacía: una raya verde bajo el logo sin nada
            // alrededor. Sólo debe existir mientras su carril está activo.
            onToggle: (self) => {
              sec.classList.toggle("rh-rail-live", self.isActive);
            },
          },
        });

        cards.forEach((card) => {
          const inner = card.querySelector(".rh-card");
          const img = card.querySelector("img");
          const tl = g.timeline({
            scrollTrigger: {
              trigger: card,
              containerAnimation: scrollTween,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          });
          tl.fromTo(
            inner,
            { scale: 0.86, yPercent: 7, opacity: 0.4 },
            { scale: 1, yPercent: 0, opacity: 1, ease: "power2.out", duration: 1 }
          ).to(inner, {
            scale: 0.86,
            yPercent: 7,
            opacity: 0.4,
            ease: "power2.in",
            duration: 1,
          });
          if (img && !document.body.classList.contains("page-home")) {
            tl.fromTo(img, { xPercent: -11 }, { xPercent: 11, ease: "none", duration: 2 }, 0);
          }
        });
      }
    }

    /* Abanico social elástico: estas tarjetas conservan su movimiento propio
       al pasar el puntero, mientras el resto de cajas usa sólo el destello. */
    const fan = $(".social-fan");
    if (fan && window.matchMedia("(pointer:fine)").matches) {
      const cards = $$(".deck-card", fan);
      fan.classList.add("rh-fan-live");
      const resetFan = () => {
        cards.forEach((card, index) => {
          g.to(card, {
            "--fan-push": "0px",
            "--fan-lift": "0px",
            "--fan-pop": "0",
            duration: 0.78,
            delay: Math.abs(index - (cards.length - 1) / 2) * 0.012,
            ease: "elastic.out(1, 0.72)",
            overwrite: "auto",
          });
          card.classList.remove("is-fan-focus");
        });
      };
      cards.forEach((card, activeIndex) => {
        const focus = () => {
          cards.forEach((candidate, index) => {
            const distance = Math.abs(index - activeIndex);
            const direction = index < activeIndex ? -1 : index > activeIndex ? 1 : 0;
            const push = direction * Math.max(0, 54 - distance * 9);
            g.to(candidate, {
              "--fan-push": push.toFixed(1) + "px",
              "--fan-lift": index === activeIndex ? "-18px" : "0px",
              "--fan-pop": index === activeIndex ? "0.055" : "0",
              duration: 0.62,
              delay: distance * 0.018,
              ease: "elastic.out(1, 0.72)",
              overwrite: "auto",
            });
            candidate.classList.toggle("is-fan-focus", index === activeIndex);
          });
        };
        card.addEventListener("pointerenter", focus);
        card.addEventListener("focus", focus);
        card.addEventListener("blur", resetFan);
      });
      fan.addEventListener("pointerleave", resetFan);
    }

  }

  /* ---------- Experiencia cinematográfica global ---------- */

  function initLandoExperience() {
    const routeCurtain = document.createElement("div");
    routeCurtain.className = "rh-route-curtain";
    routeCurtain.setAttribute("aria-hidden", "true");
    routeCurtain.innerHTML =
      '<span class="rh-route-mark"><img src="assets/img/logo-mark-360.webp?v=2" alt="" width="360" height="186"></span>' +
      '<span class="rh-route-label">Cargando</span>';
    document.body.appendChild(routeCurtain);
    document.body.classList.add("rh-route-enabled");
    const routeLabel = $(".rh-route-label", routeCurtain);

    const rail = document.createElement("div");
    rail.className = "rh-scroll-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.innerHTML = "<span></span>";
    document.body.appendChild(rail);
    // La hoja actual oculta este raíl. No mantenemos un listener de scroll ni
    // una lectura de altura para actualizar algo que no llega a pintarse.
    if (getComputedStyle(rail).display === "none") {
      rail.remove();
    } else {
      const railFill = rail.firstElementChild;
      const updateRail = () => {
        const max = scrollRange();
        const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        railFill.style.transform = "scaleY(" + progress.toFixed(4) + ")";
      };
      let railFrame = null;
      const queueRail = () => {
        if (railFrame) return;
        railFrame = requestAnimationFrame(() => {
          railFrame = null;
          updateRail();
        });
      };
      window.addEventListener("scroll", queueRail, { passive: true });
      window.addEventListener("resize", queueRail, { passive: true });
      updateRail();
    }

    // Cortina entre páginas internas. Se ignoran enlaces externos, descargas,
    // anclas, controles con JS y clics con teclas modificadoras.
    //
    // La cortina NO debe convertirse en una espera: es una capa que se pinta
    // encima de la página que sale MIENTRAS el documento nuevo viaja, no un
    // trámite previo a pedirlo. Por eso aquí no se llama a `preventDefault()`
    // ni se aplaza la navegación: el clic sigue su curso nativo y el navegador
    // empieza a descargar en el mismo tick en que se enciende la cortina.
    //
    // Las dos versiones anteriores retenían el clic y disparaban la navegación
    // desde un reloj — `setTimeout(680)` primero, `requestAnimationFrame`
    // después. La primera sumaba 680 ms a cada cambio de página; la segunda
    // quitaba ese retardo pero heredaba el mismo defecto de fondo: con la
    // pestaña en segundo plano el navegador estrangula los timers y congela
    // por completo el rAF, así que si cambiabas de app justo después de pulsar
    // volvías a un "Cargando" clavado que no navegaba. Sin reloj de por medio
    // no hay nada que estrangular.
    let routeNavigationPending = false;
    document.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      const link = event.target.closest("a[href]");
      if (
        !link ||
        link.target ||
        link.hasAttribute("download") ||
        link.dataset.waLink !== undefined
      ) return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash
      ) return;
      if (routeNavigationPending) return;
      routeNavigationPending = true;
      const x = event.clientX || window.innerWidth / 2;
      const y = event.clientY || window.innerHeight / 2;
      routeCurtain.style.setProperty("--route-x", x + "px");
      routeCurtain.style.setProperty("--route-y", y + "px");
      if (routeLabel) {
        routeLabel.textContent =
          (link.textContent || link.getAttribute("aria-label") || "Cargando")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 42);
      }
      routeCurtain.classList.add("is-active");
      document.body.classList.add("rh-page-exit");
      // Sin `preventDefault`: a partir de aquí navega el propio enlace.
    });
    window.addEventListener("pageshow", () => {
      routeNavigationPending = false;
      document.body.classList.remove("rh-page-exit");
      routeCurtain.classList.remove("is-active");
    });

    // Scroll suave con Lenis, la misma base que usa landonorris.com. Sustituye
    // al hijacker de rueda anterior: Lenis interpola la posición real de scroll
    // en lugar de cancelar el evento, así el trackpad conserva su inercia y la
    // barra nativa sigue funcionando. ScrollTrigger se sincroniza con su tick
    // para que las escenas con `scrub` vayan en el mismo frame, sin doble retraso.
    if (!REDUCED && window.Lenis) {
      const lenis = new window.Lenis({
        // Conserva la cola de scroll intencional, pero con menos frames de
        // retraso para que el movimiento se sienta más directo.
        lerp: 0.14,
        wheelMultiplier: 1,
        syncTouch: true,
        touchMultiplier: 1.25,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
      window.rhLenis = lenis;
      document.documentElement.classList.add("rh-smooth");

      // Pausa real en escenas grandes: cuando el borde inferior de una sección
      // llega al borde inferior del viewport, Lenis se detiene 250 ms.
      // No se aplica a la primera escena al cargar ni a bandas compactas.
      const pauseSectionSelector = [
        ".hero",
        "body:not(.page-home) .page-hero",
        "main > .ln-manifesto",
        "main > .editorial-garage",
        "main > .feature-hero",
        "main > .home-showcase",
        "main > .community-section",
        "main > .home-location",
        "main > .service-catalog-section",
        "main > .service-process-section",
        "main > .service-cta-section",
        "main > .about-story-section",
        "main > .about-values-section",
        "main > .about-vision-section",
        "main > .contact-form-section",
        "main > .legal-section",
      ].join(",");
      let hasScrollIntent = false;
      let sectionPauseActive = false;
      const sectionPauseArmed = new WeakMap();
      const sectionPreviousEdges = new WeakMap();

      const markScrollIntent = () => {
        hasScrollIntent = true;
      };

      // `pauseAtSectionEdge` corre en cada frame del scroll suave. Resolver ahí
      // un selector de catorce partes, y preguntar `matches` sección por
      // sección, era el gasto más caro del recorrido. La lista y sus dos rasgos
      // fijos se calculan una vez y se rehacen sólo si `main` cambia de hijos.
      let pauseSections = null;
      const readPauseSections = () => {
        if (!pauseSections) {
          pauseSections = $$(pauseSectionSelector).map((section) => ({
            el: section,
            isHero: section.matches(".hero, .page-hero"),
            isManifesto: section.matches(".ln-manifesto"),
          }));
        }
        return pauseSections;
      };
      const mainRegion = $("main");
      if (mainRegion && "MutationObserver" in window) {
        new MutationObserver(() => {
          pauseSections = null;
        }).observe(mainRegion, { childList: true });
      }

      const pauseAtSectionEdge = (instance) => {
        const current = instance.scroll;
        const viewportHeight = window.innerHeight;
        const edgeTolerance = Math.min(42, viewportHeight * 0.05);
        const sections = readPauseSections();

        if (instance.direction <= 0) {
          for (let index = 0; index < sections.length; index += 1) {
            const entry = sections[index];
            if (index === 0 && entry.isHero) continue;
            if (entry.el.getBoundingClientRect().bottom - viewportHeight > edgeTolerance) {
              sectionPauseArmed.set(entry.el, true);
            }
          }
          return;
        }

        if (!hasScrollIntent || sectionPauseActive) return;

        for (let index = 0; index < sections.length; index += 1) {
          const entry = sections[index];
          const section = entry.el;
          const rect = section.getBoundingClientRect();
          const armed = sectionPauseArmed.get(section) ?? index > 0;
          const edgeDistance = rect.bottom - viewportHeight;
          const previousEdge = sectionPreviousEdges.get(section);
          sectionPreviousEdges.set(section, edgeDistance);
          const crossedViewportEdge = previousEdge > 0 && edgeDistance <= 0;
          // El manifiesto usa un escenario sticky: si esperamos al píxel exacto
          // del borde, el sticky empieza a liberarse y el texto sube antes de
          // que llegue la pausa. Lo detenemos unos píxeles antes para mantener
          // la composición fija y que la lectura sea limpia.
          const pauseLead = entry.isManifesto ? 32 : 0;
          const isNearViewportEdge = edgeDistance <= pauseLead && edgeDistance >= -edgeTolerance;

          if (edgeDistance > edgeTolerance) {
            sectionPauseArmed.set(section, armed || index > 0);
          }

          // La primera escena ya está detenida al cargar la página. Las demás
          // se detienen cuando su borde inferior llega al borde inferior visible.
          if (
            entry.isHero ||
            !armed ||
            (!crossedViewportEdge && !isNearViewportEdge)
          ) continue;

          const target = Math.max(0, current + edgeDistance - pauseLead);
          hasScrollIntent = false;
          sectionPauseArmed.set(section, false);
          sectionPauseActive = true;
          lenis.scrollTo(target, { immediate: true });
          lenis.stop();

          window.setTimeout(() => {
            sectionPauseActive = false;
            lenis.start();
          }, 250);
          break;
        }
      };

      window.addEventListener("wheel", markScrollIntent, { passive: true });
      window.addEventListener("touchstart", markScrollIntent, { passive: true });
      window.addEventListener("touchmove", markScrollIntent, { passive: true });
      lenis.on("scroll", pauseAtSectionEdge);

      // El menú y el carrito bloquean el scroll de la página mientras están
      // abiertos; Lenis debe pararse o seguiría moviendo el fondo.
      const syncLock = () => {
        const locked =
          document.body.classList.contains("menu-open") ||
          document.body.classList.contains("cart-open") ||
          document.body.classList.contains("overlay-open");
        if (locked) lenis.stop();
        else lenis.start();
      };
      new MutationObserver(syncLock).observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });

      if (window.gsap && window.ScrollTrigger) {
        lenis.on("scroll", window.ScrollTrigger.update);
        window.gsap.ticker.add((time) => lenis.raf(time * 1000));
        // Evita que un frame perdido provoque un salto brusco al recuperarse.
        window.gsap.ticker.lagSmoothing(500, 33);
      } else {
        const raf = (time) => {
          lenis.raf(time);
          requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
      }

      // Los anclas internos usan el mismo motor: un salto suave y consistente.
      document.addEventListener("click", (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;
        const id = link.getAttribute("href");
        if (!id || id === "#") return;
        const target = document.querySelector(id);
        if (!target) return;
        event.preventDefault();
        lenis.scrollTo(target, { offset: -90, duration: 1.2 });
      });
    }

    const g = window.gsap;
    const ST = window.ScrollTrigger;
    if (REDUCED || !g || !ST) return;
    g.registerPlugin(ST);

    const manifesto = $(".ln-manifesto");
    if (manifesto) {
      const lines = $$(".ln-manifesto-copy > span", manifesto);
      const blocks = $$(".ln-wipe-grid > span", manifesto);
      const copies = $$(".ln-manifesto-copy", manifesto);
      const stage = $(".ln-manifesto-stage", manifesto);

      // El escenario es sticky por CSS: se clava cuando su borde superior toca
      // el del viewport y se suelta en cuanto agota el hueco que le deja la
      // sección. La escena tiene que vivir EXACTAMENTE en ese tramo. Medirla
      // sobre la sección entera dejaba fuera el relleno superior e inferior
      // (110 px cada uno), y en esos últimos píxeles el escenario ya subía
      // mientras la animación seguía creyéndose clavada: de ahí el salto hacia
      // arriba del texto justo antes de salir.
      const stickyTravel = () => {
        const cs = getComputedStyle(manifesto);
        return Math.max(
          1,
          manifesto.offsetHeight -
            parseFloat(cs.paddingTop) -
            parseFloat(cs.paddingBottom) -
            (stage ? stage.offsetHeight : 0)
        );
      };

      const timeline = g.timeline({
        scrollTrigger: {
          trigger: stage || manifesto,
          start: "top top",
          end: () => "+=" + stickyTravel(),
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      // Deriva continua: las dos copias bajan a ritmo constante de punta a
      // punta de la escena, así no hay ni un frame en que el texto se pare.
      // Antes se asentaba al 36% del recorrido y se quedaba congelado los
      // 600 px de scroll siguientes.
      if (copies.length) {
        timeline.fromTo(
          copies,
          { yPercent: -2 },
          { yPercent: 8, ease: "none", duration: 2.16 },
          0
        );
      }

      // Encima de esa deriva, cada línea entra un poco por arriba y BAJA hasta
      // asentarse en su sitio.
      // El índice se toma dentro de su propio párrafo: hay dos copias
      // superpuestas (la base y la blanca) y deben moverse a la vez, o se ve
      // el texto duplicado.
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
      blocks.forEach((block, index) => {
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

      // El mensaje termina su recorrido descendente y permanece visible y
      // quieto durante toda la pausa final. No hay fade ni animación de salida.
      if (copies.length) {
        timeline.to({}, { duration: 8 }, 9);
      }
    }

    const heroStage = $(".hero-machine-stage");
    if (heroStage) {
      g.to(heroStage, {
        yPercent: 17,
        rotate: 2,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }

    // Entrada de escenas: una sola coreografía compartida en todas las páginas.
    $$("main > section:not(.hero):not(.ln-manifesto)").forEach((section) => {
      const title = $(".sec-title, h1, h2", section);
      if (!title || title.hasAttribute("data-reveal-lines")) return;
      g.fromTo(
        title,
        { yPercent: 22, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.05,
          ease: "expo.out",
          scrollTrigger: {
            trigger: section,
            start: "top 82%",
            once: true,
          },
        }
      );
    });

    window.addEventListener("load", () => ST.refresh());
  }

  /* ---------- Paridad de movimiento con la referencia ---------- */

  function initReferenceParityMotion() {
    const g = window.gsap;
    const ST = window.ScrollTrigger;

    /* Indicador de scroll flotante: aparece durante el gesto, representa tanto
       el tamaño del viewport como la posición y vuelve a desaparecer al parar. */
    const indicator = document.createElement("div");
    indicator.className = "rh-motion-scroll-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.innerHTML = "<span></span>";
    document.body.appendChild(indicator);
    // Igual que el raíl lateral: su CSS lo desactiva en el diseño final. Al
    // retirarlo evitamos cálculos y timers en cada desplazamiento.
    if (getComputedStyle(indicator).display === "none") {
      indicator.remove();
    } else {
      const thumb = indicator.firstElementChild;
      let indicatorTimer = null;
      let indicatorFrame = null;

      const paintIndicator = (show) => {
        const max = Math.max(1, scrollRange());
        const ratio = Math.min(0.28, Math.max(0.11, window.innerHeight / docHeight()));
        const progress = Math.min(1, Math.max(0, window.scrollY / max));
        const travel = indicator.clientHeight * (1 - ratio);
        indicator.style.setProperty("--rh-thumb-size", (ratio * 100).toFixed(3) + "%");
        thumb.style.transform =
          "translate3d(0," + (progress * travel).toFixed(2) + "px,0)";
        if (show) {
          indicator.classList.add("is-scrolling");
          clearTimeout(indicatorTimer);
          indicatorTimer = window.setTimeout(
            () => indicator.classList.remove("is-scrolling"),
            620
          );
        }
        indicatorFrame = null;
      };

      const queueIndicator = () => {
        if (indicatorFrame) return;
        indicatorFrame = requestAnimationFrame(() => paintIndicator(true));
      };
      window.addEventListener("scroll", queueIndicator, { passive: true });
      window.addEventListener("resize", () => paintIndicator(false), { passive: true });
      paintIndicator(false);
    }

    /* La cabecera cambia de lenguaje cromático al cruzar sectores claros o de
       acento, como la navegación sensible al tema de la referencia. */
    const header = $(".site-header");
    const themedSections = $$("main > section");
    if (header && themedSections.length) {
      const accentSelectors = [
        ".brands-strip",
        ".home-location",
        ".page-hero",
        ".community-section",
      ];
      let themeFrame = null;
      const updateHeaderTheme = () => {
        const probe = Math.min(window.innerHeight * 0.18, 118);
        const current =
          themedSections.find((section) => {
            const rect = section.getBoundingClientRect();
            return rect.top <= probe && rect.bottom > probe;
          }) || themedSections[0];
        const accent = accentSelectors.some((selector) => current.matches(selector));
        header.classList.toggle("rh-theme-accent", accent);
        header.dataset.motionSector = current.dataset.raceSector || "00";
        themeFrame = null;
      };
      const queueTheme = () => {
        if (themeFrame) return;
        themeFrame = requestAnimationFrame(updateHeaderTheme);
      };
      window.addEventListener("scroll", queueTheme, { passive: true });
      window.addEventListener("resize", queueTheme, { passive: true });
      updateHeaderTheme();
    }

    /* Contadores numéricos: el dato se arma desde cero al entrar, sin alterar
       sufijos como “+”. */
    $$(".hero-proof strong").forEach((counter) => {
      const match = counter.textContent.trim().match(/^(\d+)(.*)$/);
      if (!match) return;
      const target = Number(match[1]);
      const suffix = match[2];
      counter.dataset.counterTarget = String(target);
      counter.dataset.counterSuffix = suffix;
      counter.textContent = "0" + suffix;
      const run = () => {
        if (counter.dataset.counterDone === "1") return;
        counter.dataset.counterDone = "1";
        if (REDUCED || !g) {
          counter.textContent = target + suffix;
          return;
        }
        const state = { value: 0 };
        g.to(state, {
          value: target,
          duration: 1.15,
          ease: "power2.out",
          onUpdate: () => {
            counter.textContent = Math.round(state.value) + suffix;
          },
          onComplete: () => {
            counter.textContent = target + suffix;
          },
        });
      };
      if (!("IntersectionObserver" in window)) {
        run();
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          run();
          observer.disconnect();
        },
        { threshold: 0.55 }
      );
      observer.observe(counter);
    });

    if (REDUCED || !g) return;
    if (ST) g.registerPlugin(ST);

    /* Trazado progresivo de los SVG con stroke. Los iconos de relleno quedan
       intactos; los contornos se dibujan al entrar en escena. */
    $$("main svg path, main svg circle, main svg rect, footer svg path").forEach(
      (shape, index) => {
        if (typeof shape.getTotalLength !== "function") return;
        const stroke = getComputedStyle(shape).stroke;
        if (!stroke || stroke === "none" || stroke === "rgba(0, 0, 0, 0)") return;
        let length = 0;
        try {
          length = shape.getTotalLength();
        } catch {
          return;
        }
        if (!Number.isFinite(length) || length < 4) return;
        shape.classList.add("rh-svg-draw");
        shape.style.setProperty("--rh-path-length", length.toFixed(2));
        const target =
          shape.closest(".info-item, .map-card, .reveal, section, footer") || shape;
        g.fromTo(
          shape,
          { strokeDasharray: length, strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: 0.82,
            delay: (index % 4) * 0.045,
            ease: "power2.out",
            scrollTrigger: ST
              ? {
                  trigger: target,
                  start: "top 88%",
                  once: true,
                }
              : undefined,
          }
        );
      }
    );

    /* Profundidad interactiva del hero: el arte responde al puntero con la
       misma sensación de objeto vivo de una escena canvas/WebGL, usando los
       assets propios del proyecto. */
    const hero = $(".hero");
    const heroVisual = $(".hero-brand-visual");
    if (
      !LOW_POWER_DEVICE &&
      hero &&
      heroVisual &&
      window.matchMedia("(pointer:fine)").matches
    ) {
      let heroPointerFrame = null;
      let heroPointerEvent = null;
      hero.addEventListener("pointermove", (event) => {
        heroPointerEvent = event;
        if (heroPointerFrame) return;
        heroPointerFrame = requestAnimationFrame(() => {
          const rect = hero.getBoundingClientRect();
          const x = (heroPointerEvent.clientX - rect.left) / rect.width - 0.5;
          const y = (heroPointerEvent.clientY - rect.top) / rect.height - 0.5;
          g.to(heroVisual, {
            x: x * 22,
            y: y * 14,
            rotateX: -y * 5,
            rotateY: x * 7,
            transformPerspective: 1100,
            duration: 0.75,
            ease: "power3.out",
            overwrite: "auto",
          });
          hero.style.setProperty("--rh-hero-x", ((x + 0.5) * 100).toFixed(2) + "%");
          hero.style.setProperty("--rh-hero-y", ((y + 0.5) * 100).toFixed(2) + "%");
          heroPointerFrame = null;
        });
      }, { passive: true });
      hero.addEventListener("pointerleave", () => {
        g.to(heroVisual, {
          x: 0,
          y: 0,
          rotateX: 0,
          rotateY: 0,
          duration: 1.05,
          ease: "elastic.out(1, 0.62)",
          overwrite: "auto",
        });
      });
    }

    /* El fondo de cada sector se desplaza a distinta velocidad, replicando el
       cambio continuo de escena/color del lienzo de la referencia. */
    if (ST && !LOW_POWER_DEVICE) {
      $$(".race-sector .race-atmosphere").forEach((atmosphere) => {
        g.fromTo(
          atmosphere,
          { xPercent: -7, yPercent: -3, scale: 1.06 },
          {
            xPercent: 7,
            yPercent: 3,
            scale: 1.12,
            ease: "none",
            scrollTrigger: {
              trigger: atmosphere.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }

  }

  /* ---------- API pública ---------- */

  window.RH = {
    $, $$,
    escapeHTML,
    formatUSD,
    getProduct,
    catLabel,
    waLink,
    productCard,
    addToCart,
    openCart,
    showToast,
    initReveals,
    unobserveReveals,
  };

  /* ---------- Init ---------- */

  document.addEventListener("DOMContentLoaded", () => {
    initAsyncImages();
    initLoader();
    injectGlobalUI();
    initHeader();
    initRoutePrefetch();
    initSamePageLinks();
    initEvents();
    wireContactLinks();
    initStoreStatus();
    initMapConsent();
    initRacingAtmosphere();
    renderFeatured();
    renderCartUI(false);
    initStatement();
    initStagger();
    initReveals();
    initScrollReveals();
    initParallax();
    initTilt();
    initMagnetic();
    startMotionLayer();
  });

  window.addEventListener("storage", (e) => {
    if (e.key !== CART_KEY) return;
    cart = loadCart();
    renderCartUI(false);
  });
})();
