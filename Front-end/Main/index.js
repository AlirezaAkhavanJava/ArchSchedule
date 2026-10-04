/* script.js */

const face = document.getElementById("face");
const hourHand = document.getElementById("hourHand");
const minuteHand = document.getElementById("minuteHand");
const secondHand = document.getElementById("secondHand");
const digital = document.getElementById("digital");
const dateEl = document.getElementById("date");

/* ---------- Build the 60 tick marks ---------- */
(function buildTicks() {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < 60; i++) {
    const tick = document.createElement("div");
    tick.className = "tick";

    if (i % 5 === 0) {
      tick.classList.add("tick--hour");
    }

    tick.style.transform = `rotate(${i * 6}deg)`;
    fragment.appendChild(tick);
  }

  face.appendChild(fragment);
})();

/* ---------- Helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");

/* ---------- Smooth analog hands ---------- */
function updateHands() {
  const now = new Date();

  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  secondHand.style.transform = `rotate(${seconds * 6}deg)`;
  minuteHand.style.transform = `rotate(${minutes * 6}deg)`;
  hourHand.style.transform = `rotate(${hours * 30}deg)`;

  requestAnimationFrame(updateHands);
}

/* ---------- Digital clock + date ---------- */
function updateDigital() {
  const now = new Date();

  digital.textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  dateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ---------- Start everything ---------- */
updateDigital();
setInterval(updateDigital, 1000);

requestAnimationFrame(updateHands);