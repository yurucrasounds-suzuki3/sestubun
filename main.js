// =========================
//  豆まきAR（マーカーなし）iPhone安定版 main.js（mp3/HTMLAudio）
//  - カメラ軽量
//  - 豆プール（DOM生成しない）
//  - 音は mp3（HTMLAudio）に戻す：最優先で「鳴る」
//  - バックグラウンド後に無音になったら次タップで復帰
//  - 連射は安定優先（ゆっくり）
// =========================

// =========================
// カメラ（軽量）
// =========================
async function startCamera() {
  const video = document.getElementById("cam");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });
    video.srcObject = stream;
  } catch (err) {
    console.error(err);
  }
}
startCamera();

// =========================
// DOM
// =========================
const oni = document.getElementById("oni");
const counterEl = document.getElementById("hit-counter");
const congratsEl = document.getElementById("congrats");
const hintEl = document.getElementById("hint");

// 右クリック/長押しメニュー抑止（保険）
document.addEventListener("contextmenu", (e) => e.preventDefault());

// =========================
// ゲーム設定
// =========================
let hitCount = 0;
const HIT_MAX = 9999999;
let isCongratulated = false;

// 連射は“安定優先”
const FIRE_INTERVAL = 130;

// 同時豆数（端末が弱いなら 8）
const MAX_BEANS = 6;

// 音：毎回鳴らすとiPhoneが詰まる端末があるので間引く
// 1=毎回 / 2=2回に1回 / 3=3回に1回
const SOUND_DIVIDER = 1;

// =========================
// 音（mp3 / HTMLAudio：とにかく鳴る方）
// =========================
const hitSound = new Audio("assets/hit.mp3");
hitSound.preload = "auto";
hitSound.volume = 0.55;

let audioUnlocked = false;
let audioStale = true; // バックグラウンド等で「また解放が必要」になることがある

function unlockAudioOnce() {
  if (audioUnlocked && !audioStale) return;

  // 「初回 or stale のときだけ」実行
  audioUnlocked = true;
  audioStale = false;

  // iPhone Safari対策：ユーザー操作中に一度再生→停止して解放
  // 失敗してもOK（次のタップでまた試す）
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
    // 連打でも崩れにくい形（同時再生はしない）
    hitSound.pause();
    hitSound.currentTime = 0;
    hitSound.play().catch(() => {});
  } catch (e) {}
}

// バックグラウンド等で無音化したら「次タップで再解放」させる
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audioStale = true;
});
window.addEventListener("pagehide", () => (audioStale = true));
window.addEventListener("blur", () => (audioStale = true));
window.addEventListener("focus", () => (audioStale = true));

// =========================
// UI：いてっ
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
// ヒット処理（演出）
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
// 鬼の出現（タップで置く）
// =========================
let oniPlaced = false;

function placeOniAt(x, y) {
  oni.classList.remove("hidden");
  oni.style.left = x + "px";
  oni.style.top = y + "px";
  oni.style.transform = "translate(-50%,-50%)";
  oniPlaced = true;
  hintEl.textContent = "鬼を長押しで豆連射";
}

// =========================
// 豆プール（使い回し）
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
  if (!oniPlaced) return;

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
    { duration: 200, easing: "ease-out", fill: "forwards" }
  );

  bean._anim.onfinish = () => {
    bean.style.display = "none";

    const rect = oni.getBoundingClientRect();
    const hit = x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
    if (hit) onHit();
  };
}

// =========================
// 長押し連射（rAF + 安定間隔）
// =========================
let isFiring = false;
let rafId = null;
let lastShotAt = 0;
let lastX = 0;
let lastY = 0;
let soundTick = 0;

function startFiringAt(x, y) {
  if (!oniPlaced) return;
  if (isFiring) return;
  isFiring = true;

  lastX = x;
  lastY = y;
  lastShotAt = 0;
  soundTick = 0;

  const loop = (t) => {
    if (!isFiring) return;
    if (lastShotAt === 0) lastShotAt = t;

    if (t - lastShotAt >= FIRE_INTERVAL) {
      throwBean(lastX, lastY);

      // ★音は間引く（iPhone安定）
      if ((soundTick++ % SOUND_DIVIDER) === 0) {
      }

      lastShotAt = t;
    }
    rafId = requestAnimationFrame(loop);
  };

  // 押した瞬間の一発
  throwBean(lastX, lastY);
  

  rafId = requestAnimationFrame(loop);
}

function stopFiring() {
  isFiring = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// =========================
// 入力（touch優先）
// =========================
function isOnOni(x, y) {
  if (!oniPlaced) return false;
  const rect = oni.getBoundingClientRect();
  return x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
}

document.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();

    // ★毎回：音の解放（無音化したら次タップで復活）
    unlockAudioOnce();

    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    if (!oniPlaced) {
      placeOniAt(x, y);
      return;
    }

    if (isOnOni(x, y)) {
      startFiringAt(x, y);
    }
  },
  { passive: false }
);

document.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    if (!isFiring) return;
    const t = e.touches[0];
    lastX = t.clientX;
    lastY = t.clientY;
  },
  { passive: false }
);

document.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    stopFiring();
  },
  { passive: false }
);

document.addEventListener(
  "touchcancel",
  (e) => {
    e.preventDefault();
    stopFiring();
  },
  { passive: false }
);

// PC fallback
document.addEventListener("pointerdown", (e) => {
  e.preventDefault?.();
  unlockAudioOnce();

  const x = e.clientX;
  const y = e.clientY;

  if (!oniPlaced) {
    placeOniAt(x, y);
    return;
  }
 startFiringAt(x, y);
});

document.addEventListener("pointermove", (e) => {
  if (!isFiring) return;
  lastX = e.clientX;
  lastY = e.clientY;
});
document.addEventListener("pointerup", stopFiring);
document.addEventListener("pointercancel", stopFiring);
document.addEventListener("pointerleave", stopFiring);
