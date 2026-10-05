/* theme.js — dark/light mode toggle (works on every page) */
(() => {
  "use strict";

  const STORAGE_KEY = "theme";        // "dark" | "light"
  const ROOT = document.documentElement;

  /* ---------- Storage helpers (safely degrade in private mode) ---------- */
  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function writeStored(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
  }

  function systemPrefers() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function currentTheme() {
    return ROOT.getAttribute("data-theme") || "dark";
  }

  /* ---------- Apply theme to <html> ---------- */
  function applyTheme(theme) {
    ROOT.setAttribute("data-theme", theme);
    ROOT.style.colorScheme = theme;

    const btn = document.querySelector(".theme-toggle");
    if (btn) {
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
      btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
      btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
  }

  /* ---------- Toggle ---------- */
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    writeStored(next);
  }

  /* ---------- Build & inject the button ---------- */
  function buildButton() {
    if (document.querySelector(".theme-toggle")) return; // avoid dupes

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "Toggle color theme");
    btn.innerHTML = `
      <span class="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">☀️</span>
      <span class="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">🌙</span>
    `;
    btn.addEventListener("click", toggle);
    document.body.appendChild(btn);
  }

  /* ---------- Init ---------- */
  function init() {
    // The inline head snippet (see HTML below) already set data-theme.
    // Fall back here just in case it wasn't included.
    if (!ROOT.hasAttribute("data-theme")) {
      applyTheme(readStored() || systemPrefers());
    }
    buildButton();
    applyTheme(currentTheme()); // sync button label to current state
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---------- Follow OS changes while page is open (only if user hasn't picked) ---------- */
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e) => {
      if (readStored()) return; // user has an explicit preference — respect it
      applyTheme(e.matches ? "light" : "dark");
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange); // older Safari
  }
})();