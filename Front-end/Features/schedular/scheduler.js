/* scheduler.js */

(() => {
  "use strict";

  /* ---------- Element references ---------- */
  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("eventForm"),
    title: $("titleInput"),
    start: $("startInput"),
    end: $("endInput"),
    category: $("categoryInput"),
    error: $("formError"),
    datePicker: $("datePicker"),
    dayLabel: $("dayLabel"),
    count: $("eventCount"),
    timeline: $("timeline"),
    empty: $("emptyState"),
    prevDay: $("prevDay"),
    nextDay: $("nextDay"),
    todayBtn: $("todayBtn"),
    clearBtn: $("clearBtn"),
  };

  const STORAGE_KEY = "scheduler.events.v1";

  /** @type {{id:string, date:string, title:string, start:string, end:string, category:string}[]} */
  let events = loadEvents();

  /* ---------- Storage ---------- */
  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveEvents() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      /* Storage unavailable (private mode / quota) — app still works this session. */
    }
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  /* ---------- Date / time helpers ---------- */
  function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(iso, delta) {
    const [y, m, d] = iso.split("-").map(Number);
    return toISO(new Date(y, m - 1, d + delta));
  }

  function prettyDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(value) {
    const [h, m] = value.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  }

  function formatHour(h) {
    const period = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12} ${period}`;
  }

  function durationText(ev) {
    const [sh, sm] = ev.start.split(":").map(Number);
    const [eh, em] = ev.end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60; // event crosses midnight
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  function hhmm(date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  }

  function setDefaultTimes() {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    els.start.value = hhmm(start);
    els.end.value = hhmm(end);
  }

  /* ---------- Form feedback ---------- */
  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = false;
  }

  function hideError() {
    els.error.hidden = true;
  }

  /* ---------- Rendering ---------- */
  function currentDay() {
    return els.datePicker.value || toISO(new Date());
  }

  function render() {
    const day = currentDay();
    els.dayLabel.textContent = prettyDate(day);

    const dayEvents = events
      .filter((ev) => ev.date === day)
      .sort((a, b) => a.start.localeCompare(b.start));

    els.count.textContent = dayEvents.length
      ? `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`
      : "";

    els.empty.hidden = dayEvents.length > 0;

    // Group events by their starting hour
    const byHour = new Map();
    for (const ev of dayEvents) {
      const hour = Number(ev.start.split(":")[0]);
      if (!byHour.has(hour)) byHour.set(hour, []);
      byHour.get(hour).push(ev);
    }

    const today = toISO(new Date());
    const nowHour = new Date().getHours();

    els.timeline.innerHTML = "";

    for (let h = 0; h < 24; h++) {
      const row = document.createElement("div");
      row.className = "hour-row";
      if (day === today && h === nowHour) row.classList.add("is-now");

      const label = document.createElement("div");
      label.className = "hour-label";
      label.textContent = formatHour(h);

      const slot = document.createElement("div");
      slot.className = "hour-slot";

      for (const ev of byHour.get(h) || []) {
        slot.appendChild(createEventCard(ev));
      }

      row.append(label, slot);
      els.timeline.appendChild(row);
    }
  }

  function createEventCard(ev) {
    const card = document.createElement("article");
    card.className = "event";
    card.dataset.category = ev.category;

    const info = document.createElement("div");
    info.className = "event-info";

    const title = document.createElement("p");
    title.className = "event-title";
    title.textContent = ev.title;

    const meta = document.createElement("p");
    meta.className = "event-meta";
    meta.textContent = `${formatTime(ev.start)} – ${formatTime(ev.end)} · ${durationText(
      ev
    )}`;

    info.append(title, meta);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Delete ${ev.title}`);
    del.addEventListener("click", () => {
      events = events.filter((item) => item.id !== ev.id);
      saveEvents();
      render();
    });

    card.append(info, del);
    return card;
  }

  /* ---------- Scrolling ---------- */
  function scrollToRelevantHour() {
    const day = currentDay();
    const isToday = day === toISO(new Date());
    const hour = isToday ? new Date().getHours() : 7;
    const row = els.timeline.children[hour];
    if (row) {
      els.timeline.scrollTop = Math.max(
        0,
        row.offsetTop - els.timeline.clientHeight / 3
      );
    }
  }

  /* ---------- Event handlers ---------- */
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = els.title.value.trim();
    const start = els.start.value;
    const end = els.end.value;

    if (!title) return showError("Please add a title.");
    if (!start || !end) return showError("Please pick a start and end time.");
    if (start === end) return showError("Start and end time cannot be the same.");

    events.push({
      id: uid(),
      date: currentDay(),
      title,
      start,
      end,
      category: els.category.value,
    });

    saveEvents();
    els.form.reset();
    setDefaultTimes();
    hideError();
    render();
    els.title.focus();
  });

  [els.title, els.start, els.end].forEach((field) =>
    field.addEventListener("input", hideError)
  );

  els.prevDay.addEventListener("click", () => {
    els.datePicker.value = addDays(currentDay(), -1);
    hideError();
    render();
  });

  els.nextDay.addEventListener("click", () => {
    els.datePicker.value = addDays(currentDay(), 1);
    hideError();
    render();
  });

  els.todayBtn.addEventListener("click", () => {
    els.datePicker.value = toISO(new Date());
    hideError();
    render();
    scrollToRelevantHour();
  });

  els.datePicker.addEventListener("change", () => {
    hideError();
    render();
  });

  els.clearBtn.addEventListener("click", () => {
    const day = currentDay();
    const dayEvents = events.filter((ev) => ev.date === day);
    if (!dayEvents.length) return;

    const ok = window.confirm(
      `Remove ${dayEvents.length} event(s) from ${prettyDate(day)}?`
    );
    if (!ok) return;

    events = events.filter((ev) => ev.date !== day);
    saveEvents();
    render();
  });

  /* ---------- Init ---------- */
  function init() {
    els.datePicker.value = toISO(new Date());
    setDefaultTimes();
    render();
    scrollToRelevantHour();
  }

  init();
})();