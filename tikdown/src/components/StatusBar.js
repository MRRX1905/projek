// StatusBar.js — the status strip must always mirror the real store state:
// never READY during a request, never ONLINE without a check.
import { subscribe } from "../state.js";

export function initStatusBar() {
  const strip = document.getElementById("statusStrip");
  const sys = document.getElementById("stSystem");
  const inp = document.getElementById("stInput");
  const out = document.getElementById("stOutput");
  const prov = document.getElementById("stProvider");
  const heroState = document.getElementById("heroStateLabel");
  const heroMode = document.getElementById("heroModeLabel");
  const heroProv = document.getElementById("heroProviderLabel");

  subscribe((s) => {
    const sysMap = {
      idle: "READY",
      checking: "CHECKING…",
      ready: s.video && s.video.metadataOnly ? "READY (META ONLY)" : "READY",
      error: "FAULT",
      downloading: "SAVING FILE…",
    };
    sys.textContent = sysMap[s.status] || "READY";
    strip.dataset.s = s.status === "ready" || s.status === "idle" ? (s.status === "error" ? "error" : "idle") : s.status;
    if (s.status === "error") strip.dataset.s = "error";
    else if (s.status === "checking" || s.status === "downloading") strip.dataset.s = s.status;
    else strip.dataset.s = "idle";

    inp.textContent = s.url ? "TIKTOK URL ✓" : "—";
    out.textContent = !s.video ? "—" : s.video.metadataOnly ? "METADATA ONLY" : s.demoMode || (s.video && s.video.demo) ? "DEMO FILE" : "AVAILABLE MEDIA ✓";
    prov.textContent = s.provider.label || "UNCHECKED";

    heroState.textContent = sysMap[s.status] || "IDLE";
    heroMode.textContent = (s.video && s.video.demo) ? "DEMO MODE" : "LIVE LOOKUP";
    heroProv.textContent = (s.video && s.video.source === "oembed-metadata-only") ? "OEMBED FALLBACK" : s.provider.label.includes("TIKWM") ? "TIKWM API" : "TIKWM / OEMBED";
  });
}
