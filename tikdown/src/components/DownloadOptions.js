// DownloadOptions.js — one button per REAL provider URL; unavailable
// qualities render as disabled cards (never as fake links).
import { store, setState } from "../state.js";
import { downloadFile } from "../tiktokProvider.js";

function fmtProg(received, total) {
  const mb = (received / 1048576).toFixed(1);
  return total ? `${mb} / ${(total / 1048576).toFixed(1)} MB` : `${mb} MB`;
}

export function initDownloadOptions() {
  const box = document.getElementById("downloadOptions");
  const dlErr = document.getElementById("dlError");
  const refetchBtn = document.getElementById("refetchBtn");
  const dismissBtn = document.getElementById("dismissBtn");

  function showDlError(msg, withOpenUrl = null) {
    dlErr.innerHTML = "";
    dlErr.hidden = !msg;
    if (!msg) return;
    const b = document.createElement("b");
    b.textContent = "⚠ DOWNLOAD FAULT — ";
    dlErr.appendChild(b);
    dlErr.appendChild(document.createTextNode(msg));
    if (withOpenUrl) {
      dlErr.appendChild(document.createElement("br"));
      const a = document.createElement("a");
      a.href = withOpenUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "OPEN FILE DIRECTLY IN A NEW TAB INSTEAD →";
      a.style.color = "#B81F18";
      dlErr.appendChild(a);
    }
  }

  async function handleDownload(opt) {
    if (!opt.url) return;
    if (store.status === "downloading" || store.status === "checking") return;
    showDlError(null);
    const prevStatus = "ready";
    setState({ status: "downloading", downloadingKey: opt.key, downloadProgress: { received: 0, total: null } });
    try {
      const { blob } = await downloadFile(opt.url, opt.filename, {
        onProgress: (received, total) => setState({ downloadProgress: { received, total } }),
      });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = opt.filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
      setState({ status: prevStatus, downloadingKey: null, downloadProgress: null, statusText: `SAVED ${opt.filename} ✓` });
    } catch (e) {
      const code = e && e.code;
      const msg = (e && e.message) || "Download failed.";
      const expired = code === "EXPIRED" || /expir/i.test(msg);
      setState({ status: "ready", downloadingKey: null, downloadProgress: null });
      showDlError(
        expired
          ? msg + " Provider file links are short-lived — press RE-FETCH for a fresh one."
          : msg + (code === "TOO_BIG" || code === "WRONG_TYPE" ? "" : " If this repeats, the link may have expired — press RE-FETCH."),
        opt.url
      );
    }
  }

  function render() {
    box.innerHTML = "";
    showDlError(null);
    const opts = store.options || [];
    const v = store.video;
    if (!v) return;
    if (v.metadataOnly) {
      const p = document.createElement("p");
      p.className = "mono-line";
      p.textContent = "No download buttons: the provider returned metadata only for this link. Try RE-FETCH, or a different video.";
      box.appendChild(p);
      return;
    }
    opts.forEach((opt) => {
      const card = document.createElement("div");
      card.className = "dl-opt" + (opt.kind === "unavailable" ? " unavail" : "");
      const left = document.createElement("div");
      const t = document.createElement("div");
      t.className = "t";
      t.textContent = opt.label;
      if (opt.kind !== "unavailable") {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = opt.kind === "audio" ? "MP3/M4A?" : "MP4";
        t.appendChild(pill);
      } else {
        const pill = document.createElement("span");
        pill.className = "pill off";
        pill.textContent = "N/A";
        t.appendChild(pill);
      }
      const s = document.createElement("div");
      s.className = "s";
      s.textContent = opt.detail;
      left.appendChild(t);
      left.appendChild(s);
      card.appendChild(left);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + (opt.kind === "unavailable" ? "ghost" : opt.key === "nowm" ? "red" : "paper") + " small";
      b.textContent = opt.kind === "unavailable" ? "UNAVAILABLE" : (store.status === "downloading" && store.downloadingKey === opt.key ? "SAVING…" : "↓ DOWNLOAD");
      b.disabled = opt.kind === "unavailable" || store.status === "downloading" || store.status === "checking";
      if (opt.kind !== "unavailable") b.addEventListener("click", () => handleDownload(opt));
      card.appendChild(b);
      box.appendChild(card);
    });
    // progress line
    if (store.status === "downloading" && store.downloadProgress) {
      const p = document.createElement("p");
      p.className = "mono-line";
      p.textContent = "SAVING… " + fmtProg(store.downloadProgress.received, store.downloadProgress.total) + " — keep this tab open.";
      box.appendChild(p);
    }
  }

  refetchBtn.addEventListener("click", () => {
    if (store.status === "checking" || store.status === "downloading") return;
    window.__tikdownRefetch && window.__tikdownRefetch();
  });
  dismissBtn.addEventListener("click", () => {
    if (store.status === "checking" || store.status === "downloading") return;
    setState({ video: null, options: [], error: null, status: "idle", statusText: "STANDBY — PASTE A LINK", demoMode: false });
  });

  return { render, showDlError };
}
