// tiktokProvider.js — provider adapter. UI code talks ONLY to these three
// methods; swap backends here without touching components.
//
//   resolveVideo(url)        -> normalized video object (throws coded errors)
//   getDownloadOptions(video)-> options backed by REAL provider URLs only
//   getProviderStatus()      -> { online, label, detail }
//
// Strategy (no secrets anywhere — both endpoints are keyless):
//   1. TikWM API  https://www.tikwm.com/api/?url=  (maintained, free, no key)
//      returns play (no-watermark), wmplay (watermark), music, cover, title,
//      author{unique_id,nickname,avatar}, duration, size, wm_size.
//   2. TikTok official oEmbed https://www.tiktok.com/oembed?url= (metadata only,
//      no download URLs — surfaced as "metadata only, no files").
//   3. Explicit demo sample (opt-in only, clearly labeled, never TikTok content).

import { validateTikTokUrl } from "./validation.js";

const TIKWM_ENDPOINT = "https://www.tikwm.com/api/?url=";
const OEMBED_ENDPOINT = "https://www.tiktok.com/oembed?url=";
const FETCH_TIMEOUT_MS = 15000;

let lastProbe = { online: null, label: "UNCHECKED", at: 0, detail: "" };

function getSuperFetch() {
  try {
    const r = globalThis.root;
    if (r && typeof r.superFetch === "function") return r.superFetch.bind(r);
  } catch { /* ignore */ }
  return null;
}

async function fetchJson(url, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  try {
    // Prefer native fetch (verified working + CORS-open for TikWM/oEmbed/CDN).
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw codedError("HTTP_" + res.status, `Provider answered HTTP ${res.status}. Try again in a moment.`);
    const text = await res.text();
    if (text.length > 2_000_000) throw codedError("OVERSIZED", "Provider response was unexpectedly large — refused.");
    try {
      return JSON.parse(text);
    } catch {
      throw codedError("BAD_JSON", "Provider returned an unreadable response. Try again.");
    }
  } catch (err) {
    // CORS-proof fallback via platform proxy when native fetch is blocked.
    if (err && (err.name === "TypeError" || /failed to fetch|cors|networkerror/i.test(String(err && err.message)))) {
      const sf = getSuperFetch();
      if (sf) {
        try {
          const r2 = await sf(url).then((r) => r.text());
          return JSON.parse(String(r2).slice(0, 2_000_000));
        } catch (e2) {
          throw codedError("NETWORK", "Network blocked and the fallback proxy failed: " + shortMsg(e2));
        }
      }
    }
    if (err && err.code) throw err;
    if (err && err.name === "AbortError") throw codedError("TIMEOUT", `Request timed out after ${Math.round(timeoutMs / 1000)}s — the provider is slow. Try again.`);
    throw codedError("NETWORK", "Network error reaching the provider: " + shortMsg(err));
  } finally {
    clearTimeout(t);
  }
}

function codedError(code, message, extra = {}) {
  const e = new Error(message);
  e.code = code;
  Object.assign(e, extra);
  return e;
}
function shortMsg(e) {
  return String((e && e.message) || e || "unknown").slice(0, 180);
}
function fmtBytes(n) {
  n = Number(n);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}
function fmtDuration(s) {
  s = Number(s);
  if (!Number.isFinite(s) || s < 0) return null;
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}
export function sanitizeText(s, max = 300) {
  return String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

function mapTikwm(data, sourceUrl) {
  const author = data.author || {};
  const title = sanitizeText(data.title || data.content_desc || "Untitled TikTok video", 300);
  const nickname = sanitizeText(author.nickname || author.unique_id || "unknown creator", 120);
  const handle = sanitizeText(author.unique_id || "", 120);
  return {
    id: String(data.id || "unknown"),
    title,
    authorName: nickname,
    authorHandle: handle ? "@" + handle : "",
    avatar: typeof author.avatar === "string" ? author.avatar : "",
    thumbnail: data.origin_cover || data.cover || data.ai_dynamic_cover || "",
    duration: Number(data.duration) || null,
    durationLabel: fmtDuration(data.duration),
    sizeBytes: Number(data.size) || Number(data.wm_size) || null,
    sizeLabel: fmtBytes(data.size) || fmtBytes(data.wm_size),
    playUrl: typeof data.play === "string" && data.play.startsWith("http") ? data.play : null,       // no watermark
    watermarkUrl: typeof data.wmplay === "string" && data.wmplay.startsWith("http") ? data.wmplay : null, // watermark
    audioUrl: typeof data.music === "string" && data.music.startsWith("http")
      ? data.music
      : (data.music_info && typeof data.music_info.play === "string" ? data.music_info.play : null),
    audioTitle: data.music_info ? sanitizeText(data.music_info.title || "original sound", 160) : null,
    playCount: data.play_count ?? null,
    source: "tikwm",
    sourceUrl,
    fetchedAt: Date.now(),
    demo: false,
  };
}

export async function resolveVideo(inputUrl) {
  const v = validateTikTokUrl(inputUrl);
  if (!v.ok) throw codedError(v.code, v.message);
  const url = v.url;

  // ---- primary: TikWM ----
  let tikwmErr = null;
  try {
    const json = await fetchJson(TIKWM_ENDPOINT + encodeURIComponent(url));
    if (json && json.code === 0 && json.data) {
      const video = mapTikwm(json.data, url);
      if (!video.playUrl && !video.watermarkUrl && !video.audioUrl) {
        throw codedError("NO_MEDIA", "The provider found the video but returned no downloadable files (private or restricted?).");
      }
      lastProbe = { online: true, label: "TIKWM · ONLINE", at: Date.now(), detail: "lookup ok" };
      return video;
    }
    const msg = String((json && json.msg) || "lookup failed");
    if (/limit|rate|too many|1 request/i.test(msg)) {
      tikwmErr = codedError("RATE_LIMITED", "Provider rate limit hit (TikWM throttles to ~1 req/s on the free tier). Wait ~10 seconds and press RE-FETCH.");
    } else if (/parsing|invalid|check url|not found|deleted|private/i.test(msg)) {
      tikwmErr = codedError("NOT_FOUND", "Provider couldn't parse that link — it may be deleted, private, region-blocked, or not a video page. (" + sanitizeText(msg, 120) + ")");
    } else {
      tikwmErr = codedError("PROVIDER_REJECTED", "Provider refused that link: " + sanitizeText(msg, 160));
    }
  } catch (e) {
    tikwmErr = e && e.code ? e : codedError("NETWORK", shortMsg(e));
  }

  // ---- fallback: official oEmbed (metadata only, proves the link is a real video page) ----
  try {
    const meta = await fetchJson(OEMBED_ENDPOINT + encodeURIComponent(url));
    if (meta && (meta.embed_product_id || meta.title || meta.author_name)) {
      lastProbe = { online: true, label: "TIKWM · DEGRADED", at: Date.now(), detail: "oembed fallback" };
      return {
        id: String(meta.embed_product_id || v.videoHint || "unknown"),
        title: sanitizeText(meta.title || "TikTok video (title withheld by provider)", 300),
        authorName: sanitizeText(meta.author_name || "unknown creator", 120),
        authorHandle: "",
        avatar: "",
        thumbnail: meta.thumbnail_url || "",
        duration: null, durationLabel: null, sizeBytes: null, sizeLabel: null,
        playUrl: null, watermarkUrl: null, audioUrl: null,
        audioTitle: null, playCount: null,
        source: "oembed-metadata-only",
        sourceUrl: url,
        fetchedAt: Date.now(),
        demo: false,
        metadataOnly: true,
        providerNote: tikwmErr ? tikwmErr.message : "Media URLs unavailable.",
      };
    }
  } catch { /* fall through to primary error */ }

  if (lastProbe.online !== true) lastProbe = { online: false, label: "PROVIDER · UNREACHABLE", at: Date.now(), detail: shortMsg(tikwmErr) };
  throw tikwmErr || codedError("PROVIDER_DOWN", "Lookup provider is unreachable. Check your connection or try the demo sample.");
}

export function getDownloadOptions(video) {
  if (!video) return [];
  if (video.metadataOnly) return [];
  const opts = [];
  // TikWM: `play` = without watermark, `wmplay` = with watermark.
  if (video.playUrl && video.playUrl !== video.watermarkUrl) {
    opts.push({ key: "nowm", kind: "video", label: "VIDEO — NO WATERMARK", detail: video.sizeLabel ? `${video.sizeLabel} · MP4 · direct provider file` : "MP4 · direct provider file", url: video.playUrl, filename: `tikdown-${video.id}-nowm.mp4`, mime: "video/mp4" });
  }
  if (video.watermarkUrl) {
    const sameAsPlay = video.watermarkUrl === video.playUrl;
    opts.push({ key: "wm", kind: "video", label: sameAsPlay ? "VIDEO — PROVIDER FILE" : "VIDEO — WATERMARK", detail: sameAsPlay ? "MP4 · this provider returned one file for both qualities" : "MP4 · original captioned file", url: video.watermarkUrl, filename: `tikdown-${video.id}-wm.mp4`, mime: "video/mp4" });
  } else if (!video.playUrl) {
    opts.push({ key: "wm-missing", kind: "unavailable", label: "VIDEO — WATERMARK", detail: "Not supplied by provider for this video.", url: null });
  }
  if (!video.playUrl && video.watermarkUrl) {
    opts.push({ key: "nowm-missing", kind: "unavailable", label: "VIDEO — NO WATERMARK", detail: "Not supplied by provider for this video — the watermarked file above is all that's available.", url: null });
  }
  if (video.audioUrl) {
    opts.push({ key: "audio", kind: "audio", label: "AUDIO ONLY", detail: (video.audioTitle ? video.audioTitle.slice(0, 60) + " · " : "") + "MPEG · direct provider file", url: video.audioUrl, filename: `tikdown-${video.id}-audio.mp3`, mime: "audio/mpeg" });
  } else {
    opts.push({ key: "audio-missing", kind: "unavailable", label: "AUDIO ONLY", detail: "Not supplied by provider for this video.", url: null });
  }
  if (video.source === "tiktok-cdn") {
    opts.push({ key: "orig", kind: "video", label: "ORIGINAL QUALITY", detail: "Highest file the provider returned.", url: video.playUrl, filename: `tikdown-${video.id}-orig.mp4`, mime: "video/mp4" });
  }
  return opts;
}

export async function getProviderStatus({ ping = false } = {}) {
  if (!ping && lastProbe.online !== null && Date.now() - lastProbe.at < 120_000) return lastProbe;
  // Lightweight health check against the official oEmbed endpoint (no quota).
  try {
    await fetchJson(OEMBED_ENDPOINT + encodeURIComponent("https://www.tiktok.com/@tiktok/video/7253698652710575406"), { timeoutMs: 8000 });
    lastProbe = { online: true, label: "TIKWM · ONLINE", at: Date.now(), detail: "health check ok" };
  } catch (e) {
    lastProbe = { online: false, label: "PROVIDER · UNREACHABLE", at: Date.now(), detail: shortMsg(e) };
  }
  return lastProbe;
}

// ---- explicit demo sample (opt-in only) ----
export function getDemoVideo() {
  return {
    id: "DEMO-0001",
    title: "Sample showreel — neon market loop (DEMO, not a TikTok video)",
    authorName: "Demo Creator",
    authorHandle: "@demo.creator",
    avatar: "",
    thumbnail: "",
    duration: 10,
    durationLabel: "10s",
    sizeBytes: 2097152,
    sizeLabel: "2.0 MB",
    playUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    watermarkUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    audioUrl: null,
    audioTitle: null,
    playCount: null,
    source: "demo-sample",
    sourceUrl: "demo://sample",
    fetchedAt: Date.now(),
    demo: true,
  };
}

// ---- safe file download: fetch blob (with caps) -> object URL -> <a download> ----
export async function downloadFile(url, filename, { timeoutMs = 60000, maxBytes = 100 * 1024 * 1024, onProgress } = {}) {
  if (!/^https?:\/\//i.test(String(url))) throw codedError("BAD_URL", "Refusing to download: not an http(s) provider URL.");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) {
      if (res.status === 403 || res.status === 410) throw codedError("EXPIRED", "That file link has expired (provider URLs are short-lived). Press RE-FETCH to get a fresh link.");
      throw codedError("HTTP_" + res.status, `Download failed with HTTP ${res.status}. The link may have expired — press RE-FETCH.`);
    }
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (ctype && !/video|audio|mp4|mpeg|octet-stream/.test(ctype) && !ctype.includes("binary")) {
      throw codedError("WRONG_TYPE", `Provider returned “${ctype}” instead of a media file — refusing to save it.`);
    }
    const total = Number(res.headers.get("content-length"));
    if (Number.isFinite(total) && total > maxBytes) {
      throw codedError("TOO_BIG", `File is ${(total / 1048576).toFixed(1)} MB — over the 100 MB safety cap.`);
    }
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    if (!reader) {
      const blob = await res.blob();
      return { blob, bytes: blob.size, contentType: blob.type || ctype };
    }
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) { try { await reader.cancel(); } catch {} throw codedError("TOO_BIG", "File exceeded the 100 MB safety cap mid-download — stopped."); }
      chunks.push(value);
      if (onProgress) { try { onProgress(received, Number.isFinite(total) ? total : null); } catch {} }
    }
    const blob = new Blob(chunks, { type: ctype.split(";")[0] || "video/mp4" });
    return { blob, bytes: received, contentType: blob.type };
  } catch (e) {
    if (e && e.code) throw e;
    if (e && e.name === "AbortError") throw codedError("TIMEOUT", "Download timed out — the CDN is slow or the link expired. Press RE-FETCH and try again.");
    throw codedError("NETWORK", "Download failed: " + shortMsg(e));
  } finally {
    clearTimeout(t);
  }
}
