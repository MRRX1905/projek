// Footer.js — brand footer + privacy/terms/contact modals (keyboard-safe).
export function initFooter() {
  document.getElementById("genYear").textContent = String(new Date().getFullYear());
  const openBtns = [...document.querySelectorAll("[data-modal]")];
  function open(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.hidden = false;
    const c = m.querySelector(".modal-close");
    if (c) c.focus();
  }
  function close(m) { m.hidden = true; }
  openBtns.forEach((b) => b.addEventListener("click", () => open(b.dataset.modal)));
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m) close(m); });
    const c = m.querySelector(".modal-close");
    if (c) c.addEventListener("click", () => close(m));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal").forEach((m) => { if (!m.hidden) close(m); });
  });
}
