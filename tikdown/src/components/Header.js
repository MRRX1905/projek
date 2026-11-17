// Header.js — mobile menu + nav status echo.
import { store, subscribe } from "../state.js";

export function initHeader() {
  const btn = document.getElementById("menuBtn");
  const nav = document.getElementById("mainNav");
  const label = document.getElementById("navStatusLabel");
  const dot = document.getElementById("navDot");

  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "CLOSE ✕" : "MENU ☰";
  });
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "MENU ☰";
  }));

  subscribe((s) => {
    const map = {
      idle: "UTILITY / 001 · STANDBY",
      checking: "UTILITY / 001 · CHECKING",
      ready: "UTILITY / 001 · READY",
      error: "UTILITY / 001 · FAULT",
      downloading: "UTILITY / 001 · SAVING FILE",
    };
    label.textContent = map[s.status] || map.idle;
    dot.className = "dot" + (s.status === "checking" || s.status === "downloading" ? " busy" : s.status === "ready" ? " ok" : s.status === "error" ? " err" : "");
  });
}
