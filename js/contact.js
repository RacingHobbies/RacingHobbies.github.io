/* ==========================================================================
   Racing Hobbies Ecuador — Formulario de contacto (contacto.html)
   Valida los campos y genera el mensaje de WhatsApp con los datos.
   ========================================================================== */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const { $, waLink, showToast } = window.RH;

    const form = $("#contact-form");
    if (!form) return;
    const messageCount = $("#cf-message-count");

    const fields = {
      name: {
        el: $("#cf-name"),
        validate: (v) => v.trim().length >= 2,
        msg: "Ingresa tu nombre (mínimo 2 caracteres).",
      },
      phone: {
        el: $("#cf-phone"),
        validate: (v) => /^[+\d][\d\s\-()]{6,19}$/.test(v.trim()),
        msg: "Ingresa un teléfono válido (ej. 099 123 4567).",
      },
      topic: {
        el: $("#cf-topic"),
        validate: (v) => v.trim().length > 0,
        msg: "Selecciona un tema.",
      },
      message: {
        el: $("#cf-message"),
        validate: (v) => v.trim().length >= 10,
        msg: "Cuéntanos un poco más (mínimo 10 caracteres).",
      },
    };

    function setValidity(key, valid) {
      const field = fields[key];
      const wrap = field.el.closest(".field");
      if (!wrap) return;
      wrap.classList.toggle("invalid", !valid);
      field.el.setAttribute("aria-invalid", String(!valid));
      const err = wrap.querySelector(".error-msg");
      if (err) err.textContent = valid ? "" : field.msg;
    }

    function updateMessageCount() {
      if (!messageCount || !fields.message.el) return;
      const length = fields.message.el.value.length;
      messageCount.textContent = `${length} / 1200`;
      messageCount.classList.toggle("near-limit", length >= 1000);
    }

    Object.keys(fields).forEach((key) => {
      fields[key].el.addEventListener("input", () => {
        if (key === "message") updateMessageCount();
        // Limpia el error en cuanto el campo vuelve a ser válido.
        if (fields[key].validate(fields[key].el.value)) setValidity(key, true);
      });
      fields[key].el.addEventListener("blur", () => {
        setValidity(key, fields[key].validate(fields[key].el.value));
      });
    });
    updateMessageCount();

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      let firstInvalid = null;
      Object.keys(fields).forEach((key) => {
        const valid = fields[key].validate(fields[key].el.value);
        setValidity(key, valid);
        if (!valid && !firstInvalid) firstInvalid = fields[key].el;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const name = fields.name.el.value.trim();
      const phone = fields.phone.el.value.trim();
      const topic = fields.topic.el.value;
      const message = fields.message.el.value.trim();

      const lines = [
        "¡Hola Racing Hobbies! 🏁",
        "",
        "Nombre: " + name,
        "Teléfono: " + phone,
        "Tema: " + topic,
        "",
        message,
      ];

      const url = waLink(lines.join("\n"));
      const popup = window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
      if (!popup) {
        window.location.assign(url);
        return;
      }
      popup.opener = null;
      showToast("Abriendo WhatsApp con tu mensaje… 🏁");
      form.reset();
      updateMessageCount();
      Object.keys(fields).forEach((key) => setValidity(key, true));
    });
  });
})();
