// VideoResult.js — renders provider metadata using textContent only
// (provider strings are never injected as HTML).
import { store } from "../state.js";

function setText(id, value, fallback = "—") {
  const el = document.getElementById(id);
  el.textContent = value == null || value === "" ? fallback : String(value);
}

export function renderResult() {
  const panel = document.getElementById("resultPanel");
  const v = store.video;
  if (!v) { panel.hidden = true; return; }
  panel.hidden = false;

  document.getElementById("demoBanner").hidden = !v.demo;
  document.getElementById("resultStateTag").textContent = v.metadataOnly ? "METADATA ONLY" : v.demo ? "DEMO ✓" : "READY ✓";

  setText("videoTitle", v.title);
  const creator = v.authorHandle && v.authorHandle !== v.authorName
    ? `${v.authorName} (${v.authorHandle})`
    : v.authorName;
  setText("creatorName", creator);

  const av = document.getElementById("avatarImg");
  if (v.avatar) { av.src = v.avatar; av.hidden = false; av.alt = ""; }
  else { av.removeAttribute("src"); av.hidden = true; }

  const th = document.getElementById("thumbImg");
  if (v.thumbnail) {
    th.src = v.thumbnail;
    th.alt = "Thumbnail for " + String(v.title).slice(0, 80);
  } else {
    th.removeAttribute("src");
    th.alt = v.demo ? "Demo placeholder — no thumbnail" : "No thumbnail supplied by provider";
  }
  document.getElementById("srcBadge").textContent =
    v.source === "demo-sample" ? "DEMO" : v.source === "oembed-metadata-only" ? "OEMBED · META ONLY" : "TIKWM";

  // Preview video only when we have a real playable file (or demo file).
  const pv = document.getElementById("previewVideo");
  const playable = v.playUrl || v.watermarkUrl;
  if (playable) {
    pv.poster = v.thumbnail || "";
    pv.preload = "metadata";
    if (pv.getAttribute("src") !== playable) pv.src = playable;
    pv.hidden = false;
  } else { pv.removeAttribute("src"); pv.removeAttribute("poster"); pv.hidden = true; }

  setText("factDuration", v.durationLabel || (v.duration != null ? String(v.duration) + "s" : "—"));
  setText("factSize", v.sizeLabel || "NOT SUPPLIED");
  setText("factId", v.id);
  setText("factSource", v.source === "demo-sample" ? "DEMO SAMPLE" : v.source === "oembed-metadata-only" ? "OEMBED (NO FILES)" : "TIKWM API");

  setText("metaLine1", `ID ${v.id} · FETCHED ${new Date(v.fetchedAt).toLocaleTimeString()}`);
  setText("metaLine2", v.metadataOnly
    ? "PROVIDER RETURNED METADATA ONLY — no downloadable files. " + (v.providerNote || "")
    : v.demo
      ? "DEMO FILE — public-domain sample, not TikTok content."
      : `PLAY ${v.playUrl ? "AVAILABLE" : "—"} · WM ${v.watermarkUrl ? "AVAILABLE" : "—"} · AUDIO ${v.audioUrl ? "AVAILABLE" : "—"}`);
}

export function scrollToResult() {
  const panel = document.getElementById("resultPanel");
  if (!panel.hidden) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
