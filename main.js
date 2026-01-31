async function startCamera() {
  const video = document.getElementById("cam");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    video.srcObject = stream;
  } catch (err) {
    console.error("Camera error:", err);
    alert("カメラの許可が必要です！");
  }
}

startCamera();

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  HIT_SOUNDS.forEach(s => {
    s.play().then(() => {
      s.pause();
      s.currentTime = 0;
    }).catch(() => {});
  });
}

// =========================
// カウンター & Congratulations
// =========================
const counterEl = document.getElementById("hit-counter");
let hitCount = 0;
const HIT_MAX = 9999999;

const congratsEl = document.getElementById("congrats");
let isCongratulated = false;

// =========================
// 豆まき本体
// =========================
const oni = document.getElementById("oni");

// --- 連射設定 ---
const FIRE_INTERVAL = 90;

let isFiring = false;
let fireTimer = null;
let lastX = null;
let lastY = null;

// --- ヒット音プール ---
const HIT_SOUNDS = Array.from({ length: 8 }, () => new Audio("assets/hit.mp3"));
HIT_SOUNDS.forEach((s) => {
  s.preload = "auto";
  s.volume = 0.35;
});

let hitIndex = 0;

function playHitSound() {
  const s = HIT_SOUNDS[hitIndex];
  hitIndex = (hitIndex + 1) % HIT_SOUNDS.length;
  s.currentTime = 0;
  s.play().catch(() => {});
}

// =========================
// 「いてっ」文字
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
  text.style.top = rect.top + rect.height * 0.25 + "px";

  document.body.appendChild(text);
  setTimeout(() => text.remove(), 500);
}

// =========================
// 鬼ヒット処理
// =========================
let hurtLock = false;

function hitOni() {
  playHitSound();
  showHitText();

  // カウント
  if (hitCount < HIT_MAX) {
    hitCount++;
    counterEl.textContent = hitCount.toLocaleString();

    counterEl.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.3)" },
        { transform: "scale(1)" }
      ],
      { duration: 120, easing: "ease-out" }
    );
  }

  // Congratulations
  if (hitCount === HIT_MAX && !isCongratulated) {
    isCongratulated = true;
    congratsEl.classList.add("show");
  }

  // 見た目リアクションはロック
  if (hurtLock) return;
  hurtLock = true;

  oni.src = "assets/oni_hurt.png";
  oni.style.transform = "translateX(-50%) translateY(-10px)";

  setTimeout(() => {
    oni.src = "assets/oni_idle.png";
    oni.style.transform = "translateX(-50%)";
    hurtLock = false;
  }, 140);
}

// =========================
// 入力（長押し連射）
// =========================
document.addEventListener("pointerdown", (e) => {
  e.preventDefault?.();
  unlockAudio();
  startFiring(e);
});

document.addEventListener("pointerup", stopFiring);
document.addEventListener("pointercancel", stopFiring);
document.addEventListener("pointerleave", stopFiring);

document.addEventListener("pointermove", (e) => {
  if (!isFiring) return;
  lastX = e.clientX;
  lastY = e.clientY;
});

function startFiring(e) {
  if (isFiring) return;
  isFiring = true;

  lastX = e.clientX;
  lastY = e.clientY;

  shootAt(lastX, lastY);

  fireTimer = setInterval(() => {
    shootAt(lastX, lastY);
  }, FIRE_INTERVAL);
}

function stopFiring() {
  isFiring = false;
  if (fireTimer) clearInterval(fireTimer);
  fireTimer = null;
}

// =========================
// 豆 & 当たり判定
// =========================
function shootAt(x, y) {
  throwBean(x, y);
}

function throwBean(x, y) {
  const bean = document.createElement("img");
  bean.src = "assets/bean.png";
  bean.className = "bean";
  document.body.appendChild(bean);

  const startX = window.innerWidth / 2;
  const startY = window.innerHeight;

  bean.style.left = startX + "px";
  bean.style.top = startY + "px";

  bean.animate(
    [
      { transform: "translate(0,0)" },
      { transform: `translate(${x - startX}px, ${y - startY}px)` }
    ],
    { duration: 220, easing: "ease-out" }
  );

  setTimeout(() => {
    bean.remove();
    checkHit(x, y);
  }, 200);
}

function checkHit(x, y) {
  const rect = oni.getBoundingClientRect();
  if (
    x > rect.left &&
    x < rect.right &&
    y > rect.top &&
    y < rect.bottom
  ) {
    hitOni();
  }
}
