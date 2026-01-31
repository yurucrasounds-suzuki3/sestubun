// =========================
// カメラ（軽量設定：低スペ端末も意識）
// =========================
async function startCamera(){
  const video = document.getElementById("cam");
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width:  { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24, max: 30 }
      },
      audio: false
    });
    video.srcObject = stream;
  }catch(err){
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
document.addEventListener("contextmenu", e => e.preventDefault());

// =========================
// 設定
// =========================
let hitCount = 0;
const HIT_MAX = 9999999;
let isCongratulated = false;

const FIRE_INTERVAL = 90; // 連射速度

// 豆数上限（低スペ端末の詰まり防止）
let beansInFlight = 0;
const MAX_BEANS = 12;

// =========================
// 音（iPhone: ユーザー操作でunlock必須）
// =========================
const HIT_SOUNDS = Array.from({ length: 8 }, () => new Audio("assets/hit.mp3"));
HIT_SOUNDS.forEach(s => { s.preload="auto"; s.volume=0.35; });
let hitIndex = 0;

let audioUnlocked = false;
function unlockAudio(){
  if(audioUnlocked) return;
  audioUnlocked = true;
  HIT_SOUNDS.forEach(s=>{
    s.play().then(()=>{ s.pause(); s.currentTime = 0; }).catch(()=>{});
  });
}

function playHitSound(){
  const s = HIT_SOUNDS[hitIndex];
  hitIndex = (hitIndex + 1) % HIT_SOUNDS.length;
  s.currentTime = 0;
  s.play().catch(()=>{});
}

// =========================
// 「いてっ」
// =========================
const HIT_WORDS = ["いてっ","ぐぁっ","くっ"];
const TEXT_PROB = 0.4;

function showHitText(){
  if(Math.random() > TEXT_PROB) return;
  const rect = oni.getBoundingClientRect();
  const text = document.createElement("div");
  text.className = "hit-text";
  text.textContent = HIT_WORDS[Math.floor(Math.random()*HIT_WORDS.length)];
  text.style.left = (rect.left + rect.width/2) + "px";
  text.style.top  = (rect.top  + rect.height*0.22) + "px";
  document.body.appendChild(text);
  setTimeout(()=>text.remove(), 500);
}

// =========================
// 鬼の状態切替（当たり続けたらhurt維持）
// =========================
let hurtTimer = null;
function setOniState(state){
  oni.classList.remove("idle","hurt");
  oni.classList.add(state);
}

function flashHurt(){
  setOniState("hurt");
  if(hurtTimer) clearTimeout(hurtTimer);
  hurtTimer = setTimeout(()=>{
    setOniState("idle");
    hurtTimer = null;
  }, 140);
}

// =========================
// ヒット処理
// =========================
function onHit(){
  playHitSound();
  showHitText();
  flashHurt();

  if(hitCount < HIT_MAX){
    hitCount++;
    counterEl.textContent = hitCount.toLocaleString();
    counterEl.animate(
      [{transform:"translateX(-50%) scale(1)"},
       {transform:"translateX(-50%) scale(1.25)"},
       {transform:"translateX(-50%) scale(1)"}],
      {duration:120, easing:"ease-out"}
    );
  }

  if(hitCount === HIT_MAX && !isCongratulated){
    isCongratulated = true;
    congratsEl.classList.add("show");
  }
}

// =========================
// 鬼の出現：画面タップで置く（マーカー不要）
// =========================
let oniPlaced = false;

function placeOniAt(x, y){
  oni.classList.remove("hidden");
  // 画面中心基準で配置
  oni.style.left = x + "px";
  oni.style.top  = y + "px";
  oni.style.transform = "translate(-50%,-50%)";
  oniPlaced = true;

  // ヒントを薄く
  hintEl.textContent = "鬼を長押しで豆連射";
}

// =========================
// 豆投げ＆当たり判定
// =========================
function throwBean(x, y){
  if(!oniPlaced) return;
  if(beansInFlight >= MAX_BEANS) return;
  beansInFlight++;

  const bean = document.createElement("img");
  bean.src = "assets/bean.png";
  bean.className = "bean";
  document.body.appendChild(bean);

  const startX = window.innerWidth * 0.5;
  const startY = window.innerHeight * 0.92;

  bean.style.left = startX + "px";
  bean.style.top  = startY + "px";

  bean.animate(
    [
      { transform: "translate(-50%,-50%) scale(1)" },
      { transform: `translate(${x-startX-17}px, ${y-startY-17}px) scale(0.9)` }
    ],
    { duration: 220, easing: "ease-out" }
  );

  setTimeout(()=>{
    bean.remove();
    beansInFlight--;

    const rect = oni.getBoundingClientRect();
    const hit = (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);
    if(hit) onHit();
  }, 200);
}

// =========================
// 長押し連射：鬼を押してる間だけ撃つ
// =========================
let isFiring = false;
let rafId = null;
let lastShotAt = 0;
let lastX = 0, lastY = 0;

function startFiringAt(x, y){
  if(!oniPlaced) return;
  if(isFiring) return;
  isFiring = true;

  lastX = x; lastY = y;
  lastShotAt = 0;

  const loop = (t) => {
    if(!isFiring) return;
    if(lastShotAt === 0) lastShotAt = t;

    if(t - lastShotAt >= FIRE_INTERVAL){
      throwBean(lastX, lastY);
      lastShotAt = t;
    }
    rafId = requestAnimationFrame(loop);
  };

  // 押した瞬間の一発
  throwBean(lastX, lastY);
  rafId = requestAnimationFrame(loop);
}

function stopFiring(){
  isFiring = false;
  if(rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// =========================
// 入力：iPhone安定（touch優先）
// =========================
function isOnOni(x, y){
  if(!oniPlaced) return false;
  const rect = oni.getBoundingClientRect();
  return (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);
}

// 画面タップ：鬼が未配置なら置く
document.addEventListener("touchstart", (e)=>{
  unlockAudio();
  e.preventDefault();
  const t = e.touches[0];
  const x = t.clientX, y = t.clientY;

  if(!oniPlaced){
    placeOniAt(x, y);
    return;
  }

  // 鬼の上なら長押し連射開始
  if(isOnOni(x, y)){
    startFiringAt(x, y);
  }
}, {passive:false});

document.addEventListener("touchmove", (e)=>{
  e.preventDefault();
  if(!isFiring) return;
  const t = e.touches[0];
  lastX = t.clientX;
  lastY = t.clientY;
}, {passive:false});

document.addEventListener("touchend", (e)=>{
  e.preventDefault();
  stopFiring();
}, {passive:false});

document.addEventListener("touchcancel", (e)=>{
  e.preventDefault();
  stopFiring();
}, {passive:false});

// pointer fallback（PC）
document.addEventListener("pointerdown", (e)=>{
  unlockAudio();
  e.preventDefault?.();

  const x = e.clientX, y = e.clientY;

  if(!oniPlaced){
    placeOniAt(x, y);
    return;
  }
  if(isOnOni(x, y)){
    startFiringAt(x, y);
  }
});
document.addEventListener("pointermove", (e)=>{
  if(!isFiring) return;
  lastX = e.clientX;
  lastY = e.clientY;
});
document.addEventListener("pointerup", stopFiring);
document.addEventListener("pointercancel", stopFiring);
document.addEventListener("pointerleave", stopFiring);
