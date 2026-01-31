// =========================
// カメラ（疑似AR）
// =========================
async function startCamera(){
  const video = document.getElementById("cam");
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    video.srcObject = stream;
  }catch(err){
    console.error(err);
    // カメラがダメでもゲームは動く
  }
}
startCamera();

// =========================
// DOM
// =========================
const oni = document.getElementById("oni");
const counterEl = document.getElementById("hit-counter");
const congratsEl = document.getElementById("congrats");

// 右クリック/長押しメニュー抑止（保険）
document.addEventListener("contextmenu", e => e.preventDefault());

// =========================
// 設定
// =========================
let hitCount = 0;
const HIT_MAX = 9999999;
let isCongratulated = false;

const FIRE_INTERVAL = 90; // 連射速度
let isFiring = false;
let fireTimer = null;
let lastX = 0, lastY = 0;

// ヒット音（mp3プール）
const HIT_SOUNDS = Array.from({length: 8}, () => new Audio("assets/hit.mp3"));
HIT_SOUNDS.forEach(s => { s.preload="auto"; s.volume=0.35; });
let hitIndex = 0;

let audioUnlocked = false;
function unlockAudio(){
  if(audioUnlocked) return;
  audioUnlocked = true;
  // 1回だけ“解放”
  HIT_SOUNDS.forEach(s=>{
    s.play().then(()=>{
      s.pause();
      s.currentTime = 0;
    }).catch(()=>{});
  });
}

function playHitSound(){
  const s = HIT_SOUNDS[hitIndex];
  hitIndex = (hitIndex + 1) % HIT_SOUNDS.length;
  s.currentTime = 0; // まずは0推奨（雑音あるなら0.02）
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
// 鬼の状態切替（iPhoneで確実に戻る方式）
// =========================
let hurtTimer = null;
function setOniState(state){
  oni.classList.remove("idle","hurt");
  oni.classList.add(state);
}

function onHit(){
  playHitSound();
  showHitText();

  // カウント
  if(hitCount < HIT_MAX){
    hitCount++;
    counterEl.textContent = hitCount.toLocaleString();
    counterEl.animate(
      [{transform:"translateX(-50%) scale(1)"},
       {transform:"translateX(-50%) scale(1.25)"},
       {transform:"translateX(-50%) scale(1)"}],
      {duration: 120, easing:"ease-out"}
    );
  }

  if(hitCount === HIT_MAX && !isCongratulated){
    isCongratulated = true;
    congratsEl.classList.add("show");
  }

  // 見た目：当たるたびにhurt、当たらなくなったら戻る
  setOniState("hurt");
  if(hurtTimer) clearTimeout(hurtTimer);
  hurtTimer = setTimeout(()=>{
    setOniState("idle");
    hurtTimer = null;
  }, 140);
}

// =========================
// 豆投げ & 当たり判定
// =========================
function throwBean(x, y){
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
    const rect = oni.getBoundingClientRect();
    const hit = (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);
    if(hit) onHit();
  }, 200);
}

// =========================
// 入力：iPhoneで安定する touch 優先 + pointer fallback
// =========================
function startFiringAt(x, y){
  if(isFiring) return;
  isFiring = true;
  lastX = x; lastY = y;

  throwBean(lastX, lastY);

  fireTimer = setInterval(()=>{
    throwBean(lastX, lastY);
  }, FIRE_INTERVAL);
}

function stopFiring(){
  isFiring = false;
  if(fireTimer) clearInterval(fireTimer);
  fireTimer = null;
}

// iOS：touch は passive:false にしないと preventDefault が効かない
document.addEventListener("touchstart", (e)=>{
  unlockAudio();
  e.preventDefault();
  const t = e.touches[0];
  startFiringAt(t.clientX, t.clientY);
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

// pointer fallback（PCなど）
document.addEventListener("pointerdown", (e)=>{
  unlockAudio();
  e.preventDefault?.();
  startFiringAt(e.clientX, e.clientY);
});

document.addEventListener("pointermove", (e)=>{
  if(!isFiring) return;
  lastX = e.clientX;
  lastY = e.clientY;
});

document.addEventListener("pointerup", stopFiring);
document.addEventListener("pointercancel", stopFiring);
document.addEventListener("pointerleave", stopFiring);
