/* ==========================================================================
   Racing Hobbies Ecuador — Lógica del catálogo (catalogo.html)
   Filtros por categoría y marca, búsqueda con debounce, ordenamiento y render.
   ========================================================================== */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const {
      $, $$, productCard, initReveals, unobserveReveals, catLabel, waLink, showToast,
    } = window.RH;

    const grid = $("#catalog-grid");
    const chipsWrap = $("#catalog-chips");
    const searchInput = $("#catalog-search");
    const searchClear = $("#catalog-search-clear");
    const brandSelect = $("#catalog-brand");
    const sortSelect = $("#catalog-sort");
    const resultsInfo = $("#catalog-results");
    const resetFilters = $("#catalog-reset");
    const shareSelection = $("#catalog-share");
    if (!grid || !chipsWrap) return;

    const params = new URLSearchParams(window.location.search);
    const allowedSorts = ["featured", "price-asc", "price-desc", "name"];
    const urlCat = params.get("cat");
    const urlBrand = params.get("brand");
    const urlSort = params.get("sort");

    const brandGroups = [
      {
        slug: "fms",
        label: "FMS",
        terms: ["fms"],
        ids: ["camel-defender", "camel-discovery"],
      },
      { slug: "redcat", label: "Redcat", terms: ["redcat"] },
      { slug: "tamiya", label: "Tamiya", terms: ["tamiya"] },
      { slug: "traxxas", label: "Traxxas", terms: ["traxxas"] },
      {
        slug: "e-flite",
        label: "E-flite",
        terms: ["e-flite"],
        ids: [
          "f4-phantom", "edge-as3x", "t28-trojan", "convergence-vtol",
          "stryker", "night-vapor", "umx-fpv-vapor", "stryker-180",
        ],
      },
      { slug: "blade", label: "Blade", terms: ["blade"] },
      { slug: "hangar-9", label: "Hangar 9", ids: ["ultra-stick", "arf-beast-60"] },
      { slug: "hobbyzone", label: "HobbyZone", terms: ["hobbyzone"] },
      { slug: "hexfly", label: "Hexfly", terms: ["hexfly"] },
      { slug: "powerhobby", label: "Powerhobby", terms: ["powerhobby"] },
      { slug: "caterpillar", label: "Caterpillar", terms: ["caterpillar"] },
      { slug: "merlin", label: "Merlin", terms: ["merlin"] },
      { slug: "racer-edge", label: "Racer Edge", terms: ["racer edge"] },
      { slug: "otras", label: "Otras marcas", fallback: true },
    ];

    function productBrand(product) {
      const name = normalizeText(product.name);
      return (
        brandGroups.find((brand) => {
          if (brand.fallback) return false;
          return (
            (brand.ids && brand.ids.includes(product.id)) ||
            (brand.terms && brand.terms.some((term) => name.includes(term)))
          );
        }) || brandGroups.find((brand) => brand.fallback)
      );
    }

    const availableBrands = brandGroups.filter((brand) =>
      RH_PRODUCTS.some((product) => productBrand(product).slug === brand.slug)
    );

    const state = {
      cat:
        urlCat && RH_CATEGORIES.some((c) => c.slug === urlCat)
          ? urlCat
          : "all",
      brand:
        urlBrand && availableBrands.some((brand) => brand.slug === urlBrand)
          ? urlBrand
          : "all",
      // El texto llega desde la URL; limitarlo evita trabajo innecesario y
      // mantiene estable el enlace compartible incluso con queries enormes.
      query: (params.get("q") || "").trim().slice(0, 80),
      sort: allowedSorts.includes(urlSort) ? urlSort : "featured",
    };

    /* Chips de categoría */
    const cats = [{ slug: "all", label: "Todo" }].concat(RH_CATEGORIES);
    cats.forEach((c) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      const count =
        c.slug === "all"
          ? RH_PRODUCTS.length
          : RH_PRODUCTS.filter((p) => p.cat === c.slug).length;
      chip.textContent = c.label;
      const chipCount = document.createElement("span");
      chipCount.className = "chip-count";
      chipCount.textContent = count;
      chip.appendChild(chipCount);
      chip.dataset.cat = c.slug;
      chip.setAttribute("aria-pressed", String(c.slug === state.cat));
      chip.setAttribute("aria-controls", "catalog-grid");
      chip.addEventListener("click", () => {
        state.cat = c.slug;
        $$(".chip", chipsWrap).forEach((el) =>
          el.setAttribute("aria-pressed", String(el.dataset.cat === c.slug))
        );
        render();
      });
      chipsWrap.appendChild(chip);
    });

    /* Selector de marca */
    if (brandSelect) {
      availableBrands.forEach((brand) => {
        const count = RH_PRODUCTS.filter(
          (product) => productBrand(product).slug === brand.slug
        ).length;
        const option = document.createElement("option");
        option.value = brand.slug;
        option.textContent = `${brand.label} (${count})`;
        brandSelect.appendChild(option);
      });
      brandSelect.value = state.brand;
      brandSelect.addEventListener("change", () => {
        state.brand = brandSelect.value;
        render();
      });
    }

    /* Búsqueda con debounce */
    let debounceTimer = null;
    if (searchInput) {
      searchInput.value = state.query;
      searchInput.addEventListener("input", () => {
        if (searchClear) searchClear.hidden = searchInput.value.length === 0;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.query = searchInput.value.trim();
          render();
        }, 180);
      });
    }
    if (searchClear) {
      searchClear.hidden = state.query.length === 0;
      searchClear.addEventListener("click", () => {
        state.query = "";
        searchInput.value = "";
        searchClear.hidden = true;
        render();
        searchInput.focus();
      });
    }

    /* Orden */
    if (sortSelect) {
      sortSelect.value = state.sort;
      sortSelect.addEventListener("change", () => {
        state.sort = sortSelect.value;
        render();
      });
    }

    if (resetFilters) {
      resetFilters.addEventListener("click", () => {
        state.cat = "all";
        state.brand = "all";
        state.query = "";
        state.sort = "featured";
        if (searchInput) searchInput.value = "";
        if (searchClear) searchClear.hidden = true;
        if (brandSelect) brandSelect.value = "all";
        if (sortSelect) sortSelect.value = "featured";
        $$(".chip", chipsWrap).forEach((el) =>
          el.setAttribute("aria-pressed", String(el.dataset.cat === "all"))
        );
        render();
        if (searchInput) searchInput.focus();
      });
    }

    if (shareSelection) {
      shareSelection.addEventListener("click", async () => {
        const url = window.location.href;
        const shareData = {
          title: "Selección RC — Racing Hobbies Ecuador",
          text: "Mira esta selección de productos RC de Racing Hobbies Ecuador.",
          url,
        };
        try {
          if (navigator.share) {
            await navigator.share(shareData);
            return;
          }
          await navigator.clipboard.writeText(url);
          showToast("Enlace de la selección copiado ✓");
        } catch (error) {
          if (error && error.name === "AbortError") return;
          showToast("No pudimos compartir el enlace. Copia la dirección del navegador.");
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      const active = document.activeElement;
      const isTyping =
        active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
      if (event.key === "/" && !isTyping && searchInput) {
        event.preventDefault();
        searchInput.focus();
      }
      if (
        event.key === "Escape" &&
        active === searchInput &&
        searchInput.value.length > 0
      ) {
        state.query = "";
        searchInput.value = "";
        if (searchClear) searchClear.hidden = true;
        render();
      }
    });

    function normalizeText(value) {
      return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    }

    function compactText(value) {
      return normalizeText(value).replace(/\s+/g, "");
    }

    function filterProducts() {
      let list = RH_PRODUCTS.slice();

      if (state.cat !== "all") {
        list = list.filter((p) => p.cat === state.cat);
      }

      if (state.brand !== "all") {
        list = list.filter((p) => productBrand(p).slug === state.brand);
      }

      if (state.query) {
        const query = normalizeText(state.query);
        const compactQuery = compactText(state.query);
        list = list.filter((p) => {
          const brand = productBrand(p);
          const haystack = normalizeText(
            p.id + " " + p.name + " " + p.desc + " " + brand.label + " " +
            catLabel(p.cat) + " " + p.specs.join(" ")
          );
          return (
            haystack.includes(query) ||
            (compactQuery.length >= 3 && compactText(haystack).includes(compactQuery))
          );
        });
      }

      switch (state.sort) {
        case "price-asc":
          list.sort((a, b) => a.price - b.price);
          break;
        case "price-desc":
          list.sort((a, b) => b.price - a.price);
          break;
        case "name":
          list.sort((a, b) => a.name.localeCompare(b.name, "es"));
          break;
        default: {
          // Destacados primero: top > nuevo > oferta > resto
          const rank = { top: 0, nuevo: 1, oferta: 2 };
          list.sort(
            (a, b) =>
              (a.tag in rank ? rank[a.tag] : 3) - (b.tag in rank ? rank[b.tag] : 3)
          );
        }
      }

      return list;
    }

    function syncURL() {
      const next = new URLSearchParams();
      if (state.cat !== "all") next.set("cat", state.cat);
      if (state.brand !== "all") next.set("brand", state.brand);
      if (state.query) next.set("q", state.query);
      if (state.sort !== "featured") next.set("sort", state.sort);
      const query = next.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (query ? "?" + query : "")
      );
    }

    function render() {
      const list = filterProducts();
      syncURL();
      unobserveReveals(grid);
      grid.textContent = "";
      const hasFilters =
        state.cat !== "all" ||
        state.brand !== "all" ||
        Boolean(state.query) ||
        state.sort !== "featured";
      if (resetFilters) resetFilters.hidden = !hasFilters;

      if (resultsInfo) {
        const catName =
          state.cat === "all" ? "todas las categorías" : catLabel(state.cat);
        const brandName =
          state.brand === "all"
            ? ""
            : availableBrands.find((brand) => brand.slug === state.brand)?.label || "";
        resultsInfo.textContent =
          list.length +
          (list.length === 1 ? " producto" : " productos") +
          " en " +
          catName +
          (brandName ? " de " + brandName : "") +
          (state.query ? ` (búsqueda: “${state.query}”)` : "");
      }

      if (list.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state span-all";
        const strong = document.createElement("strong");
        strong.textContent = "Sin resultados en pista";
        const p = document.createElement("p");
        p.textContent =
          "No encontramos productos con esos filtros. Prueba otra búsqueda o escríbenos: lo conseguimos por ti.";
        empty.append(strong, p);
        if (typeof waLink === "function") {
          const cta = document.createElement("a");
          cta.className = "btn btn-volt btn-sm empty-cta";
          cta.target = "_blank";
          cta.rel = "noopener noreferrer";
          const asked = state.query
            ? `Estoy buscando: ${state.query}.`
            : "Estoy buscando un producto que no veo en el catálogo.";
          cta.href = waLink(`¡Hola Racing Hobbies! ${asked} ¿Lo consiguen?`);
          cta.append(
            document.createTextNode("Pídelo por WhatsApp "),
            Object.assign(document.createElement("span"), {
              className: "arrow",
              textContent: "→",
              ariaHidden: "true",
            })
          );
          empty.appendChild(cta);
        }
        grid.appendChild(empty);
        return;
      }

      list.forEach((p, i) => grid.appendChild(productCard(p, i % 8)));
      initReveals();
    }

    render();
  });
})();
