// =========================
//  豆まき（ARなし）iPhone安定版 main.js 完全版
//  - カメラなし
//  - 鬼固定表示（中央）
//  - どこでも長押し連射（指位置追従）
//  - 当たった時だけ音（iPhoneで死ににくい：2音交互 + 間引き）
//  - 豆プール（軽量）
//  - 当たり判定は即（体感遅延ゼロ）
//  - いてっ/痛がり/カウント/9999999でCongrats
// =========================

const oni = document.getElementById("oni");
const counterEl = document.getElementById("hit-counter");
const congratsEl = document.getElementById("congrats");
const hintEl = document.getElementById("hint");

// 右クリック/長押しメニュー抑止（保険）
document.addEventListener("contextmenu", (e) => e.preventDefault());

// iOSの選択・長押し周りを減らす（CSSも後述推奨）
document.body.style.webkitUserSelect = "none";
document.body.style.userSelect = "none";

// =========================
// 設定
// =========================
let hitCount = 0;
const HIT_MAX = 9999999;
let isCongratulated = false;

// 連射テンポ（iPhoneで気持ちいい＆安定帯）
const FIRE_INTERVAL = 130;

// 豆数（軽量）
const MAX_BEANS = 8;

// 音を鳴らす頻度（1=毎回, 2=2回に1回, 3=3回に1回）
const SOUND_DIVIDER = 1;

// =========================
// 音（mp3 / HTMLAudio）
//  - 2音交互：長押し連射でも死ににくい
//  - pause() しない
// =========================
const hitSounds = [
  new Audio("assets/hit.mp3"),
  new Audio("assets/hit.mp3"),
];

hitSounds.forEach((s) => {
  s.preload = "auto";
  s.volume = 0.55;
});

let soundIndex = 0;
let audioUnlocked = false;
let audioStale = true;

// 初回タップで音を解放（PWA/Safari対策）
function unlockAudioOnce() {
  if (audioUnlocked && !audioStale) return;

  audioUnlocked = true;
  audioStale = false;

  // 2つとも一度だけ “短く再生→停止” して解放
  hitSounds.forEach((s) => {
    try {
      s.currentTime = 0;
      s.play()
        .then(() => {
          s.pause();
          s.currentTime = 0;
        })
        .catch(() => {});
    } catch (e) {}
  });
}

// バックグラウンド等で無音化したら、次タップで再解放
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audioStale = true;
});
window.addEventListener("pagehide", () => (audioStale = true));
window.addEventListener("blur", () => (audioStale = true));
window.addEventListener("focus", () => (audioStale = true));

function playHitSound() {
  const s = hitSounds[soundIndex];
  soundIndex = (soundIndex + 1) % hitSounds.length;

  try {
    // 雑音あるなら 0.02 にしてもOK
    s.currentTime = 0;
    s.play().catch(() => {});
  } catch (e) {}
}

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
// 鬼を中央に固定表示
// =========================
function placeOniCenter() {
  oni.classList.remove("hidden");
  oni.style.left = "50%";
  oni.style.top = "52%";
  oni.style.transform = "translate(-50%,-50%)";
  hintEl.textContent = "豆を投げろ！鬼は外！福は内！";
}
placeOniCenter();

// =========================
// ヒット処理（当たった時だけ音）
// =========================
let soundTick = 0;

function onHit() {
  // 音は間引く（iPhone安定）
  if ((soundTick++ % SOUND_DIVIDER) === 0) {
    playHitSound();
  }

  showHitText();
  flashHurt();

  if (hitCount < HIT_MAX) {
    hitCount++;
    counterEl.textContent = hitCount.toLocaleString();

    // カウンターぷるん
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
// 豆プール（軽量）
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
// 豆投げ（当たり判定は“即”）
// =========================
function throwBean(x, y) {
  const bean = getBean();
  bean.style.display = "block";

  const startX = window.innerWidth * 0.5;
  const startY = window.innerHeight * 0.92;

  bean.style.left = startX + "px";
  bean.style.top = startY + "px";

  // ★当たり判定は即（遅延ゼロっぽく）
  const rect = oni.getBoundingClientRect();
  const hit = x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
  if (hit) onHit();

  if (bean._anim) bean._anim.cancel();

  bean._anim = bean.animate(
    [
      { transform: "translate(-50%,-50%) scale(1)" },
      { transform: `translate(${x - startX}px, ${y - startY}px) scale(0.85)` },
    ],
    { duration: 160, easing: "linear", fill: "forwards" }
  );

  bean._anim.onfinish = () => {
    bean.style.display = "none";
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

  // 押した瞬間の1発
  throwBean(lastX, lastY);
  rafId = requestAnimationFrame(loop);
}

function stopFiring() {
  isFiring = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// =========================
// 入力（touch優先：iPhone）
// =========================
document.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    unlockAudioOnce();

    const t = e.touches[0];
    startFiringAt(t.clientX, t.clientY);
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
