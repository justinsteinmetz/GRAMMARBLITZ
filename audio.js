// ── AUDIO ENGINE — CLOCKED ARCADE SYNTH ──────────────────

let ctx;
let master, musicBus, sfxBus;
let unlocked = false;
let muted = localStorage.getItem('gb_muted') === 'true';

const LOOKAHEAD      = 25;
const SCHEDULE_AHEAD = 0.1;

let tempo        = 120;
let nextNoteTime = 0;
let step         = 0;
let timerID      = null;
let variation    = false;

// ── CONTEXT ──────────────────────────────────────────────
function getCtx(){
  if(!ctx){
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master   = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus   = ctx.createGain();

    musicBus.gain.value = 0.6;
    sfxBus.gain.value   = 0.9;
    master.gain.value   = muted ? 0 : 1;

    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function isMuted(){ return muted; }

export function toggleMute(){
  muted = !muted;
  localStorage.setItem('gb_muted', muted);
  if(master) master.gain.value = muted ? 0 : 1;
  return muted;
}

export function setTempo(t){
  tempo = Math.max(80, Math.min(200, t));
}

function unlock(){
  if(unlocked) return;
  unlocked = true;
  getCtx().resume();
}
document.addEventListener('pointerdown', unlock, { once:true });

// ── SYNTH BUILDERS ───────────────────────────────────────
// Layered osc with slight detune for warmth
function osc(type, freq, t, dur, vol, bus){
  const c  = getCtx();
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  const g  = c.createGain();

  o1.type = type;
  o2.type = type;
  o1.frequency.setValueAtTime(freq, t);
  o2.frequency.setValueAtTime(freq * 1.008, t); // slight detune

  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);

  o1.connect(g);
  o2.connect(g);
  g.connect(bus || sfxBus);

  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
}

function noise(t, dur, vol){
  const c      = getCtx();
  const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data   = buffer.getChannelData(0);
  for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  const g   = c.createGain();
  src.buffer = buffer;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(g);
  g.connect(sfxBus);
  src.start(t);
}

// ── DRUMS ────────────────────────────────────────────────
function kick(t){
  // Tonal body + punch
  osc('sine', 120, t,      0.10, 0.40, musicBus);
  osc('sine',  60, t,      0.12, 0.50, musicBus);
  noise(t, 0.04, 0.12); // transient click
}

function snare(t){
  noise(t, 0.05, 0.22);
  osc('triangle', 200, t, 0.04, 0.12, musicBus);
}

function hihat(t){
  noise(t, 0.02, 0.08);
}

// ── PATTERNS ─────────────────────────────────────────────
// Moon Patrol flavour: chromatic walk + call/response lead
const BASS = [55,55,58,55,  65,65,62,60,  55,55,58,55,  48,50,52,53];

const LEAD = [
  null,659,null,587,
  523, null,494,null,
  null,659,null,587,
  523, null,440,null
];

function scheduleStep(i, t){
  // Variation flag flips each loop
  if(i === 0) variation = Math.random() > 0.5;

  // Bass: sawtooth body + square sub for weight
  const b = BASS[i % BASS.length];
  if(b){
    osc('sawtooth', b,   t, 0.18, 0.22, musicBus);
    osc('square',   b/2, t, 0.18, 0.12, musicBus);
  }

  // Lead
  const l = LEAD[i % LEAD.length];
  if(l){
    osc('square', l, t, 0.10, 0.12, musicBus);
    // Variation: add upper harmony every other loop
    if(variation) osc('triangle', l * 1.5, t, 0.08, 0.07, musicBus);
  }

  // Drums
  if(i % 4 === 0) kick(t);
  if(i % 8 === 4) snare(t);
  if(i % 2 === 1) hihat(t);
}

// ── CLOCK ────────────────────────────────────────────────
function scheduler(){
  const c = getCtx();
  while(nextNoteTime < c.currentTime + SCHEDULE_AHEAD){
    scheduleStep(step, nextNoteTime);
    nextNoteTime += (60 / tempo) / 2; // 8th notes
    step = (step + 1) % 32;
  }
  timerID = setTimeout(scheduler, LOOKAHEAD);
}

export function startTheme(){
  stopTheme();
  tempo = 120;
  nextNoteTime = getCtx().currentTime;
  step = 0;
  scheduler();
}

export function stopTheme(){
  if(timerID){ clearTimeout(timerID); timerID = null; }
}

// ── DUCKING ──────────────────────────────────────────────
function duck(){
  if(!musicBus) return;
  const now = getCtx().currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(musicBus.gain.value, now);
  musicBus.gain.linearRampToValueAtTime(0.15, now + 0.02);
  musicBus.gain.linearRampToValueAtTime(0.6,  now + 0.28);
}

// ── SFX ──────────────────────────────────────────────────
export function playClick(){
  duck();
  osc('square', 600, getCtx().currentTime, 0.04, 0.15);
}

export function playCorrect(){
  duck();
  const t = getCtx().currentTime;
  [600,900,1200].forEach((f,i) => osc('square', f, t+i*0.05, 0.08, 0.2));
}

export function playWrong(){
  duck();
  const t = getCtx().currentTime;
  osc('sawtooth', 200, t,      0.12, 0.3);
  osc('sawtooth', 120, t+0.08, 0.12, 0.3);
  noise(t, 0.08, 0.2);
}

export function playStreak(){
  duck();
  setTempo(tempo + 10); // nudge tempo up on streak
  const t = getCtx().currentTime;
  [600,700,900,1100].forEach((f,i) => osc('square', f, t+i*0.04, 0.05, 0.2));
}

export function playTimeout(){
  duck();
  setTempo(tempo + 5); // slight urgency
  const t = getCtx().currentTime;
  osc('sawtooth', 300, t,      0.15, 0.3);
  noise(t+0.05, 0.1, 0.25);
}

export function playGameOver(){
  stopTheme();
  const t = getCtx().currentTime;
  // Impact layer
  noise(t, 0.15, 0.6);
  osc('sawtooth',  80, t, 0.30, 0.5);
  osc('square',   160, t, 0.20, 0.4);
  // Falling chromatic phrase
  [440,370,311,262,220,185,156,131].forEach((f,i) => {
    osc('sawtooth', f, t + 0.12 + i*0.11, 0.12, 0.28 + i*0.01);
  });
  // Final thud
  const tail = t + 0.12 + 8*0.11;
  osc('sawtooth', 55, tail, 0.3, 0.4);
  noise(tail, 0.25, 0.35);
}

export function playVictory(){
  duck();
  const t = getCtx().currentTime;
  [523,659,784,1047,1319].forEach((f,i) => osc('square', f, t+i*0.08, 0.1, 0.22));
}
