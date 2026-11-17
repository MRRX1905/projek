// state.js — single UI store for the TikDown lookup lifecycle.
// idle -> checking -> ready | error ; downloading is a sub-state of ready.

export const store = {
  url: "",
  status: "idle", // idle|checking|ready|error|downloading
  statusText: "STANDBY — PASTE A LINK",
  video: null,
  options: [],
  error: null,
  errorCode: null,
  downloadingKey: null,
  downloadProgress: null, // {received, total}
  provider: { online: null, label: "UNCHECKED", at: 0, detail: "" },
  demoMode: false,
  requestId: 0,
  lastFetchAt: 0,
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { listeners.forEach((f) => { try { f(store); } catch (e) { console.error(e); } }); }
export function setState(patch) { Object.assign(store, patch); emit(); }
