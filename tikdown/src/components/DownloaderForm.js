// DownloaderForm.js — input handling, validation display, submit gating.
import { store, setState } from "../state.js";
import { trimAndNormalize, validateTikTokUrl } from "../validation.js";

export function initDownloaderForm({ onFetch, onDemo }) {
  const form = document.getElementById("fetchForm");
  const input = document.getElementById("urlInput");
  const err = document.getElementById("urlError");
  const btn = document.getElementById("fetchBtn");
  const clearBtn = document.getElementById("clearBtn");
  const pasteBtn = document.getElementById("pasteBtn");
  const demoBtn = document.getElementById("demoBtn");
  const loading = document.getElementById("loadingBlock");
  const loadingText = document.getElementById("loadingText");
  const tag = document.getElementById("fetchStateTag");

  function showError(msg) {
    if (!msg) { err.hidden = true; err.textContent = ""; return; }
    err.textContent = "⚠ " + msg;
    err.hidden = false;
  }

  function sync() {
    const busy = store.status === "checking";
    btn.disabled = busy;
    btn.textContent = busy ? "CHECKING…" : store.status === "downloading" ? "SAVING FILE…" : "FETCH VIDEO ↗";
    loading.hidden = !busy && store.status !== "downloading";
    if (store.status === "downloading" && store.downloadProgress) {
      const { received, total } = store.downloadProgress;
      loadingText.textContent = total
        ? `SAVING FILE… ${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`
        : `SAVING FILE… ${(received / 1048576).toFixed(1)} MB`;
    } else if (busy) {
      loadingText.textContent = "CHECKING LINK… CONTACTING PROVIDER…";
    }
    tag.textContent = { idle: "IDLE", checking: "CHECKING…", ready: "READY ✓", error: "FAULT", downloading: "SAVING…" }[store.status] || "IDLE";
    tag.className = "tag-right" + (store.status === "ready" ? " success" : store.status === "error" ? " error" : (store.status === "checking" || store.status === "downloading") ? " busy" : "");
  }

  // Live-trim + live validity hint (no auto-submit).
  input.addEventListener("input", () => {
    const trimmed = trimAndNormalize(input.value);
    if (input.value !== trimmed && document.activeElement !== input) input.value = trimmed;
    setState({ url: input.value });
    if (err && !err.hidden && trimmed) showError(null);
  });
  input.addEventListener("blur", () => {
    const t = trimAndNormalize(input.value);
    if (input.value !== t) { input.value = t; setState({ url: t }); }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (store.status === "checking" || store.status === "downloading") return; // no duplicate submissions
    const raw = trimAndNormalize(input.value);
    input.value = raw;
    const v = validateTikTokUrl(raw);
    if (!v.ok) { showError(v.message); input.focus(); return; }
    showError(null);
    onFetch(raw);
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    setState({ url: "" });
    showError(null);
    input.focus();
  });

  pasteBtn.addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { input.value = trimAndNormalize(t); setState({ url: input.value }); showError(null); input.focus(); }
      else showError("Clipboard is empty — paste the link manually.");
    } catch {
      showError("Clipboard access blocked — press Ctrl/⌘+V inside the field to paste.");
      input.focus();
    }
  });

  demoBtn.addEventListener("click", () => {
    if (store.status === "checking" || store.status === "downloading") return;
    showError(null);
    onDemo();
  });

  return { showError, sync, focusInput: () => input.focus(), getValue: () => input.value };
}
