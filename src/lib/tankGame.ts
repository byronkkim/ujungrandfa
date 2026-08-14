// 우주의 탱크 게임 — 캔버스 2D 엔진 (React 밖에서 도는 순수 로직)
//
// 규칙 요약
//  - 탱크는 점프 + 좌우로 미사일 발사, 발사 버튼을 2초 누르면 필살기(3연발)
//  - 미사일은 0.3초에 한 발
//  - 적을 물리치면 10% 확률로 아군 탱크 합류(수용 인원은 판마다 2대씩 증가),
//    아군은 내 뒤쪽으로만 쏘고 체력 20을 가진다
//  - 지형: 평지 / 계단 / 구멍(떨어지면 죽음) / 용암
//  - 오른쪽 끝의 보스: 일반 7번, 필살기 4번, 섞으면 3번에 격파

export const VIEW_W = 960;
export const VIEW_H = 540;

const GRAVITY = 2300;
const MOVE_SPEED = 275;
const JUMP_V = -840; // 체공 0.73초 ≒ 가로 200px → 아래 구멍/용암 폭보다 넉넉하게
const STEP_UP = 26; // 계단 자동 오르기 높이
const STEP_H = 24; // 계단 한 칸 높이

const FIRE_COOLDOWN = 0.3; // 5. 0.3초마다 한 발
const CHARGE_TIME = 2.0; // 3. 2초 누르면 필살기
const SPECIAL_GAP = 0.13; // 필살기 3연발 간격
const ALLY_CHANCE = 0.1; // 6. 10% 확률
// 판마다 수용 인원이 2대씩 늘어난다 (1단계 2, 2단계 4, … 6단계 12 … 상한 없음)
const ALLY_PER_STAGE = 2;
const ALLY_ROW = 8; // 줄줄이 늘어지지 않게 8대마다 같은 간격으로 겹쳐 따라온다
const ALLY_HP = 20; // 아군 탱크 체력 (단계를 넘어가면 다시 채워짐)
const ALLY_HP_SEGS = 5; // 머리 위에 5칸으로 표시 (한 칸 = 체력 4)
const ALLY_HEAL = 10; // 단계를 넘어갈 때 회복하는 양 (전부는 아님)
const ALLY_HIT_CD = 0.5; // 계속 닿아 있어도 0.5초에 한 번만 아프다
const ALLY_DMG_TOUCH = 1; // 적과 부딪힘
const ALLY_DMG_BULLET = 3; // 보스 미사일

// 8. 보스: 일반 4뎀×7 = 필살기 7뎀×4 = 28, 섞으면 3배 보너스라 3번
const BOSS_BASE_HP = 28;
const DMG_NORMAL = 4;
const DMG_SPECIAL = 7;
const COMBO_MULT = 3;
// 아군 탱크도 보스를 때린다. 내 공격보다 약하게 잡아서 위 8번 규칙(7/4/3)은 그대로.
const DMG_ALLY = 1;

const START_LIVES = 5;
const INVULN = 1.6;

// 하트가 다 떨어지면 검사로 바뀐다. 공격력은 탱크와 같고 체력만 3.
const SWORD_LIVES = 3;

// 고수 모드 — 탱크도 검사도 한 대만 맞으면 끝, 적 체력 상한과 보스가 크게 오른다
const HARD_LIVES = 1;
const HARD_ENEMY_HP_CAP = 9; // 보통은 3
const HARD_BOSS_MULT = 5; // 보스 체력 5배
const SWING_LIFE = 0.16; // 검을 휘두르는 시간
// 검이 닿는 거리. 근접이라 붙어야 하지만, 보스 몸통에 깔리지 않을 만큼은 준다.
const SWING_REACH = 72;

const PLAYER_SIZE = {
  tank: { w: 48, h: 34 },
  sword: { w: 40, h: 52 }, // 탱크보다 홀쭉하고 키가 크다 — 한눈에 구별되게
} as const;

export type GameInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  fire: boolean;
  guard: boolean; // 검사 전용 — 누르고 있는 동안 막는다
};

const NO_INPUT: GameInput = {
  left: false,
  right: false,
  jump: false,
  fire: false,
  guard: false,
};

export type PlayerForm = "tank" | "sword";

export type Hud = {
  stage: number;
  form: PlayerForm;
  lives: number;
  allies: number;
  allyCap: number; // 이 단계에서 데리고 다닐 수 있는 아군 수
  hard: boolean; // 고수 모드
  charge: number; // 0~1
  enemies: number;
  stars: number;
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  phase: "playing" | "clear" | "gameover";
  toast: string;
};

type Rect = { x: number; y: number; w: number; h: number };
type Platform = Rect & { kind: "ground" | "step" };
type Lava = Rect;

type Body = Rect & {
  vx: number;
  vy: number;
  onGround: boolean;
  blocked: boolean;
};

type Missile = {
  x: number;
  y: number;
  vx: number;
  kind: "normal" | "special";
  from: "player" | "ally";
  salvo: number;
  life: number;
};

// 보스에게 "한 번의 공격"으로 전달되는 정보 (미사일이든 검이든 동일)
type Attack = {
  kind: "normal" | "special";
  salvo: number;
  x: number;
  y: number;
};

// 검사의 검 휘두르기 — 플레이어를 따라다니는 짧은 판정 상자
type Swing = {
  x: number;
  y: number;
  dir: number;
  kind: "normal" | "special";
  salvo: number;
  life: number;
  hits: Set<Enemy>; // 한 번 휘두를 때 한 마리만
};

// 검사의 필살기 — 날아가는 거대 칼날.
// 닿은 일반 적은 체력과 상관없이 즉사하고, 칼날은 뚫고 계속 나아간다. 보스는 예외.
type Blade = {
  x: number;
  y: number;
  vx: number;
  dir: number;
  salvo: number;
  life: number;
  spin: number;
};

type Bullet = { x: number; y: number; vx: number; vy: number; life: number };

type Enemy = Body & { hp: number; maxHp: number; dir: number; hopCd: number };
type Ally = Body & {
  cool: number;
  offset: number;
  puff: number;
  hp: number;
  maxHp: number;
  hurtCd: number;
};
type Boss = Body & {
  hp: number;
  maxHp: number;
  dir: number;
  shootCd: number;
  hurt: number;
  lastKind: "normal" | "special" | null;
  hitSalvos: Set<number>;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};

type Building = { x: number; y: number; w: number; h: number; seed: number };

type StarPickup = { x: number; y: number; taken: boolean };

type Level = {
  platforms: Platform[];
  lavas: Lava[];
  spawns: { x: number; y: number }[];
  stars: { x: number; y: number }[];
  length: number;
  bossX: number;
  bossY: number;
};

/* ------------------------------------------------------------------ */
/* 소리 — 파일 없이 웹오디오로 직접 만든다                                 */
/* ------------------------------------------------------------------ */

class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  enable() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  private noise(dur: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(t);
  }

  shoot() { this.tone(760, 0.07, "square", 0.04, 240); }
  special() { this.tone(300, 0.22, "sawtooth", 0.07, 900); }
  jump() { this.tone(340, 0.12, "sine", 0.05, 680); }
  boom() { this.noise(0.24, 0.16); }
  hitBoss() { this.tone(160, 0.16, "square", 0.08, 60); }
  hurt() { this.tone(420, 0.3, "sawtooth", 0.08, 90); }
  star() { this.tone(880, 0.09, "triangle", 0.06); this.tone(1320, 0.12, "triangle", 0.05); }
  swing(special: boolean) {
    this.noise(special ? 0.16 : 0.1, special ? 0.12 : 0.07);
    this.tone(special ? 520 : 900, 0.1, "triangle", 0.05, special ? 1600 : 1400);
  }
  blade() {
    this.noise(0.35, 0.14);
    this.tone(180, 0.5, "sawtooth", 0.09, 1400);
  }
  guard() {
    // 깡! 금속으로 튕겨내는 소리
    this.tone(1500, 0.12, "square", 0.05, 700);
    this.tone(2400, 0.08, "sine", 0.04);
    this.noise(0.06, 0.05);
  }
  transform() {
    [392, 523, 659].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.3, "square", 0.06), i * 90),
    );
  }
  clear() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.22, "triangle", 0.07), i * 120),
    );
  }
}

/* ------------------------------------------------------------------ */
/* 유틸                                                                 */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

function overlap(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* 스테이지 생성                                                         */
/* ------------------------------------------------------------------ */

function generateLevel(stage: number): Level {
  const rnd = mulberry32(90210 + stage * 7919);
  const platforms: Platform[] = [];
  const lavas: Lava[] = [];
  const spawns: { x: number; y: number }[] = [];
  const stars: { x: number; y: number }[] = [];

  const deep = 460; // 플랫폼 두께(화면 아래까지)
  let gy = 420;
  let x = 0;

  const push = (w: number, kind: Platform["kind"] = "ground") => {
    platforms.push({ x, y: gy, w, h: deep, kind });
    x += w;
  };

  // 시작 안전지대
  push(540);

  const target = 3000 + stage * 650;
  const enemyChance = Math.min(0.85, 0.45 + stage * 0.08);

  while (x < target) {
    const roll = rnd();
    if (roll < 0.24) {
      // 구멍 — 떨어지면 죽는다. 뛰어넘으면 별 하나.
      const gapStart = x;
      x += 95 + rnd() * 45;
      stars.push({ x: (gapStart + x) / 2, y: gy - 78 });
      const w = 250 + rnd() * 150;
      const at = x;
      push(w);
      if (rnd() < enemyChance) spawns.push({ x: at + w * 0.6, y: gy - 40 });
    } else if (roll < 0.44) {
      // 용암 웅덩이
      const gap = 120 + rnd() * 40;
      lavas.push({ x: x - 4, y: gy + 34, w: gap + 8, h: 120 });
      stars.push({ x: x + gap / 2, y: gy - 78 });
      x += gap;
      const w = 260 + rnd() * 140;
      const at = x;
      push(w);
      if (rnd() < enemyChance) spawns.push({ x: at + w * 0.55, y: gy - 40 });
    } else if (roll < 0.68) {
      // 계단 — 올라갈 자리가 없으면 내려간다(높이가 잘려 평지가 되지 않도록)
      const canUp = gy - 3 * STEP_H >= 272;
      const canDown = gy + 3 * STEP_H <= 444;
      const up = canUp && (!canDown || rnd() < 0.55);
      for (let i = 0; i < 3; i++) {
        gy += up ? -STEP_H : STEP_H;
        push(76, "step");
      }
      const w = 220 + rnd() * 150;
      const at = x;
      push(w);
      stars.push({ x: at + w * 0.5, y: gy - 46 });
      if (rnd() < enemyChance) spawns.push({ x: at + w * 0.5, y: gy - 40 });
    } else {
      // 평지
      const w = 320 + rnd() * 220;
      const at = x;
      push(w);
      if (rnd() < 0.7) stars.push({ x: at + w * 0.3, y: gy - 46 });
      if (rnd() < enemyChance) spawns.push({ x: at + w * 0.4, y: gy - 40 });
      if (rnd() < enemyChance * 0.5)
        spawns.push({ x: at + w * 0.8, y: gy - 40 });
    }
  }

  // 보스 앞 마지막 구멍 + 보스 무대
  x += 120;
  gy = 420;
  const arenaX = x;
  platforms.push({ x: arenaX, y: gy, w: 1120, h: deep, kind: "ground" });

  return {
    platforms,
    lavas,
    spawns,
    stars,
    length: arenaX + 1120,
    bossX: arenaX + 760,
    bossY: gy,
  };
}

function generateCity(length: number, seed: number) {
  const rnd = mulberry32(seed);
  const layer = (span: number, minH: number, maxH: number, base: number) => {
    const out: Building[] = [];
    for (let bx = -200; bx < length + 400; ) {
      const w = span + rnd() * span;
      const h = minH + rnd() * (maxH - minH);
      out.push({ x: bx, y: base - h, w, h, seed: rnd() });
      bx += w + 6 + rnd() * 22;
    }
    return out;
  };
  return {
    far: layer(70, 120, 250, 470),
    mid: layer(56, 90, 210, 500),
  };
}

/* ------------------------------------------------------------------ */
/* 게임                                                                 */
/* ------------------------------------------------------------------ */

export class TankGame {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private running = false;

  private input: GameInput = { ...NO_INPUT };
  private guarding = false;
  private guardFlash = 0;
  private onHud: (h: Hud) => void;
  private hudKey = "";

  private stage = 1;
  private form: PlayerForm = "tank";
  private lives = START_LIVES;
  private cheat = false; // 치트키 발동 시 하트 상한이 2배 (탱크 10, 검사 6)
  private hard = false; // 고수 모드: 한 대만 맞아도 끝, 적·보스가 훨씬 강함
  private phase: Hud["phase"] = "playing";
  private phaseTimer = 0;
  private toast = "";
  private toastTimer = 0;

  private level!: Level;
  private city!: { far: Building[]; mid: Building[] };

  private player!: Body & {
    dir: number;
    invuln: number;
    puff: number;
    form: PlayerForm;
  };
  private safe = { x: 60, y: 300 };

  private sfx = new Sfx();
  private paused = false;
  private starPickups: StarPickup[] = [];
  private starCount = 0;

  private enemies: Enemy[] = [];
  private allies: Ally[] = [];
  private missiles: Missile[] = [];
  private swings: Swing[] = [];
  private blades: Blade[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private boss: Boss | null = null;

  private cool = 0; // 미사일 쿨다운
  private charge = 0; // 필살기 충전
  private special = { left: 0, timer: 0, dir: 1, salvo: 0 };
  private salvoSeq = 1;

  private camX = 0;
  private shake = 0;
  private time = 0;
  private respawnTimer = 0;
  private spawnCd = 4;

  constructor(canvas: HTMLCanvasElement, onHud: (h: Hud) => void) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d 컨텍스트를 만들 수 없어요");
    this.ctx = ctx;
    this.onHud = onHud;

    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(VIEW_W * dpr);
    canvas.height = Math.round(VIEW_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.loadStage(1);
  }

  /* ---------------- 수명주기 ---------------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setInput(next: Partial<GameInput>) {
    this.input = { ...this.input, ...next };
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.input = { ...NO_INPUT };
  }

  // 브라우저 정책상 소리는 첫 터치/키 입력 뒤에만 켤 수 있다
  enableAudio() {
    this.sfx.enable();
  }

  setMuted(m: boolean) {
    this.sfx.muted = m;
  }

  // 고수 모드 켜고 끄기 (시작 화면에서만 바꾼다 — restart보다 먼저 부를 것)
  setHardMode(on: boolean) {
    this.hard = on;
  }

  // 하트 상한. 고수 모드는 1대만 맞아도 끝(치트키를 쓰면 2대).
  private maxLives() {
    const base = this.hard
      ? HARD_LIVES
      : this.form === "sword"
        ? SWORD_LIVES
        : START_LIVES;
    return this.cheat ? base * 2 : base;
  }

  // 🥚 이스터에그 치트키 — 하트 상한을 2배로 (탱크 5→10, 검사 3→6)
  setCheat(on: boolean) {
    this.cheat = on;
    if (!on) return;
    this.lives = this.maxLives();
    this.sfx.transform();
    this.setToast("치트키 발동! 하트 2배 💗", 3);
    for (let i = 0; i < 30; i++)
      this.spark(
        this.player.x + this.player.w / 2,
        this.player.y,
        i % 2 ? "#f472b6" : "#fde047",
      );
  }

  // 원하는 단계부터 시작할 수 있다 (시작 화면에서 고른 단계)
  restart(stage = 1) {
    this.starCount = 0;
    this.form = "tank";
    this.cheat = false; // 치트키는 한 판에 한 번 — 새 판이면 초기화
    this.allies = [];
    this.loadStage(Math.max(1, Math.round(stage)));
  }

  /* ---------------- 스테이지 ---------------- */

  // keepAllies: 다음 단계로 넘어갈 때는 모아둔 아군 탱크를 데리고 간다
  private loadStage(stage: number, keepAllies = false) {
    this.stage = stage;
    this.level = generateLevel(stage);
    this.city = generateCity(this.level.length, 4242 + stage);
    this.phase = "playing";
    this.phaseTimer = 0;
    // 단계마다 하트 다시 채움 (검사는 3개, 치트키 발동 시 2배)
    this.lives = this.maxLives();

    const size = PLAYER_SIZE[this.form];
    this.player = {
      x: 80,
      y: 300,
      w: size.w,
      h: size.h,
      vx: 0,
      vy: 0,
      onGround: false,
      blocked: false,
      dir: 1,
      invuln: 0,
      puff: 0,
      form: this.form,
    };
    this.safe = { x: 80, y: 300 };

    this.starPickups = this.level.stars.map((s) => ({ ...s, taken: false }));

    // 9. 단계가 오르면 적이 더 튼튼해진다 (고수 모드는 9까지)
    const ehp = Math.min(stage, this.hard ? HARD_ENEMY_HP_CAP : 3);
    this.enemies = this.level.spawns.map((s) => ({
      x: s.x,
      y: s.y,
      w: 38,
      h: 32,
      vx: 0,
      vy: 0,
      onGround: false,
      blocked: false,
      hp: ehp,
      maxHp: ehp,
      dir: -1,
      hopCd: 0,
    }));

    const bossMax = Math.round(
      BOSS_BASE_HP * (1 + 0.5 * (stage - 1)) * (this.hard ? HARD_BOSS_MULT : 1),
    );
    this.boss = {
      x: this.level.bossX,
      y: this.level.bossY - 118,
      w: 132,
      h: 118,
      vx: 0,
      vy: 0,
      onGround: false,
      blocked: false,
      hp: bossMax,
      maxHp: bossMax,
      dir: -1,
      shootCd: 2,
      hurt: 0,
      lastKind: null,
      hitSalvos: new Set(),
    };

    if (keepAllies) {
      // 단계를 넘어가면 아군 탱크가 체력을 10만큼 회복한다(전부는 아님)
      this.allies.forEach((a, i) => {
        a.x = this.player.x - 50 - i * 12;
        a.y = this.player.y - 20;
        a.vx = 0;
        a.vy = 0;
        a.hp = Math.min(a.maxHp, a.hp + ALLY_HEAL);
        a.hurtCd = 0;
      });
    } else {
      this.allies = [];
    }
    this.missiles = [];
    this.swings = [];
    this.blades = [];
    this.bullets = [];
    this.particles = [];
    this.cool = 0;
    this.charge = 0;
    this.special.left = 0;
    // 이전 단계에서 누르고 있던 입력·대기 상태가 새 단계로 넘어오지 않게 초기화
    this.input = { ...NO_INPUT };
    this.respawnTimer = 0;
    this.guarding = false;
    this.guardFlash = 0;
    this.camX = 0;
    this.spawnCd = 5;
    this.setToast(`${stage}단계 시작!`, 2);
  }

  private setToast(text: string, secs: number) {
    this.toast = text;
    this.toastTimer = secs;
  }

  /* ---------------- 물리 ---------------- */

  private moveBody(b: Body, dt: number, stepUp: number) {
    const plats = this.level.platforms;
    b.blocked = false;

    b.x += b.vx * dt;
    for (const p of plats) {
      if (!overlap(b, p)) continue;
      const feet = b.y + b.h;
      if (b.vy >= 0 && feet - p.y <= stepUp) {
        b.y = p.y - b.h; // 계단은 걸어서 오른다
        continue;
      }
      if (b.vx > 0) b.x = p.x - b.w;
      else if (b.vx < 0) b.x = p.x + p.w;
      b.blocked = true;
    }

    b.vy += GRAVITY * dt;
    b.y += b.vy * dt;
    b.onGround = false;
    for (const p of plats) {
      if (!overlap(b, p)) continue;
      if (b.vy > 0) {
        b.y = p.y - b.h;
        b.vy = 0;
        b.onGround = true;
      } else if (b.vy < 0) {
        b.y = p.y + p.h;
        b.vy = 0;
      }
    }
  }

  private groundAhead(b: Body, dir: number) {
    const px = dir > 0 ? b.x + b.w + 12 : b.x - 12;
    const py = b.y + b.h + 8;
    return this.level.platforms.some(
      (p) => px > p.x && px < p.x + p.w && py > p.y && py < p.y + p.h,
    );
  }

  /* ---------------- 업데이트 ---------------- */

  private update(dt: number) {
    if (this.paused) return;
    this.time += dt;
    if (this.toastTimer > 0) this.toastTimer -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);

    if (this.phase === "clear") {
      this.phaseTimer -= dt;
      this.updateParticles(dt);
      if (this.phaseTimer <= 0) this.loadStage(this.stage + 1, true);
      this.pushHud();
      return;
    }
    if (this.phase === "gameover") {
      this.updateParticles(dt);
      this.pushHud();
      return;
    }

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      this.updateParticles(dt);
      this.pushHud();
      return;
    }

    this.updatePlayer(dt);
    this.updateStars();
    this.updateWeapons(dt);
    this.updateSwings(dt);
    this.updateBlades(dt);
    this.updateMissiles(dt);
    this.updateEnemies(dt);
    this.updateAllies(dt);
    this.updateBoss(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.updateCamera();
    this.pushHud();
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (this.guardFlash > 0) this.guardFlash -= dt;

    // 방어는 검사만, 땅에 서 있을 때만. 막는 동안은 움직이지도 공격하지도 못한다.
    this.guarding = p.form === "sword" && this.input.guard && p.onGround;

    const dirIn = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    p.vx = this.guarding ? 0 : dirIn * MOVE_SPEED;
    if (dirIn !== 0 && !this.guarding) p.dir = dirIn;

    if (this.input.jump && p.onGround && !this.guarding) {
      p.vy = JUMP_V;
      p.onGround = false;
      this.sfx.jump();
      for (let i = 0; i < 6; i++) this.puff(p.x + p.w / 2, p.y + p.h);
    }

    this.moveBody(p, dt, STEP_UP);
    p.x = clamp(p.x, 0, this.level.length - p.w);
    if (p.invuln > 0) p.invuln -= dt;

    // 안전지대 기억(부활 지점).
    // 구멍·용암 바로 앞은 기억하지 않는다 — 되살아나서 또 빠지면 하트가 순식간에 없어진다.
    if (p.onGround && !this.overLava(p) && this.standingSafely(p)) {
      this.safe.x = p.x;
      this.safe.y = p.y - 4;
    }

    // 구멍에 빠짐 / 용암
    if (p.y > VIEW_H + 60) this.hurtPlayer(true);
    else if (this.overLava(p)) this.hurtPlayer(true);
  }

  private overLava(b: Rect) {
    return this.level.lavas.some((l) => overlap(b, l));
  }

  // 발밑이 넉넉히 단단한지 (앞뒤 70px까지 땅이 있고, 용암 위가 아님)
  private standingSafely(b: Body) {
    const foot = b.y + b.h + 8;
    const solid = (px: number) =>
      this.level.platforms.some(
        (p) => px > p.x && px < p.x + p.w && foot > p.y && foot < p.y + p.h,
      );
    return (
      solid(b.x - 70) &&
      solid(b.x + b.w + 70) &&
      !this.level.lavas.some(
        (l) => b.x - 70 < l.x + l.w && b.x + b.w + 70 > l.x,
      )
    );
  }

  // 별 줍기 (별 모으기 앱이니까 게임에서도 별을 모은다)
  private updateStars() {
    const p = this.player;
    for (const s of this.starPickups) {
      if (s.taken) continue;
      if (Math.abs(s.x - (p.x + p.w / 2)) > 40) continue;
      if (Math.abs(s.y - (p.y + p.h / 2)) > 40) continue;
      s.taken = true;
      this.starCount += 1;
      this.sfx.star();
      for (let i = 0; i < 10; i++) this.spark(s.x, s.y, "#fde047");
    }
  }

  private updateWeapons(dt: number) {
    const p = this.player;
    if (this.cool > 0) this.cool -= dt;

    // 필살기 3연발 (탱크는 미사일 3발, 검사는 검 3번) — 셋 다 salvo가 같아서
    // 보스에게는 "필살기 한 번"으로 계산된다
    if (this.special.left > 0) {
      this.special.timer -= dt;
      if (this.special.timer <= 0) {
        this.special.timer = SPECIAL_GAP;
        this.special.left -= 1;
        this.attack("special", this.special.dir, this.special.salvo);
      }
    }

    if (this.input.fire && !this.guarding) {
      // 눌린 동안 0.3초마다 한 번 + 충전
      if (this.cool <= 0 && this.special.left === 0) {
        this.cool = FIRE_COOLDOWN;
        this.attack("normal", p.dir, this.salvoSeq++);
      }
      this.charge = Math.min(CHARGE_TIME, this.charge + dt);
      if (this.charge >= CHARGE_TIME) {
        this.charge = 0;
        // 탱크는 미사일 3연발, 검사는 거대 칼날 한 방
        this.special.left = p.form === "sword" ? 1 : 3;
        this.special.timer = 0;
        this.special.dir = p.dir;
        this.special.salvo = this.salvoSeq++;
        this.setToast("필살기 발사!", 1.2);
      }
    } else {
      this.charge = Math.max(0, this.charge - dt * 2.5);
    }
  }

  // 탱크면 미사일, 검사면 검. 공격력·발사 간격·필살기 횟수는 완전히 같다.
  private attack(kind: "normal" | "special", dir: number, salvo: number) {
    const p = this.player;
    const special = kind === "special";

    // 검사의 필살기 = 거대 칼날 날리기
    if (p.form === "sword" && special) {
      this.blades.push({
        x: p.x + p.w / 2 + dir * 30,
        y: p.y + p.h / 2,
        vx: dir * 560,
        dir,
        salvo,
        life: 2.2,
        spin: 0,
      });
      this.sfx.blade();
      this.shake = Math.max(this.shake, 12);
      for (let i = 0; i < 14; i++)
        this.spark(p.x + p.w / 2 + dir * 36, p.y + p.h / 2, "#f97316");
      return;
    }

    if (p.form === "sword") {
      this.swings.push({
        x: p.x + p.w / 2 + dir * SWING_REACH * 0.6,
        y: p.y + p.h / 2,
        dir,
        kind,
        salvo,
        life: SWING_LIFE,
        hits: new Set(),
      });
      this.sfx.swing(special);
      if (special) this.shake = Math.max(this.shake, 5);
      for (let i = 0; i < (special ? 6 : 3); i++)
        this.spark(
          p.x + p.w / 2 + dir * SWING_REACH,
          p.y + p.h / 2,
          special ? "#f97316" : "#e2e8f0",
        );
      return;
    }

    this.missiles.push({
      x: p.x + p.w / 2 + dir * (special ? 26 : 24),
      y: p.y + (special ? 12 : 13),
      vx: dir * (special ? 820 : 660),
      kind,
      from: "player",
      salvo,
      life: 3,
    });
    if (special) {
      this.shake = Math.max(this.shake, 6);
      this.sfx.special();
    } else {
      this.sfx.shoot();
    }
    for (let i = 0; i < (special ? 5 : 1); i++)
      this.spark(
        p.x + p.w / 2 + dir * 28,
        p.y + 13,
        special ? "#f97316" : "#fbbf24",
      );
  }

  // 검 판정 — 플레이어를 따라다니고, 한 번 휘두를 때 적 한 마리만 맞힌다
  private updateSwings(dt: number) {
    const p = this.player;
    for (let i = this.swings.length - 1; i >= 0; i--) {
      const s = this.swings[i];
      s.life -= dt;
      s.x = p.x + p.w / 2 + s.dir * SWING_REACH * 0.6;
      s.y = p.y + p.h / 2;
      if (s.life <= 0) {
        this.swings.splice(i, 1);
        continue;
      }
      const box: Rect = {
        x: s.dir > 0 ? s.x - 10 : s.x - SWING_REACH + 10,
        y: s.y - 26,
        w: SWING_REACH,
        h: 52,
      };

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (s.hits.has(e) || !overlap(box, e)) continue;
        s.hits.add(e);
        e.hp -= 1;
        if (e.hp <= 0) {
          this.enemies.splice(j, 1);
          this.boom(e.x + e.w / 2, e.y + e.h / 2, "#a855f7", 14);
          this.sfx.boom();
          this.maybeAlly();
        } else {
          this.boom(e.x + e.w / 2, e.y + e.h / 2, "#e2e8f0", 5);
        }
        break; // 한 번에 한 마리
      }

      const b = this.boss;
      if (b && overlap(box, b)) this.hitBoss(s);
    }
  }

  // 거대 칼날 — 닿은 일반 적은 체력과 상관없이 즉사, 칼날은 뚫고 나아간다.
  // 보스만 예외로 즉사하지 않고 필살기 한 번만큼(7)만 깎인다.
  private updateBlades(dt: number) {
    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];
      b.x += b.vx * dt;
      b.spin += dt * 13;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < this.camX - 300 ||
        b.x > this.camX + VIEW_W + 400
      ) {
        this.blades.splice(i, 1);
        continue;
      }
      const box: Rect = { x: b.x - 40, y: b.y - 46, w: 80, h: 92 };

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (!overlap(box, e)) continue;
        this.enemies.splice(j, 1); // 체력 무시하고 즉사
        this.boom(e.x + e.w / 2, e.y + e.h / 2, "#e2e8f0", 16);
        this.boom(e.x + e.w / 2, e.y + e.h / 2, "#a855f7", 10);
        this.sfx.boom();
        this.maybeAlly();
      }

      const boss = this.boss;
      if (boss && overlap(box, boss))
        this.hitBoss({ kind: "special", salvo: b.salvo, x: b.x, y: b.y });

      if (Math.random() < 0.6)
        this.spark(b.x - b.dir * 20, b.y + (Math.random() - 0.5) * 40, "#fbbf24");
    }
  }

  private updateMissiles(dt: number) {
    const ehpDmg = (m: Missile) =>
      m.kind === "special" ? 99 : 1; // 필살기 미사일은 한 방에 한 마리

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.x += m.vx * dt;
      m.life -= dt;
      if (m.life <= 0 || m.x < this.camX - 200 || m.x > this.camX + VIEW_W + 300) {
        this.missiles.splice(i, 1);
        continue;
      }
      const box: Rect = { x: m.x - 9, y: m.y - 5, w: 18, h: 10 };

      // 벽(계단)에 박히면 터짐
      if (this.level.platforms.some((p) => overlap(box, p))) {
        this.boom(m.x, m.y, m.kind === "special" ? "#f97316" : "#fbbf24", 6);
        this.missiles.splice(i, 1);
        continue;
      }

      let used = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (!overlap(box, e)) continue;
        e.hp -= ehpDmg(m);
        if (e.hp <= 0) {
          this.enemies.splice(j, 1);
          this.boom(e.x + e.w / 2, e.y + e.h / 2, "#a855f7", 14);
          this.sfx.boom();
          this.maybeAlly();
        } else {
          this.boom(m.x, m.y, "#fbbf24", 5);
        }
        used = true;
        break;
      }
      if (used) {
        this.missiles.splice(i, 1);
        continue;
      }

      const b = this.boss;
      if (b && overlap(box, b)) {
        if (m.from === "player") this.hitBoss(m);
        else this.allyHitBoss(m);
        this.missiles.splice(i, 1);
      }
    }
  }

  private hitBoss(m: Attack) {
    const b = this.boss;
    if (!b) return;
    this.boom(m.x, m.y, "#f97316", 10);

    // 같은 필살기 3연발은 "한 번의 공격"으로 계산
    if (b.hitSalvos.has(m.salvo)) return;
    b.hitSalvos.add(m.salvo);

    let dmg = m.kind === "special" ? DMG_SPECIAL : DMG_NORMAL;
    if (b.lastKind && b.lastKind !== m.kind) {
      dmg *= COMBO_MULT; // 일반+필살기를 섞으면 콤보!
      this.setToast("콤보!! ⚡", 1.1);
    }
    b.lastKind = m.kind;
    b.hp -= dmg;
    b.hurt = 0.25;
    this.shake = 10;
    this.sfx.hitBoss();
    if (b.hp <= 0) this.killBoss(b);
  }

  // 아군 탱크의 미사일 — 약하게 깎고, 콤보 계산에는 끼지 않는다
  private allyHitBoss(m: Missile) {
    const b = this.boss;
    if (!b) return;
    this.boom(m.x, m.y, "#38bdf8", 7);
    b.hp -= DMG_ALLY;
    b.hurt = 0.15;
    this.sfx.hitBoss();
    if (b.hp <= 0) this.killBoss(b);
  }

  private killBoss(b: Boss) {
    this.boss = null;
    // 누르고 있던 입력을 여기서 끊는다. 안 그러면 클리어 화면을 지나 다음 단계에서
    // 계속 자동으로 공격이 나간다.
    this.input = { ...NO_INPUT };
    this.charge = 0;
    this.special.left = 0;
    this.cool = 0;
    for (let i = 0; i < 60; i++)
      this.boom(
        b.x + b.w / 2 + (Math.random() - 0.5) * b.w,
        b.y + b.h / 2 + (Math.random() - 0.5) * b.h,
        i % 2 ? "#f97316" : "#fde047",
        3,
      );
    this.shake = 24;
    this.sfx.boom();
    this.sfx.clear();
    this.phase = "clear";
    this.phaseTimer = 3;
    this.setToast(`${this.stage}단계 클리어! 🎉`, 3);
  }

  // 판마다 늘어나는 아군 수용 인원 (1단계 2대, 2단계 4대, 6단계 12대 … 계속 증가)
  private allyCapacity() {
    return this.stage * ALLY_PER_STAGE;
  }

  private maybeAlly() {
    if (this.allies.length >= this.allyCapacity()) return;
    if (Math.random() >= ALLY_CHANCE) return; // 6. 10% 확률
    const p = this.player;
    this.allies.push({
      x: p.x - 60,
      y: p.y,
      w: 44,
      h: 31,
      vx: 0,
      vy: 0,
      onGround: false,
      blocked: false,
      cool: 0.4 + Math.random() * 0.8,
      // 수가 많아져도 화면 밖까지 늘어지지 않게 8대마다 간격을 되돌린다(겹쳐도 됨)
      offset: 60 + (this.allies.length % ALLY_ROW) * 26 + Math.random() * 18,
      puff: 0,
      hp: ALLY_HP,
      maxHp: ALLY_HP,
      hurtCd: 0,
    });
    this.setToast(
      `아군 탱크 합류! (${this.allies.length}/${this.allyCapacity()}대)`,
      1.6,
    );
  }

  private updateEnemies(dt: number) {
    const p = this.player;

    // 뒤쪽에서도 적이 따라온다 (아군의 후방 사격이 쓸모 있도록).
    // 단, 출발 지점에 가만히 있는 동안에는 나오지 않는다.
    this.spawnCd -= dt;
    if (
      p.x > 900 &&
      this.spawnCd <= 0 &&
      this.enemies.length < 6 + this.stage * 2
    ) {
      this.spawnCd = 3.4 - Math.min(1.6, this.stage * 0.25);
      const sx = this.camX - 40;
      const hp = Math.min(this.stage, 3);
      if (sx > 20)
        this.enemies.push({
          x: sx,
          y: 120,
          w: 38,
          h: 32,
          vx: 0,
          vy: 0,
          onGround: false,
          blocked: false,
          hp,
          maxHp: hp,
          dir: 1,
          hopCd: 0,
        });
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const near = Math.abs(e.x - this.camX - VIEW_W / 2) < VIEW_W;
      if (!near) continue;

      e.dir = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
      // 가까이 오기 전까지는 제자리에서 기다린다(가만히 서 있는데 몰려오지 않도록)
      const awake = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 520;
      const speed = 74 + Math.min(this.stage, 4) * 8;
      // 낭떠러지 앞에서는 멈춘다
      e.vx = !awake
        ? 0
        : this.groundAhead(e, e.dir) || !e.onGround
          ? e.dir * speed
          : 0;

      e.hopCd -= dt;
      if (e.blocked && e.onGround && e.hopCd <= 0) {
        e.vy = -620;
        e.hopCd = 0.6;
      }
      this.moveBody(e, dt, STEP_UP);

      if (e.y > VIEW_H + 120 || this.overLava(e)) {
        this.boom(e.x + e.w / 2, e.y, "#a855f7", 8);
        this.enemies.splice(i, 1);
        continue;
      }
      if (overlap(e, p)) {
        const blocked = this.guarding;
        this.hurtPlayer(false);
        // 막고 있으면 부딪힌 적을 튕겨낸다
        if (blocked) {
          e.x += (e.x + e.w / 2 < p.x + p.w / 2 ? -1 : 1) * 30;
          e.vy = -330;
        }
      }
    }
  }

  // 아군 탱크 피해. 체력이 0이 되면 격파된다.
  private hurtAlly(a: Ally, dmg: number) {
    if (a.hurtCd > 0) return;
    a.hurtCd = ALLY_HIT_CD;
    a.hp -= dmg;
    this.boom(a.x + a.w / 2, a.y + a.h / 2, "#38bdf8", 6);
    if (a.hp > 0) return;

    const i = this.allies.indexOf(a);
    if (i >= 0) this.allies.splice(i, 1);
    this.boom(a.x + a.w / 2, a.y + a.h / 2, "#0ea5e9", 18);
    this.boom(a.x + a.w / 2, a.y + a.h / 2, "#e2e8f0", 10);
    this.sfx.boom();
    this.setToast(`아군 탱크 격파! (남은 ${this.allies.length}대)`, 1.6);
  }

  private updateAllies(dt: number) {
    const p = this.player;
    const backDir = -p.dir; // 6. 내 뒤쪽으로만 쏜다

    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      if (a.hurtCd > 0) a.hurtCd -= dt;
      const targetX = p.x - p.dir * a.offset;
      const dx = targetX - a.x;
      a.vx = clamp(dx * 3.2, -MOVE_SPEED * 1.25, MOVE_SPEED * 1.25);
      if (Math.abs(dx) < 6) a.vx = 0;
      if (a.onGround && (a.blocked || (a.y - p.y > 40 && Math.abs(dx) > 30)))
        a.vy = JUMP_V * 0.95;

      this.moveBody(a, dt, STEP_UP);

      // 구멍/용암에 빠지면 내 옆으로 순간이동
      if (a.y > VIEW_H + 80 || this.overLava(a) || Math.abs(a.x - p.x) > 900) {
        a.x = p.x - p.dir * 40;
        a.y = p.y - 30;
        a.vx = 0;
        a.vy = 0;
        for (let i = 0; i < 8; i++) this.spark(a.x + 20, a.y + 15, "#38bdf8");
      }

      a.cool -= dt;
      if (a.cool <= 0) {
        a.cool = 0.85 + Math.random() * 0.5;
        this.missiles.push({
          x: a.x + a.w / 2 + backDir * 22,
          y: a.y + 12,
          vx: backDir * 620,
          kind: "normal",
          from: "ally",
          salvo: this.salvoSeq++,
          life: 2.4,
        });
        this.spark(a.x + a.w / 2 + backDir * 26, a.y + 12, "#7dd3fc");
      }

      // 적·보스와 부딪히면 아군도 아프다 (체력 0이면 격파되어 사라진다)
      if (this.enemies.some((e) => overlap(e, a))) {
        this.hurtAlly(a, ALLY_DMG_TOUCH);
        continue;
      }
      const boss = this.boss;
      if (boss && overlap(boss, a)) this.hurtAlly(a, ALLY_DMG_BULLET);
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    const p = this.player;
    if (b.hurt > 0) b.hurt -= dt;

    const awake = p.x > b.x - VIEW_W * 0.7;
    if (!awake) return;

    b.dir = p.x < b.x ? -1 : 1;
    const homeL = this.level.bossX - 300;
    const homeR = this.level.bossX + 260;
    const speed = (60 + this.stage * 10) * (this.hard ? 1.4 : 1);
    b.vx = b.dir * speed;
    if (b.x < homeL) b.vx = Math.abs(b.vx);
    if (b.x > homeR) b.vx = -Math.abs(b.vx);
    this.moveBody(b, dt, 0);

    b.shootCd -= dt;
    if (b.shootCd <= 0) {
      b.shootCd = this.hard
        ? Math.max(0.5, 1.2 - this.stage * 0.1)
        : Math.max(0.9, 1.9 - this.stage * 0.15);
      const ox = b.x + b.w / 2 + b.dir * 60;
      const oy = b.y + 46;
      for (const vy of [-170, 0, 170]) {
        this.bullets.push({ x: ox, y: oy, vx: b.dir * 330, vy, life: 4 });
      }
      this.shake = Math.max(this.shake, 4);
    }

    if (overlap(b, p)) this.hurtPlayer(false);
  }

  private updateBullets(dt: number) {
    const p = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const s = this.bullets[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += GRAVITY * 0.12 * dt;
      s.life -= dt;
      const box: Rect = { x: s.x - 8, y: s.y - 8, w: 16, h: 16 };
      if (
        s.life <= 0 ||
        this.level.platforms.some((pl) => overlap(box, pl))
      ) {
        this.boom(s.x, s.y, "#ef4444", 4);
        this.bullets.splice(i, 1);
        continue;
      }
      if (overlap(box, p)) {
        this.bullets.splice(i, 1);
        this.hurtPlayer(false);
        continue;
      }
      // 보스 미사일은 아군 탱크도 맞힌다
      const hitAlly = this.allies.find((a) => overlap(box, a));
      if (hitAlly) {
        this.bullets.splice(i, 1);
        this.boom(s.x, s.y, "#ef4444", 5);
        this.hurtAlly(hitAlly, ALLY_DMG_BULLET);
      }
    }
  }

  // 막기 성공 — 피해 없이 튕겨낸다 (구멍·용암 같은 즉사는 못 막는다)
  private blockHit(x: number, y: number) {
    if (this.guardFlash > 0) return; // 겹쳐 있는 동안 소리·불꽃이 도배되지 않게
    this.guardFlash = 0.22;
    this.shake = Math.max(this.shake, 7);
    this.sfx.guard();
    for (let i = 0; i < 12; i++) this.spark(x, y, i % 2 ? "#fde047" : "#e2e8f0");
  }

  private hurtPlayer(fatal: boolean) {
    const p = this.player;
    if (p.invuln > 0 && !fatal) return;

    // 검사가 막고 있으면 일반 피해는 통하지 않는다
    if (this.guarding && !fatal) {
      this.blockHit(p.x + p.w / 2 + p.dir * 26, p.y + p.h / 2);
      return;
    }
    this.lives -= 1;
    this.shake = 16;
    this.sfx.hurt();
    this.boom(p.x + p.w / 2, p.y + p.h / 2, "#ef4444", 18);

    if (this.lives <= 0) {
      // 탱크의 하트가 다 없어지면 검사가 나온다. 검사까지 쓰러지면 게임 오버.
      if (p.form === "tank") {
        this.becomeSwordsman();
        return;
      }
      this.lives = 0;
      this.phase = "gameover";
      this.input = { ...NO_INPUT };
      this.charge = 0;
      this.special.left = 0;
      this.setToast("게임 오버", 99);
      return;
    }

    if (fatal) {
      // 구멍·용암 → 마지막 안전지대에서 부활
      p.x = this.safe.x;
      p.y = this.safe.y - 40;
      p.vx = 0;
      p.vy = 0;
      this.respawnTimer = 0.7; // 한 박자 쉬고 다시 시작
    } else {
      // 부딪힘 → 뒤로 튕겨나가기만
      p.vy = -430;
      p.x = clamp(p.x - p.dir * 34, 0, this.level.length - p.w);
    }
    p.invuln = INVULN;
    this.charge = 0;
    this.special.left = 0;
    this.setToast(`앗! 남은 하트 ${this.lives}개`, 1.4);
  }

  // 탱크 → 검사 변신. 체력 3, 공격력은 탱크와 동일, 미사일 대신 검.
  private becomeSwordsman() {
    const p = this.player;
    const size = PLAYER_SIZE.sword;
    this.form = "sword";
    p.form = "sword";
    p.w = size.w;
    p.h = size.h;
    p.x = this.safe.x; // 마지막 안전지대에서 다시 시작
    p.y = this.safe.y - size.h;
    p.vx = 0;
    p.vy = 0;
    p.invuln = INVULN * 1.8;
    this.lives = this.maxLives(); // 검사 3 (치트키면 6)
    this.missiles = this.missiles.filter((m) => m.from === "ally");
    this.swings = [];
    this.charge = 0;
    this.special.left = 0;
    this.respawnTimer = 1.2; // 변신 순간을 알아볼 수 있게 한 박자 멈춘다
    this.shake = 20;
    this.sfx.transform();
    for (let i = 0; i < 40; i++)
      this.boom(p.x + p.w / 2, p.y + p.h / 2, i % 2 ? "#38bdf8" : "#e2e8f0", 2);
    this.setToast("검사 등장! 🗡️", 2.6);
  }

  private updateCamera() {
    const target = clamp(
      this.player.x + this.player.w / 2 - VIEW_W * 0.42,
      0,
      Math.max(0, this.level.length - VIEW_W),
    );
    this.camX += (target - this.camX) * 0.14;
  }

  /* ---------------- 파티클 ---------------- */

  private spark(x: number, y: number, color: string) {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160,
      life: 0.25,
      max: 0.25,
      color,
      size: 2 + Math.random() * 2,
    });
  }

  private puff(x: number, y: number) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      vx: (Math.random() - 0.5) * 90,
      vy: -Math.random() * 60,
      life: 0.4,
      max: 0.4,
      color: "#cbd5e1",
      size: 3 + Math.random() * 3,
    });
  }

  private boom(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 220;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.35 + Math.random() * 0.3,
        max: 0.65,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 900 * dt;
      q.life -= dt;
      if (q.life <= 0) this.particles.splice(i, 1);
    }
  }

  /* ---------------- HUD ---------------- */

  private pushHud() {
    const b = this.boss;
    const hud: Hud = {
      stage: this.stage,
      form: this.form,
      lives: this.lives,
      allies: this.allies.length,
      allyCap: this.allyCapacity(),
      hard: this.hard,
      charge: this.charge / CHARGE_TIME,
      enemies: this.enemies.length,
      stars: this.starCount,
      bossActive: !!b && this.player.x > (b ? b.x - VIEW_W * 0.7 : Infinity),
      bossHp: b ? Math.max(0, b.hp) : 0,
      bossMaxHp: b ? b.maxHp : 1,
      phase: this.phase,
      toast: this.toastTimer > 0 ? this.toast : "",
    };
    const key = `${hud.stage}|${hud.form}|${hud.lives}|${hud.allies}/${hud.allyCap}|${Math.round(
      hud.charge * 20,
    )}|${hud.stars}|${hud.bossActive}|${hud.bossHp}|${hud.phase}|${hud.toast}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.onHud(hud);
  }

  /* ---------------- 렌더 ---------------- */

  private render() {
    const ctx = this.ctx;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;

    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawSky();
    ctx.translate(sx, sy);
    this.drawCity();
    this.drawLava();
    this.drawPlatforms();
    this.drawStars();
    this.drawEnemies();
    this.drawBoss();
    this.drawAllies();
    this.drawPlayer();
    this.drawSwings();
    this.drawBlades();
    this.drawMissiles();
    this.drawBullets();
    this.drawParticles();
    this.drawGoalArrow();
    ctx.restore();
  }

  private drawSky() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#3b82f6");
    g.addColorStop(0.45, "#7dd3fc");
    g.addColorStop(1, "#fde3c2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 해
    ctx.fillStyle = "rgba(255,214,120,0.85)";
    ctx.beginPath();
    ctx.arc(VIEW_W - 130, 90, 42, 0, Math.PI * 2);
    ctx.fill();

    // 구름
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 340 - this.camX * 0.08) % (VIEW_W + 400)) + -80;
      const cy = 60 + ((i * 47) % 90);
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.arc(cx + 26, cy + 6, 17, 0, Math.PI * 2);
      ctx.arc(cx - 24, cy + 8, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBuildings(list: Building[], par: number, body: string, win: string) {
    const ctx = this.ctx;
    const off = this.camX * par;
    for (const b of list) {
      const x = b.x - off;
      if (x + b.w < -40 || x > VIEW_W + 40) continue;
      ctx.fillStyle = body;
      ctx.fillRect(x, b.y, b.w, b.h);
      // 옥상 물탱크
      if (b.seed > 0.72) {
        ctx.fillRect(x + b.w * 0.3, b.y - 12, b.w * 0.22, 12);
      }
      // 창문
      ctx.fillStyle = win;
      const cols = Math.max(1, Math.floor(b.w / 16));
      const rows = Math.max(1, Math.floor(b.h / 22));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (((c * 7 + r * 13 + Math.floor(b.seed * 100)) % 5) === 0) continue;
          ctx.fillRect(x + 6 + c * 16, b.y + 10 + r * 22, 8, 11);
        }
      }
    }
  }

  private drawCity() {
    this.drawBuildings(this.city.far, 0.25, "#64748b", "rgba(226,232,240,0.5)");
    this.drawBuildings(this.city.mid, 0.55, "#475569", "rgba(253,224,71,0.65)");
  }

  private drawPlatforms() {
    const ctx = this.ctx;
    for (const p of this.level.platforms) {
      const x = p.x - this.camX;
      if (x + p.w < -30 || x > VIEW_W + 30) continue;
      // 건물 벽면
      ctx.fillStyle = "#334155";
      ctx.fillRect(x, p.y, p.w, p.h);
      // 벽면 창문 (아래로 갈수록 어두워짐)
      const rows = Math.min(5, Math.floor((VIEW_H - p.y) / 36));
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = `rgba(148,163,184,${0.3 - r * 0.05})`;
        for (let wx = 12; wx < p.w - 16; wx += 32) {
          ctx.fillRect(x + wx, p.y + 26 + r * 36, 13, 17);
        }
      }
      // 보도블록 윗면
      ctx.fillStyle = p.kind === "step" ? "#f59e0b" : "#94a3b8";
      ctx.fillRect(x, p.y, p.w, 10);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x, p.y, p.w, 3);
      ctx.fillStyle = "rgba(15,23,42,0.4)";
      ctx.fillRect(x, p.y + 10, p.w, 5);
    }
  }

  private drawLava() {
    const ctx = this.ctx;
    for (const l of this.level.lavas) {
      const x = l.x - this.camX;
      if (x + l.w < -30 || x > VIEW_W + 30) continue;
      const g = ctx.createLinearGradient(0, l.y, 0, l.y + l.h);
      g.addColorStop(0, "#fde047");
      g.addColorStop(0.25, "#f97316");
      g.addColorStop(1, "#b91c1c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, l.y + 6);
      for (let i = 0; i <= l.w; i += 12) {
        ctx.lineTo(x + i, l.y + 6 + Math.sin(this.time * 4 + i * 0.09) * 5);
      }
      ctx.lineTo(x + l.w, l.y + l.h);
      ctx.lineTo(x, l.y + l.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,237,160,0.55)";
      for (let i = 0; i < 3; i++) {
        const bx = x + ((i * 61 + this.time * 30) % l.w);
        const by = l.y + 12 + Math.sin(this.time * 3 + i) * 6;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawStars() {
    const ctx = this.ctx;
    for (const s of this.starPickups) {
      if (s.taken) continue;
      const x = s.x - this.camX;
      if (x < -40 || x > VIEW_W + 40) continue;
      const y = s.y + Math.sin(this.time * 3 + s.x * 0.01) * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(this.time * 2 + s.x * 0.02) * 0.25);
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#fff7ed";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 13 : 5.5;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private tank(
    x: number,
    y: number,
    w: number,
    h: number,
    dir: number,
    body: string,
    dark: string,
    face = true,
  ) {
    const ctx = this.ctx;
    // 궤도
    ctx.fillStyle = "#1f2937";
    roundRect(ctx, x, y + h - 12, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = "#4b5563";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + 8 + i * ((w - 16) / 3), y + h - 6, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 몸통
    ctx.fillStyle = body;
    roundRect(ctx, x + 2, y + h - 26, w - 4, 16, 5);
    ctx.fill();
    // 포탑
    ctx.fillStyle = dark;
    roundRect(ctx, x + w * 0.26, y + h - 36, w * 0.48, 13, 5);
    ctx.fill();
    // 포신
    const bx = dir > 0 ? x + w * 0.72 : x + w * 0.06;
    ctx.fillStyle = dark;
    ctx.fillRect(bx, y + h - 33, w * 0.24, 6);
    // 눈
    if (face) {
      ctx.fillStyle = "#fff";
      const ex = dir > 0 ? x + w * 0.58 : x + w * 0.32;
      ctx.beginPath();
      ctx.arc(ex, y + h - 19, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(ex + dir * 1.2, y + h - 19, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 검사 — 미사일 없이 검으로 싸운다
  private swordsman(x: number, y: number, w: number, h: number, dir: number) {
    const ctx = this.ctx;
    const cx = x + w / 2;
    const bob = Math.sin(this.time * 8) * (this.player.onGround ? 0 : 1.5);

    // 망토 (뒤쪽으로 펄럭)
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(cx - dir * 5, y + 15);
    ctx.lineTo(cx - dir * (20 + Math.sin(this.time * 6) * 3), y + 26);
    ctx.lineTo(cx - dir * 6, y + h - 12);
    ctx.closePath();
    ctx.fill();

    // 다리
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cx - 11, y + h - 15, 8, 15);
    ctx.fillRect(cx + 3, y + h - 15, 8, 15);
    ctx.fillStyle = "#78350f";
    ctx.fillRect(cx - 12, y + h - 4, 10, 4);
    ctx.fillRect(cx + 2, y + h - 4, 10, 4);

    // 몸통 (파란 갑옷)
    ctx.fillStyle = "#2563eb";
    roundRect(ctx, cx - 12, y + 15 + bob, 24, 26, 7);
    ctx.fill();
    ctx.fillStyle = "#60a5fa";
    roundRect(ctx, cx - 8, y + 19 + bob, 16, 8, 3);
    ctx.fill();
    // 허리띠
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(cx - 12, y + 33 + bob, 24, 4);

    // 머리
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.arc(cx, y + 11 + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    // 머리띠 + 흩날리는 끈
    ctx.fillStyle = "#fb923c";
    ctx.fillRect(cx - 11, y + 3 + bob, 22, 5);
    ctx.fillRect(
      cx - dir * 11 - (dir > 0 ? 10 : 0),
      y + 4 + bob,
      10,
      3,
    );
    // 눈
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(cx + dir * 4, y + 12 + bob, 2.3, 0, Math.PI * 2);
    ctx.fill();

    // 검 (은색 날 + 금색 손잡이). 막는 중이면 앞에 세워 든다.
    ctx.save();
    if (this.guarding) {
      ctx.translate(cx + dir * 16, y + 36 + bob);
      ctx.rotate(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    } else {
      ctx.translate(cx + dir * 11, y + 24 + bob);
      ctx.rotate(dir > 0 ? -0.75 : 0.75 + Math.PI);
    }
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(0, -3.5);
    ctx.lineTo(30, -2.5);
    ctx.lineTo(36, 0);
    ctx.lineTo(30, 2.5);
    ctx.lineTo(0, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, -3, 30, 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(-3, -6, 4, 12); // 코등이
    ctx.fillStyle = "#78350f";
    ctx.fillRect(-10, -3, 7, 6); // 손잡이
    ctx.restore();

    // 막는 중이면 앞쪽에 빛나는 방어막
    if (this.guarding) {
      const hit = this.guardFlash > 0;
      ctx.save();
      ctx.translate(cx, y + h / 2);
      ctx.scale(dir, 1);
      ctx.strokeStyle = hit ? "#fde047" : "rgba(125,211,252,0.9)";
      ctx.lineWidth = hit ? 9 : 5;
      ctx.beginPath();
      ctx.arc(6, 0, 30, -1.15, 1.15);
      ctx.stroke();
      ctx.fillStyle = hit
        ? "rgba(253,224,71,0.35)"
        : "rgba(125,211,252,0.22)";
      ctx.beginPath();
      ctx.arc(6, 0, 30, -1.15, 1.15);
      ctx.lineTo(6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawSwings() {
    const ctx = this.ctx;
    for (const s of this.swings) {
      const t = 1 - s.life / SWING_LIFE; // 0 → 1 로 훑고 지나간다
      const a = -1.15 + t * 2.3;
      ctx.save();
      ctx.translate(s.x - this.camX - s.dir * SWING_REACH * 0.6, s.y);
      ctx.scale(s.dir, 1);
      ctx.strokeStyle = s.kind === "special" ? "#fb923c" : "#f1f5f9";
      ctx.lineWidth = s.kind === "special" ? 10 : 7;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.35 + 0.65 * (1 - t);
      ctx.beginPath();
      ctx.arc(0, 0, SWING_REACH * 0.8, a - 0.55, a + 0.55);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // 회전하며 날아가는 거대 칼날
  private drawBlades() {
    const ctx = this.ctx;
    for (const b of this.blades) {
      const x = b.x - this.camX;
      ctx.save();
      ctx.translate(x, b.y);
      // 지나온 자리에 남는 불꽃 꼬리 (뒤로 갈수록 옅어지게)
      const tail = ctx.createLinearGradient(-b.dir * 120, 0, 0, 0);
      tail.addColorStop(0, "rgba(251,146,60,0)");
      tail.addColorStop(0.6, "rgba(251,146,60,0.35)");
      tail.addColorStop(1, "rgba(253,224,71,0.7)");
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.moveTo(-b.dir * 120, -3);
      ctx.lineTo(0, -20);
      ctx.lineTo(0, 20);
      ctx.lineTo(-b.dir * 120, 3);
      ctx.closePath();
      ctx.fill();

      ctx.rotate(b.spin * b.dir);
      // 바깥 광채
      ctx.strokeStyle = "rgba(251,146,60,0.85)";
      ctx.lineWidth = 6;
      // 초승달 모양 칼날
      const crescent = () => {
        ctx.beginPath();
        ctx.arc(0, 0, 40, -1.05, 1.05);
        ctx.arc(20, 0, 34, 1.15, -1.15, true);
        ctx.closePath();
      };
      crescent();
      ctx.stroke();
      ctx.fillStyle = "#e2e8f0";
      crescent();
      ctx.fill();
      // 날 선
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 37, -0.95, 0.95);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    if (p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0) return;
    const x = p.x - this.camX;
    if (p.form === "sword") this.swordsman(x, p.y, p.w, p.h, p.dir);
    else this.tank(x, p.y, p.w, p.h, p.dir, "#fb923c", "#c2410c");

    // 충전 게이지
    if (this.charge > 0.05) {
      const t = this.charge / CHARGE_TIME;
      ctx.strokeStyle = t >= 1 ? "#ef4444" : "#fde047";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        x + p.w / 2,
        p.y - 16,
        11,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * t,
      );
      ctx.stroke();
      if (t > 0.75) {
        ctx.fillStyle = "rgba(253,224,71,0.9)";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚡", x + p.w / 2, p.y - 11);
      }
    }
  }

  private drawAllies() {
    const ctx = this.ctx;
    for (const a of this.allies) {
      const x = a.x - this.camX;
      // 머리 위 체력 5칸 (한 칸 = 체력 4). 항상 보인다.
      const ratio = Math.max(0, a.hp / a.maxHp);
      const filled = Math.ceil(ratio * ALLY_HP_SEGS);
      const segW = 7;
      const gap = 2;
      const totalW = ALLY_HP_SEGS * segW + (ALLY_HP_SEGS - 1) * gap;
      const bx = x + (a.w - totalW) / 2;
      const by = a.y - 12;
      const color = ratio > 0.5 ? "#38bdf8" : ratio > 0.25 ? "#fbbf24" : "#ef4444";
      for (let i = 0; i < ALLY_HP_SEGS; i++) {
        const sx = bx + i * (segW + gap);
        ctx.fillStyle = "rgba(15,23,42,0.55)"; // 하늘색 배경에서도 보이게 테두리
        ctx.fillRect(sx - 1, by - 1, segW + 2, 8);
        ctx.fillStyle = i < filled ? color : "rgba(226,232,240,0.3)";
        ctx.fillRect(sx, by, segW, 6);
      }
      this.tank(x, a.y, a.w, a.h, -this.player.dir, "#38bdf8", "#0369a1");
    }
  }

  private drawEnemies() {
    const ctx = this.ctx;
    for (const e of this.enemies) {
      const x = e.x - this.camX;
      if (x + e.w < -40 || x > VIEW_W + 40) continue;
      // 몸
      ctx.fillStyle = "#7c3aed";
      roundRect(ctx, x, e.y + 6, e.w, e.h - 6, 8);
      ctx.fill();
      // 뿔
      ctx.fillStyle = "#4c1d95";
      ctx.beginPath();
      ctx.moveTo(x + 6, e.y + 8);
      ctx.lineTo(x + 12, e.y - 4);
      ctx.lineTo(x + 18, e.y + 8);
      ctx.moveTo(x + e.w - 18, e.y + 8);
      ctx.lineTo(x + e.w - 12, e.y - 4);
      ctx.lineTo(x + e.w - 6, e.y + 8);
      ctx.fill();
      // 눈
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + e.w * 0.34, e.y + 18, 5, 0, Math.PI * 2);
      ctx.arc(x + e.w * 0.68, e.y + 18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(x + e.w * 0.34 + e.dir * 1.6, e.y + 18, 2.4, 0, Math.PI * 2);
      ctx.arc(x + e.w * 0.68 + e.dir * 1.6, e.y + 18, 2.4, 0, Math.PI * 2);
      ctx.fill();
      // 체력 점
      if (e.maxHp > 1) {
        for (let i = 0; i < e.maxHp; i++) {
          ctx.fillStyle = i < e.hp ? "#fde047" : "rgba(255,255,255,0.25)";
          ctx.fillRect(x + 4 + i * 9, e.y - 12, 6, 4);
        }
      }
    }
  }

  private drawBoss() {
    const b = this.boss;
    if (!b) return;
    const ctx = this.ctx;
    const x = b.x - this.camX;
    if (x + b.w < -80 || x > VIEW_W + 80) return;

    ctx.save();
    if (b.hurt > 0) ctx.globalAlpha = 0.6;
    // 궤도
    ctx.fillStyle = "#111827";
    roundRect(ctx, x, b.y + b.h - 26, b.w, 26, 10);
    ctx.fill();
    ctx.fillStyle = "#374151";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x + 16 + i * ((b.w - 32) / 4), b.y + b.h - 13, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // 몸통
    ctx.fillStyle = b.hurt > 0 ? "#fca5a5" : "#dc2626";
    roundRect(ctx, x + 4, b.y + 34, b.w - 8, b.h - 56, 12);
    ctx.fill();
    // 포탑 + 포신 3문 (바라보는 쪽으로 튀어나오게)
    ctx.fillStyle = "#7f1d1d";
    roundRect(ctx, x + b.w * 0.28, b.y + 4, b.w * 0.44, 38, 10);
    ctx.fill();
    const bw = b.w * 0.3;
    const bx = b.dir > 0 ? x + b.w * 0.72 : x + b.w * 0.28 - bw;
    for (const dy of [10, 21, 32]) {
      ctx.fillRect(bx, b.y + dy, bw, 7);
    }
    // 화난 눈
    ctx.fillStyle = "#fde047";
    const ex = b.dir > 0 ? x + b.w * 0.6 : x + b.w * 0.28;
    ctx.beginPath();
    ctx.arc(ex, b.y + 58, 11, 0, Math.PI * 2);
    ctx.arc(ex + b.dir * 26, b.y + 58, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(ex + b.dir * 3, b.y + 58, 5, 0, Math.PI * 2);
    ctx.arc(ex + b.dir * 29, b.y + 58, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMissiles() {
    const ctx = this.ctx;
    for (const m of this.missiles) {
      const x = m.x - this.camX;
      const dir = Math.sign(m.vx);
      const big = m.kind === "special";
      // 꼬리
      ctx.fillStyle = big ? "rgba(249,115,22,0.45)" : "rgba(251,191,36,0.35)";
      ctx.fillRect(x - dir * 22, m.y - (big ? 4 : 2.5), 22, big ? 8 : 5);
      // 몸통
      ctx.fillStyle = big ? "#f97316" : m.from === "ally" ? "#38bdf8" : "#fbbf24";
      roundRect(ctx, x - 9, m.y - (big ? 6 : 4), big ? 22 : 18, big ? 12 : 8, 4);
      ctx.fill();
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(x + dir * 8, m.y, big ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBullets() {
    const ctx = this.ctx;
    for (const s of this.bullets) {
      const x = s.x - this.camX;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(x, s.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(254,215,170,0.9)";
      ctx.beginPath();
      ctx.arc(x - 2, s.y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawParticles() {
    const ctx = this.ctx;
    for (const q of this.particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - this.camX, q.y, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawGoalArrow() {
    const b = this.boss;
    if (!b) return;
    const ctx = this.ctx;
    const screenX = b.x - this.camX;
    if (screenX < VIEW_W - 40) return; // 보스가 화면에 있으면 화살표 없음
    const y = 118 + Math.sin(this.time * 4) * 6;
    ctx.fillStyle = "rgba(239,68,68,0.9)";
    ctx.beginPath();
    ctx.moveTo(VIEW_W - 26, y);
    ctx.lineTo(VIEW_W - 58, y - 15);
    ctx.lineTo(VIEW_W - 58, y + 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("보스", VIEW_W - 64, y + 5);
  }
}
