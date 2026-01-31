// =========================
// カメラ（軽量設定：低スペ端末も意識）
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

// 長押しメニュー抑止（保険）
document.addEventListener("contextmenu", (e) => e.preventDefault());

// =========================
// 設定
// =========================
let hitCount = 0;
const HIT_MAX = 9999999;
let isCongratulated = false;

const FIRE_INTERVAL = 140; // 連射速度（重い端末なら 100〜120推奨）
const MAX_BEANS = 10;     // 同時豆数（端末が弱いなら 8〜10）

// =========================
// 音：WebAudio（iPhoneで途切れにくい）
// =========================
let audioCtx = null;
let hitBuffer = null;
let hitGain = null;
let audioReady = false;

async function initWebAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  hitGain = audioCtx.createGain();
  hitGain.gain.value = 0.6; // 0.4〜0.9で調整
  hitGain.connect(audioCtx.destination);

  const res = await fetch("assets/hit.mp3");
  const arr = await res.arrayBuffer();
  hitBuffer = await audioCtx.decodeAudioData(arr);
  audioReady = true;
}

async function unlockAudio() {
  try {
    await initWebAudio();
    if (audioCtx && audioCtx.state !== "running") await audioCtx.resume();
  } catch (e) {
    // 音が使えない環境でもゲームは動かす
  }
}

function playHitSound() {
  if (!audioCtx || !audioReady || !hitBuffer || audioCtx.state !== "running") return;

  const src = audioCtx.createBufferSource();
  src.buffer = hitBuffer;
  src.connect(hitGain);
  src.start(0);
}

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
// 鬼の状態切替（当たり続けたらhurt維持）
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
// ヒット処理
// ※ iPhoneで気持ちよくするコツ：
//   - 連射中の「パシッ音」は “投げた瞬間” に鳴らす
//   - onHit() は当たりの演出（いてっ/痛い画像/カウント）に集中
// =========================
function onHit() {
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
// 鬼の出現：画面タップで置く（マーカー不要）
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
// 豆プール（DOM生成をやめる → 連射が気持ちよくなる）
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

  // 既存アニメが走ってたら止めて再利用（詰まり防止）
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
// 長押し連射：鬼を押してる間だけ撃つ（rAF）
// =========================
let isFiring = false;
let rafId = null;
let lastShotAt = 0;
let lastX = 0,
  lastY = 0;

function startFiringAt(x, y) {
  if (!oniPlaced) return;
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

      // ★ ここが肝：投げた瞬間に鳴らすと “だーーー” が安定
      playHitSound();

      lastShotAt = t;
    }
    rafId = requestAnimationFrame(loop);
  };

  // 押した瞬間の一発（音も鳴らす）
  throwBean(lastX, lastY);
  playHitSound();

  rafId = requestAnimationFrame(loop);
}

function stopFiring() {
  isFiring = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// =========================
// 入力：iPhone安定（touch優先）
// =========================
function isOnOni(x, y) {
  if (!oniPlaced) return false;
  const rect = oni.getBoundingClientRect();
  return x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
}

// 画面タップ：鬼が未配置なら置く
document.addEventListener(
  "touchstart",
  async (e) => {
    e.preventDefault();

    // ★最重要：ユーザー操作中に音を解放
    await unlockAudio();

    const t = e.touches[0];
    const x = t.clientX,
      y = t.clientY;

    if (!oniPlaced) {
      placeOniAt(x, y);
      return;
    }

    // 鬼の上なら長押し連射開始
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

// pointer fallback（PC）
document.addEventListener("pointerdown", async (e) => {
  e.preventDefault?.();
  await unlockAudio();

  const x = e.clientX,
    y = e.clientY;

  if (!oniPlaced) {
    placeOniAt(x, y);
    return;
  }
  if (isOnOni(x, y)) {
    startFiringAt(x, y);
  }
});

document.addEventListener("pointermove", (e) => {
  if (!isFiring) return;
  lastX = e.clientX;
  lastY = e.clientY;
});
document.addEventListener("pointerup", stopFiring);
document.addEventListener("pointercancel", stopFiring);
document.addEventListener("pointerleave", stopFiring);
