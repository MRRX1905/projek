// validation.js — strict TikTok URL validation. Never accept a URL merely
// because it contains the word "tiktok".

const ALLOWED_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
  "vm.tiktok.com",
  "www.vt.tiktok.com",
]);

// Matches real video address shapes:
//  /@user/video/1234567890123456789
//  /video/1234567890123456789
//  /v/123...  /t/ZM8AbcDe/
//  short-code paths on vm/vt hosts (/XXXXXXX)
const VIDEO_PATH = /(?:\/@[^/]+\/video\/\d{8,25}|\/video\/\d{8,25}|\/v\/\d{8,25}|\/t\/[A-Za-z0-9]+|\/[A-Za-z0-9]{6,})/;

export function trimAndNormalize(raw) {
  return String(raw ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

export function validateTikTokUrl(raw) {
  const url = trimAndNormalize(raw);
  if (!url) return { ok: false, code: "EMPTY", message: "Paste a TikTok video link first — the field is empty." };
  if (url.length > 2048) return { ok: false, code: "TOO_LONG", message: "That link is too long to be a TikTok video URL. Copy the share link again." };
  if (/\s/.test(url)) return { ok: false, code: "SPACES", message: "Links can't contain spaces. Paste the raw share URL." };

  let u;
  try {
    u = new URL(url);
  } catch {
    // Allow missing scheme for tiktok.com/... pastes
    try {
      u = new URL("https://" + url);
      if (!/tiktok\.com/i.test(url)) throw new Error("nope");
    } catch {
      return { ok: false, code: "MALFORMED", message: "That doesn't look like a URL. It should start with https://www.tiktok.com/… or https://vm.tiktok.com/…" };
    }
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, code: "PROTOCOL", message: "Only http(s) TikTok links are supported." };
  }

  const host = u.hostname.toLowerCase();
  const hostOk = ALLOWED_HOSTS.has(host) || host.endsWith(".tiktok.com");
  if (!hostOk) {
    return { ok: false, code: "NOT_TIKTOK", message: `“${host || "that host"}” is not a TikTok host. Supported: tiktok.com video links and vm/vt.tiktok.com short links.` };
  }

  const path = u.pathname || "/";
  // Reject non-video surfaces with a specific explanation.
  if (/^\/?(@[^/]+\/?)?$/.test(path)) {
    return { ok: false, code: "PROFILE_ONLY", message: "That's a profile/homepage link — open the video itself and use Share → Copy link (it must contain /video/ or a short code)." };
  }
  if (/\/(music|sound|hashtag|tag|discover|live|following|foryou)\b/i.test(path)) {
    return { ok: false, code: "NON_VIDEO_SURFACE", message: "That's a sound / hashtag / live page, not a video. Only direct video links are supported." };
  }
  if (!VIDEO_PATH.test(path)) {
    return { ok: false, code: "NO_VIDEO_ID", message: "No video ID found in that link. A supported link looks like tiktok.com/@user/video/1234567890 or vm.tiktok.com/XXXXXXX." };
  }

  // Canonicalize: keep as-is (provider resolves short links itself).
  return { ok: true, code: "OK", url: u.toString(), host, videoHint: extractVideoId(path) };
}

export function extractVideoId(path) {
  const m = String(path).match(/\/video\/(\d{8,25})|\/v\/(\d{8,25})/);
  if (m) return m[1] || m[2];
  const t = String(path).match(/\/t\/([A-Za-z0-9]+)/);
  if (t) return "short:" + t[1];
  const s = String(path).match(/\/([A-Za-z0-9]{6,})\/?$/);
  return s ? "code:" + s[1] : null;
}
