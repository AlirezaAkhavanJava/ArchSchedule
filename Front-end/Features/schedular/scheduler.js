/* scheduler.js */

(() => {
  "use strict";

  /* ---------- Element references ---------- */
  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("eventForm"),
    title: $("titleInput"),
    description: $("descriptionInput"),
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
    // bulk / repeat
    repeatPattern: $("repeatPattern"),
    repeatInterval: $("repeatInterval"),
    repeatUnit: $("repeatUnit"),
    repeatUntil: $("repeatUntil"),
    repeatUntilRow: $("repeatUntilRow"),
    intervalRow: $("intervalRow"),
    repeatPreview: $("repeatPreview"),
  };

  const STORAGE_KEY = "scheduler.events.v1";
  const MAX_OCCURRENCES = 500;

  /**
   * @type {{
   *   id: string,
   *   date: string,
   *   title: string,
   *   description: string,
   *   start: string,
   *   end: string,
   *   category: string,
   *   seriesId: string | null,
   *   repeat: object | null
   * }[]}
   */
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

  /* ---------- Bulk / repeat engine ---------- */
  function dowOf(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).getDay(); // 0 = Sunday
  }

  function stepDate(iso, pattern, interval, unit) {
    if (pattern === "weekly") return addDays(iso, 7);
    if (pattern === "custom") {
      return addDays(iso, unit === "week" ? interval * 7 : interval);
    }
    return addDays(iso, 1); // daily + weekday
  }

  /**
   * Returns every occurrence date (ISO yyyy-mm-dd) from startISO up to and
   * including untilISO. Stops early once MAX_OCCURRENCES + 1 is reached so the
   * caller can detect "too many".
   */
  function buildOccurrences(startISO, pattern, interval, unit, untilISO) {
    const dates = [];
    let cursor = startISO;
    let steps = 0;

    while (
      cursor <= untilISO &&
      dates.length <= MAX_OCCURRENCES &&
      steps < 5000
    ) {
      if (pattern === "weekday") {
        const dow = dowOf(cursor);
        if (dow !== 0 && dow !== 6) dates.push(cursor);
      } else {
        dates.push(cursor);
      }

      cursor = stepDate(cursor, pattern, interval, unit);
      steps++;
    }

    return dates;
  }

  function readRepeatRule() {
    const pattern = els.repeatPattern.value;
    if (pattern === "none") return null;

    const interval = Math.min(
      30,
      Math.max(1, Number(els.repeatInterval.value) || 1)
    );

    return {
      pattern,
      interval,
      unit: els.repeatUnit.value,
      until: els.repeatUntil.value || addDays(currentDay(), 60),
    };
  }

  /* ---------- Repeat UI ---------- */
  function updateRepeatUI() {
    const pattern = els.repeatPattern.value;
    const repeating = pattern !== "none";

    els.intervalRow.hidden = pattern !== "custom";
    els.repeatUntilRow.hidden = !repeating;
    els.repeatPreview.hidden = !repeating;

    if (!repeating) return;

    const baseDate = currentDay();
    const rule = readRepeatRule();

    if (rule.until < baseDate) {
      els.repeatPreview.textContent = "End date is before the start date.";
      return;
    }

    const count = buildOccurrences(
      baseDate,
      rule.pattern,
      rule.interval,
      rule.unit,
      rule.until
    ).length;

    if (count > MAX_OCCURRENCES) {
      els.repeatPreview.textContent = `⚠ More than ${MAX_OCCURRENCES} events — shorten the range.`;
    } else {
      els.repeatPreview.textContent = `Creates ${count} event${
        count === 1 ? "" : "s"
      } · ${prettyDate(baseDate)} → ${prettyDate(rule.until)}`;
    }
  }

  function resetRepeatUI() {
    els.repeatUntil.min = currentDay();
    els.repeatUntil.value = addDays(currentDay(), 60);
    updateRepeatUI();
  }

  /* Keep the repeat window sane when the day changes */
  function syncRepeatDates() {
    const day = currentDay();
    els.repeatUntil.min = day;
    if (!els.repeatUntil.value || els.repeatUntil.value < day) {
      els.repeatUntil.value = addDays(day, 60);
    }
    updateRepeatUI();
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

    if (ev.seriesId) {
      const badge = document.createElement("span");
      badge.className = "event-badge";
      badge.textContent = "🔁";
      badge.title = "Repeating event";
      title.appendChild(badge);
    }

    title.appendChild(document.createTextNode(ev.title));
    info.appendChild(title);

    if (ev.description) {
      const desc = document.createElement("p");
      desc.className = "event-desc";
      desc.textContent = ev.description;
      info.appendChild(desc);
    }

    const meta = document.createElement("p");
    meta.className = "event-meta";
    meta.textContent = `${formatTime(ev.start)} – ${formatTime(ev.end)} · ${durationText(
      ev
    )}`;
    info.appendChild(meta);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Delete ${ev.title}`);

    del.addEventListener("click", () => {
      if (ev.seriesId) {
        const total = events.filter((e) => e.seriesId === ev.seriesId).length;
        const deleteAll = window.confirm(
          `"${ev.title}" repeats (${total} occurrence${total === 1 ? "" : "s"}).\n\nOK = delete the whole series\nCancel = delete only this one`
        );
        events = deleteAll
          ? events.filter((e) => e.seriesId !== ev.seriesId)
          : events.filter((e) => e.id !== ev.id);
      } else {
        events = events.filter((e) => e.id !== ev.id);
      }
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
    const description = els.description.value.trim();
    const start = els.start.value;
    const end = els.end.value;
    const baseDate = currentDay();
    const rule = readRepeatRule();

    if (!title) return showError("Please add a title.");
    if (!start || !end) return showError("Please pick a start and end time.");
    if (start === end) return showError("Start and end time cannot be the same.");

    let dates = [baseDate];

    if (rule) {
      if (rule.until < baseDate) {
        return showError("The repeat end date can't be before the start date.");
      }

      dates = buildOccurrences(
        baseDate,
        rule.pattern,
        rule.interval,
        rule.unit,
        rule.until
      );

      if (!dates.length) return showError("That repeat rule produces no events.");
      if (dates.length > MAX_OCCURRENCES) {
        return showError(
          `That rule creates more than ${MAX_OCCURRENCES} events — shorten the range.`
        );
      }
    }

    const seriesId = rule ? uid() : null;

    for (const date of dates) {
      events.push({
        id: uid(),
        date,
        title,
        description,
        start,
        end,
        category: els.category.value,
        seriesId,
        repeat: rule,
      });
    }

    saveEvents();
    els.form.reset();
    setDefaultTimes();
    resetRepeatUI();
    hideError();
    render();
    els.title.focus();
  });

  [
    els.title,
    els.start,
    els.end,
    els.repeatPattern,
    els.repeatInterval,
    els.repeatUnit,
    els.repeatUntil,
  ].forEach((field) => {
    field.addEventListener("input", () => {
      hideError();
      updateRepeatUI();
    });
    field.addEventListener("change", () => {
      hideError();
      updateRepeatUI();
    });
  });

  els.prevDay.addEventListener("click", () => {
    els.datePicker.value = addDays(currentDay(), -1);
    syncRepeatDates();
    hideError();
    render();
  });

  els.nextDay.addEventListener("click", () => {
    els.datePicker.value = addDays(currentDay(), 1);
    syncRepeatDates();
    hideError();
    render();
  });

  els.todayBtn.addEventListener("click", () => {
    els.datePicker.value = toISO(new Date());
    syncRepeatDates();
    hideError();
    render();
    scrollToRelevantHour();
  });

  els.datePicker.addEventListener("change", () => {
    syncRepeatDates();
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
    resetRepeatUI();
    render();
    scrollToRelevantHour();
  }

  init();
})();