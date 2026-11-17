// app.js — orchestrator: Header · Hero(static) · DownloaderForm · VideoResult ·
// DownloadOptions · HowItWorks(static) · StatusBar · Footer + provider adapter.
//
// Lifecycle: idle -> checking -> ready | error ; downloading is a ready sub-state.
// Duplicate submits are dropped; stale completions are dropped by request id.
import { store, setState, subscribe } from "./state.js";
import { resolveVideo, getDownloadOptions, getProviderStatus, getDemoVideo } from "./tiktokProvider.js";
import { initHeader } from "./components/Header.js";
import { initDownloaderForm } from "./components/DownloaderForm.js";
import { renderResult, scrollToResult } from "./components/VideoResult.js";
import { initDownloadOptions } from "./components/DownloadOptions.js";
import { initStatusBar } from "./components/StatusBar.js";
import { initFooter } from "./components/Footer.js";

let formApi = null;
let dlApi = null;

async function doFetch(rawUrl) {
  if (store.status === "checking" || store.status === "downloading") return; // drop duplicates
  const id = ++store.requestId;
  setState({
    status: "checking",
    statusText: "CHECKING LINK…",
    error: null, errorCode: null,
    url: rawUrl, demoMode: false,
    provider: store.provider,
  });
  formApi.sync();
  try {
    const video = await resolveVideo(rawUrl);
    if (id !== store.requestId) return; // stale — a newer lookup won
    const options = getDownloadOptions(video);
    setState({
      status: "ready",
      statusText: video.metadataOnly ? "READY — METADATA ONLY (NO FILES)" : "READY — CHOOSE A FILE ✓",
      video, options, error: null, lastFetchAt: Date.now(),
      provider: await getProviderStatus(),
    });
  } catch (e) {
    if (id !== store.requestId) return;
    const code = (e && e.code) || "LOOKUP_FAILED";
    setState({
      status: "error",
      statusText: "FAULT — " + String(code),
      error: (e && e.message) || "Lookup failed.",
      errorCode: code,
      video: null, options: [],
      provider: await getProviderStatus(),
    });
  } finally {
    if (id === store.requestId) {
      formApi.sync();
      dlApi.render();
      renderResult();
      if (store.status === "error") formApi.showError(store.error);
      else scrollToResult();
    }
  }
}

function doDemo() {
  if (store.status === "checking" || store.status === "downloading") return;
  const video = getDemoVideo();
  setState({
    status: "ready",
    statusText: "READY — DEMO SAMPLE (NOT TIKTOK)",
    video, options: getDownloadOptions(video),
    error: null, demoMode: true, url: "demo://sample",
    lastFetchAt: Date.now(),
  });
  formApi.sync();
  dlApi.render();
  renderResult();
  scrollToResult();
}

function rerenderAll() {
  formApi.sync();
  dlApi.render();
  renderResult();
}

function boot() {
  initHeader();
  initStatusBar();
  initFooter();
  dlApi = initDownloadOptions();
  formApi = initDownloaderForm({ onFetch: doFetch, onDemo: doDemo });
  window.__tikdownRefetch = () => {
    if (store.video && store.video.demo) { doDemo(); return; }
    if (store.url && !store.url.startsWith("demo:")) doFetch(store.url);
  };
  subscribe(rerenderAll);

  // Genuine provider check on boot (lightweight oEmbed ping — no quota burn).
  getProviderStatus({ ping: true }).then((p) => setState({ provider: p }));

  setState({ status: "idle", statusText: "STANDBY — PASTE A LINK" });
  // Test hooks for the verification pass.
  window.__tikdown = { store, doFetch, doDemo, getProviderStatus };

  // Deep-link support: ?url=<tiktok link> pre-fills (never auto-fetches without gesture).
  try {
    const q = new URLSearchParams(location.search);
    const pre = q.get("url");
    if (pre) {
      const inp = document.getElementById("urlInput");
      inp.value = pre.trim();
      setState({ url: inp.value });
    }
  } catch { /* ignore */ }
}

if (document.readyState !== "loading") boot();
else document.addEventListener("DOMContentLoaded", boot);
