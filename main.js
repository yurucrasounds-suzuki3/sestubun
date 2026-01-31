// =========================
//  豆まき（ARなし）iPhone安定版 main.js
//  - カメラなし
//  - 鬼固定表示（中央）
//  - どこでも長押し連射
//  - 音は「当たった時だけ」
// =========================

const oni = document.getElementById("oni");
const counterEl = document.getElementById("hit-counter");
const congratsEl = document.getElementById("congrats");
const hintEl = document.getElementById("hint");

document.addEventListener("contextmenu", (e) => e.preventDefault());

// =========================
// 設定
// =========================
let hitCount = 0;
const HIT_MAX = 9999999;
let isCongratulated = false;

const FIRE_INTERVAL = 110; // ゆっくりめで安定
const MAX_BEANS = 12;

// =========================
// 音（mp3 / HTMLAudio）
// =========================
const hitSound = new Audio("assets/hit.mp3");
hitSound.preload = "auto";
hitSound.volume = 0.55;

let audioUnlocked = false;
let audioStale = true;

function unlockAudioOnce() {
  if (audioUnlocked && !audioStale) return;
  audioUnlocked = true;
  audioStale = false;

  hitSound.currentTime = 0;
  hitSound.play()
    .then(() => {
      hitSound.pause();
      hitSound.currentTime = 0;
    })
    .catch(() => {});
}

function playHitSound() {
  try {
    hitSound.pause();
    hitSound.currentTime = 0; // 雑音あるなら 0.02 に
    hitSound.play().catch(() => {});
  } catch (e) {}
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) audioStale = true;
});
window.addEventListener("pagehide", () => (audioStale = true));
window.addEventListener("blur", () => (audioStale = true));
window.addEventListener("focus", () => (audioStale = true));

// =========================
// 「いてっ」
// =========================
const HIT_WORDS = ["いてっ", "ぐぁっ", "くっ"];
const TEXT_PROB = 0.4;

function showHitText() {
  if (Math.random() > TEXT_PROB) return;

  const rect = oni.getBoundingClientRect();
  const text = document.createElement("div");
  text.className = "hit-text";
  text.textContent = HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)];
  text.style.left = rect.left + rect.width / 2 + "px";
  text.style.top = rect.top + rect.height * 0.22 + "px";
  document.body.appendChild(text);
  setTimeout(() => text.remove(), 500);
}

// =========================
// 鬼の状態（hurt維持）
// =========================
let hurtTimer = null;

function setOniState(state) {
  oni.classList.remove("idle", "hurt");
  oni.classList.add(state);
}

function flashHurt() {
  setOniState("hurt");
  if (hurtTimer) clearTimeout(hurtTimer);
  hurtTimer = setTimeout(() => {
    setOniState("idle");
    hurtTimer = null;
  }, 140);
}

// =========================
// 鬼を中央に固定表示
// =========================
function placeOniCenter() {
  oni.classList.remove("hidden");
  oni.style.left = "50%";
  oni.style.top = "52%";
  oni.style.transform = "translate(-50%,-50%)";
  hintEl.textContent = "画面を長押しで豆連射（当たると音）";
}
placeOniCenter();

// =========================
// ヒット処理（当たった時だけ音）
// =========================
function onHit() {
  playHitSound();
  showHitText();
  flashHurt();

  if (hitCount < HIT_MAX) {
    hitCount++;
    counterEl.textContent = hitCount.toLocaleString();
    counterEl.animate(
      [
        { transform: "translateX(-50%) scale(1)" },
        { transform: "translateX(-50%) scale(1.25)" },
        { transform: "translateX(-50%) scale(1)" },
      ],
      { duration: 120, easing: "ease-out" }
    );
  }

  if (hitCount === HIT_MAX && !isCongratulated) {
    isCongratulated = true;
    congratsEl.classList.add("show");
  }
}

// =========================
// 豆プール
// =========================
const beanPool = [];
let beanIdx = 0;

function initBeanPool() {
  for (let i = 0; i < MAX_BEANS; i++) {
    const bean = document.createElement("img");
    bean.src = "assets/bean.png";
    bean.className = "bean";
    bean.style.display = "none";
    document.body.appendChild(bean);
    beanPool.push(bean);
  }
}
initBeanPool();

function getBean() {
  const bean = beanPool[beanIdx];
  beanIdx = (beanIdx + 1) % beanPool.length;
  return bean;
}

// =========================
// 豆投げ＆当たり判定
// =========================
function throwBean(x, y) {
  const bean = getBean();
  bean.style.display = "block";

  const startX = window.innerWidth * 0.5;
  const startY = window.innerHeight * 0.92;

  bean.style.left = startX + "px";
  bean.style.top = startY + "px";

  if (bean._anim) bean._anim.cancel();

  bean._anim = bean.animate(
    [
      { transform: "translate(-50%,-50%) scale(1)" },
      { transform: `translate(${x - startX - 17}px, ${y - startY - 17}px) scale(0.9)` },
    ],
    { duration: 220, easing: "ease-out", fill: "forwards" }
  );

  bean._anim.onfinish = () => {
    bean.style.display = "none";

    const rect = oni.getBoundingClientRect();
    const hit = x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
    if (hit) onHit();
  };
}

// =========================
// 長押し連射（どこでも）
// =========================
let isFiring = false;
let rafId = null;
let lastShotAt = 0;
let lastX = 0;
let lastY = 0;

function startFiringAt(x, y) {
  if (isFiring) return;
  isFiring = true;

  lastX = x;
  lastY = y;
  lastShotAt = 0;

  const loop = (t) => {
    if (!isFiring) return;
    if (lastShotAt === 0) lastShotAt = t;

    if (t - lastShotAt >= FIRE_INTERVAL) {
      throwBean(lastX, lastY);
      lastShotAt = t;
    }
    rafId = requestAnimationFrame(loop);
  };

  throwBean(lastX, lastY);
  rafId = requestAnimationFrame(loop);
}

function stopFiring() {
  isFiring = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// touch（iPhone）
document.addEventListener("touchstart", (e) => {
  e.preventDefault();
  unlockAudioOnce();

  const t = e.touches[0];
  startFiringAt(t.clientX, t.clientY);
}, { passive:false });

document.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!isFiring) return;
  const t = e.touches[0];
  lastX = t.clientX;
  lastY = t.clientY;
}, { passive:false });

document.addEventListener("touchend", (e) => {
  e.preventDefault();
  stopFiring();
}, { passive:false });

document.addEventListener("touchcancel", (e) => {
  e.preventDefault();
  stopFiring();
}, { passive:false });

// PC
document.addEventListener("pointerdown", (e) => {
  e.preventDefault?.();
  unlockAudioOnce();
  startFiringAt(e.clientX, e.clientY);
});
document.addEventListener("pointermove", (e) => {
  if (!isFiring) return;
  lastX = e.clientX;
  lastY = e.clientY;
});
document.addEventListener("pointerup", stopFiring);
document.addEventListener("pointercancel", stopFiring);
document.addEventListener("pointerleave", stopFiring);
