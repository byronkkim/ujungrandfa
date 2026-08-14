"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TankGame, VIEW_H, VIEW_W, type GameInput, type Hud } from "@/lib/tankGame";

const KEY_MAP: Record<string, keyof GameInput> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  KeyX: "fire",
  KeyZ: "fire",
  KeyJ: "fire",
  // Enter는 넣지 않는다 — 포커스된 버튼을 누르는 키라서 발사가 눌린 채로 남는다
  ArrowDown: "guard",
  KeyS: "guard",
  KeyC: "guard",
  ShiftLeft: "guard",
  ShiftRight: "guard",
};

// 화면에 겹쳐 올리는 반투명 조작 버튼.
// 색은 버튼마다 따로 주므로 여기에는 배경색을 넣지 않는다(Tailwind 클래스가 서로 덮어씀).
const PAD =
  "h-[3.25rem] w-[3.25rem] rounded-full border-2 text-xl text-white shadow-lg backdrop-blur-sm";
const PAD_BIG =
  "h-16 w-16 rounded-full border-2 text-2xl text-white shadow-lg backdrop-blur-sm";

const INITIAL_HUD: Hud = {
  stage: 1,
  form: "tank",
  lives: 5,
  allies: 0,
  allyCap: 2,
  charge: 0,
  enemies: 0,
  stars: 0,
  bossActive: false,
  bossHp: 0,
  bossMaxHp: 1,
  phase: "playing",
  toast: "",
};

// 화면 조작 버튼 (누르는 동안 입력 유지)
function PadButton({
  label,
  sub,
  onDown,
  onUp,
  className,
}: {
  label: string;
  sub?: string;
  onDown: () => void;
  onUp: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        // 포인터 캡처가 실패해도 입력은 반드시 들어가야 한다
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 캡처 불가한 포인터는 그냥 무시 */
        }
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-none select-none rounded-2xl border-2 font-bold shadow-sm transition active:scale-95 ${className}`}
    >
      <span className="block leading-none">{label}</span>
      {sub && <span className="mt-1 block text-[10px] font-normal opacity-70">{sub}</span>}
    </button>
  );
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TankGame | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  // 시작 화면에서 고른 단계 (R키 핸들러에서도 읽어야 해서 ref로도 들고 있는다)
  const [stagePick, setStagePick] = useState(1);
  const stagePickRef = useRef(1);
  // 🥚 숨겨둔 치트키 — 한 판에 한 번만, 쓰고 나면 화살표가 사라진다
  const [cheatOpen, setCheatOpen] = useState(false);
  const [cheatText, setCheatText] = useState("");
  const [cheatUsed, setCheatUsed] = useState(false);
  const [cheatMiss, setCheatMiss] = useState(false);
  const cheatUsedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new TankGame(canvas, setHud);
    gameRef.current = game;
    // 개발 중에만 콘솔에서 게임 상태를 들여다볼 수 있게 열어둔다(배포 빌드에는 없음)
    if (process.env.NODE_ENV === "development") {
      (window as unknown as Record<string, unknown>).__tankGame = game;
    }
    game.setPaused(true); // 시작 화면에서는 멈춰 있는다
    game.start();

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.repeat) return;
      // 치트키 입력칸에 타자를 칠 때는 게임 조작으로 먹지 않게 한다
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      const action = KEY_MAP[e.code];
      if (action) {
        e.preventDefault();
        game.enableAudio();
        game.setInput({ [action]: down });
        return;
      }
      if (down && e.code === "KeyR") game.restart(stagePickRef.current);
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const blur = () =>
      game.setInput({
        left: false,
        right: false,
        jump: false,
        fire: false,
        guard: false,
      });
    // 다른 탭으로 가면 자동으로 멈춤
    const hide = () => {
      if (document.hidden) {
        game.setPaused(true);
        setPaused(true);
      }
    };

    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hide);
      game.stop();
      gameRef.current = null;
    };
  }, []);

  const set = useCallback((k: keyof GameInput, v: boolean) => {
    gameRef.current?.enableAudio();
    gameRef.current?.setInput({ [k]: v });
  }, []);

  // 단계를 고르면 배경도 바로 그 단계로 바뀐다(고르는 재미 + 미리보기)
  const pickStage = useCallback((n: number) => {
    stagePickRef.current = n;
    setStagePick(n);
    gameRef.current?.restart(n);
  }, []);

  const play = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.enableAudio();
    game.restart(stagePickRef.current);
    // 시작 화면에서 미리 입력해둔 치트키는 그대로 이어간다
    if (cheatUsedRef.current) game.setCheat(true);
    game.setPaused(false);
    setStarted(true);
    setPaused(false);
  }, []);

  // 치트키 제출 — 맞으면 발동하고 화살표가 사라진다. 틀리면 다시 해볼 수 있다.
  const submitCheat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (cheatText.replace(/\s/g, "") === "이재온") {
        gameRef.current?.setCheat(true);
        cheatUsedRef.current = true;
        setCheatUsed(true);
        setCheatOpen(false);
        setCheatText("");
        setCheatMiss(false);
      } else {
        setCheatMiss(true);
        setCheatText("");
      }
    },
    [cheatText],
  );

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    setPaused((p) => {
      game.setPaused(!p);
      return !p;
    });
  }, []);

  const toggleMute = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    setMuted((m) => {
      game.setMuted(!m);
      return !m;
    });
  }, []);

  // 새 판이므로 치트키도 초기화 (화살표가 다시 나타난다)
  const resetCheat = useCallback(() => {
    cheatUsedRef.current = false;
    setCheatUsed(false);
    setCheatOpen(false);
    setCheatText("");
    setCheatMiss(false);
  }, []);

  const restart = useCallback(() => {
    gameRef.current?.restart(stagePickRef.current);
    gameRef.current?.setPaused(false);
    setPaused(false);
    resetCheat();
  }, [resetCheat]);

  // 휴대폰에서는 주소창이 화면을 잡아먹어서 전체화면이 훨씬 편하다
  const toggleFullscreen = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  // 게임 오버에서 시작 화면으로 돌아가 단계를 다시 고른다
  const backToStart = useCallback(() => {
    gameRef.current?.restart(stagePickRef.current);
    gameRef.current?.setPaused(true);
    setStarted(false);
    setPaused(false);
    resetCheat();
  }, [resetCheat]);

  return (
    <main
      ref={mainRef}
      className="game-main mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 overscroll-contain px-3 py-4"
    >
      {/* 상단 정보 */}
      <div className="game-topbar flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          ← 돌아가기
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-700">
          <span className="rounded-lg bg-orange-100 px-2 py-1 text-orange-800">
            {hud.stage}단계
          </span>
          <span
            className={`rounded-lg px-2 py-1 ${
              hud.form === "sword"
                ? "bg-slate-200 text-slate-800"
                : "bg-orange-50 text-orange-700"
            }`}
          >
            {hud.form === "sword" ? "🗡️ 검사" : "🛡️ 탱크"}
          </span>
          {/* 치트키로 하트가 많아지면 이모지를 줄줄이 늘어놓지 않고 숫자로 */}
          <span aria-label={`남은 하트 ${hud.lives}개`}>
            {hud.lives === 0
              ? "💀"
              : hud.lives > 5
                ? `❤️ ×${hud.lives}`
                : "❤️".repeat(hud.lives)}
          </span>
          <span className="rounded-lg bg-yellow-100 px-2 py-1 text-yellow-800">
            ⭐ {hud.stars}
          </span>
          <span className="rounded-lg bg-blue-100 px-2 py-1 text-blue-800">
            🚙 {hud.allies}/{hud.allyCap}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg border border-slate-300 px-2 py-1"
            aria-label={muted ? "소리 켜기" : "소리 끄기"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            type="button"
            onClick={togglePause}
            disabled={!started}
            className="rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-40"
            aria-label={paused ? "계속하기" : "잠깐 멈추기"}
          >
            {paused ? "▶️" : "⏸️"}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg border border-slate-300 px-2 py-1"
            aria-label="전체화면"
          >
            ⛶
          </button>
          {/* 🥚 숨겨둔 치트키 화살표 — 한 번 쓰면 사라진다 */}
          {!cheatUsed && (
            <button
              type="button"
              onClick={() => setCheatOpen((v) => !v)}
              className="px-1 text-slate-400 opacity-40 transition hover:opacity-100"
              aria-label="비밀"
            >
              {cheatOpen ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>

      {/* 🥚 치트키 입력칸 (화살표를 눌렀을 때만) */}
      {cheatOpen && !cheatUsed && (
        <form
          onSubmit={submitCheat}
          className="flex items-center justify-end gap-2"
        >
          <input
            type="text"
            value={cheatText}
            onChange={(e) => setCheatText(e.target.value)}
            placeholder="비밀 낱말"
            autoFocus
            className="w-36 rounded-lg border-2 border-slate-300 px-3 py-1 text-sm text-slate-800 outline-none focus:border-orange-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-bold text-white shadow hover:bg-orange-600"
          >
            제출
          </button>
          {cheatMiss && (
            <span className="text-sm font-bold text-slate-400">땡! 🙅</span>
          )}
        </form>
      )}

      {/* 휴대폰을 세로로 들고 있을 때 안내 */}
      <p className="rotate-hint items-center justify-center gap-2 rounded-xl bg-orange-100 px-3 py-2 text-center text-sm font-bold text-orange-800">
        🔄 휴대폰을 가로로 돌리면 더 크게 할 수 있어요
      </p>

      {/* 게임 화면 — 가로 화면에서는 높이에 맞춰 폭이 정해진다(globals.css) */}
      <div className="game-stage relative mx-auto w-full touch-none overflow-hidden rounded-2xl border-4 border-slate-800 bg-slate-900 shadow-lg">
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="block w-full"
          style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, height: "auto" }}
        />

        {/* 보스 체력바 */}
        {hud.bossActive && (
          <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-[70%]">
            <div className="mb-1 text-center text-xs font-bold text-white drop-shadow">
              👹 보스
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full border-2 border-white/70 bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-[width] duration-200"
                style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 충전 게이지 */}
        {hud.charge > 0.02 && (
          <div className="pointer-events-none absolute bottom-2 left-2 w-40">
            <div className="mb-1 text-[11px] font-bold text-white drop-shadow">
              필살기 충전 {hud.charge >= 1 ? "완료!" : ""}
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full bg-gradient-to-r from-yellow-300 to-orange-500"
                style={{ width: `${Math.min(100, hud.charge * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* 알림 */}
        {hud.toast && hud.phase === "playing" && (
          <div className="pointer-events-none absolute inset-x-0 top-16 text-center">
            <span className="rounded-full bg-black/60 px-4 py-1 text-sm font-bold text-white">
              {hud.toast}
            </span>
          </div>
        )}

        {/* 시작 화면 — 작은 화면에서도 시작 버튼이 잘리지 않게 촘촘하게 + 스크롤 허용 */}
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 overflow-y-auto bg-slate-900/75 px-3 py-2 text-center sm:gap-3">
            <p className="text-lg font-bold text-orange-300 sm:text-4xl">
              🚀 우주의 탱크 게임
            </p>
            <p className="text-[11px] text-slate-200 sm:text-sm">
              ← → 이동 · Space 점프 · X 발사(2초 꾹 = 필살기) · Shift 방어
            </p>
            <p className="hidden text-xs text-slate-300 sm:block">
              별을 모으고, 오른쪽 끝의 보스를 물리쳐요
            </p>

            {/* 시작할 단계 고르기 */}
            <p className="text-[11px] font-bold text-slate-200 sm:text-xs">
              몇 단계부터 시작할까요?
            </p>
            <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickStage(n)}
                  aria-pressed={stagePick === n}
                  className={`h-7 w-7 rounded-lg border-2 text-xs font-bold transition sm:h-9 sm:w-9 sm:text-sm ${
                    stagePick === n
                      ? "border-orange-300 bg-orange-500 text-white"
                      : "border-slate-500 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              단계가 높으면 적과 보스가 더 강해요
            </p>

            <button
              type="button"
              onClick={play}
              className="shrink-0 rounded-xl bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow hover:bg-orange-600 sm:px-8 sm:py-3 sm:text-lg"
            >
              {stagePick}단계부터 시작하기
            </button>
          </div>
        )}

        {/* 일시정지 */}
        {started && paused && hud.phase === "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-center">
            <p className="text-2xl font-bold text-white">잠깐 멈춤</p>
            <button
              type="button"
              onClick={togglePause}
              className="rounded-xl bg-orange-500 px-6 py-3 text-lg font-bold text-white shadow hover:bg-orange-600"
            >
              계속하기
            </button>
          </div>
        )}

        {/* 단계 클리어 / 게임 오버 */}
        {hud.phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-center">
            {hud.phase === "clear" ? (
              <>
                <p className="text-3xl font-bold text-yellow-300">
                  🎉 {hud.stage}단계 클리어!
                </p>
                <p className="text-white">다음 단계로 이동 중…</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-red-400">
                  🗡️ 검사도 쓰러졌다…
                </p>
                <p className="text-white">
                  {hud.stage}단계까지 · 별 {hud.stars}개
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={restart}
                    className="rounded-xl bg-orange-500 px-6 py-3 text-lg font-bold text-white shadow hover:bg-orange-600"
                  >
                    {stagePick}단계 다시 하기
                  </button>
                  <button
                    type="button"
                    onClick={backToStart}
                    className="rounded-xl border-2 border-slate-400 px-6 py-3 text-lg font-bold text-slate-100 hover:bg-slate-700"
                  >
                    단계 고르기
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 반투명 터치 컨트롤러 — 화면 네 모서리에 고정해서 엄지가 닿는 곳에 둔다.
          왼쪽 = 좌우 이동, 오른쪽 = 방어·점프·공격 */}
      {/* 버튼을 조건부로 없애면 안 된다 — 누르고 있는 중에 사라지면 손을 떼는 신호를
          받을 대상이 없어져서 입력이 눌린 채로 남는다(보스 격파 후 자동 공격 버그) */}
      {started && (
        <div
          className={`pointer-events-none fixed inset-0 z-30 select-none transition-opacity lg:hidden ${
            hud.phase === "playing" && !paused ? "" : "opacity-30"
          }`}
        >
          <div className="pointer-events-auto absolute bottom-3 left-3 flex items-end gap-3">
            <PadButton
              label="◀"
              onDown={() => set("left", true)}
              onUp={() => set("left", false)}
              className={`${PAD} border-white/70 bg-slate-900/30`}
            />
            <PadButton
              label="▶"
              onDown={() => set("right", true)}
              onUp={() => set("right", false)}
              className={`${PAD} border-white/70 bg-slate-900/30`}
            />
          </div>
          <div className="pointer-events-auto absolute bottom-3 right-3 flex items-end gap-3">
            <PadButton
              label="🛡️"
              onDown={() => set("guard", true)}
              onUp={() => set("guard", false)}
              className={`${PAD} border-sky-200/80 bg-sky-400/40 ${
                hud.form === "sword" ? "" : "opacity-35"
              }`}
            />
            <PadButton
              label="▲"
              onDown={() => set("jump", true)}
              onUp={() => set("jump", false)}
              className={`${PAD} border-blue-200/80 bg-blue-500/45`}
            />
            <PadButton
              label="●"
              onDown={() => set("fire", true)}
              onUp={() => set("fire", false)}
              className={`${PAD_BIG} border-orange-200/90 bg-orange-500/50`}
            />
          </div>
        </div>
      )}

      {/* 화면 아래 조작 버튼 — 큰 화면(PC)용.
          작은 화면에서는 위의 반투명 컨트롤러를 쓴다 */}
      <div className="hidden items-end justify-between gap-2 sm:gap-3 lg:flex">
        <div className="flex gap-1.5 sm:gap-2">
          <PadButton
            label="◀"
            onDown={() => set("left", true)}
            onUp={() => set("left", false)}
            className="h-14 w-14 border-slate-400 bg-white text-xl text-slate-700 sm:h-16 sm:w-20 sm:text-2xl"
          />
          <PadButton
            label="▶"
            onDown={() => set("right", true)}
            onUp={() => set("right", false)}
            className="h-14 w-14 border-slate-400 bg-white text-xl text-slate-700 sm:h-16 sm:w-20 sm:text-2xl"
          />
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          {/* 방어는 검사만 쓸 수 있지만, 버튼은 항상 보여준다(탱크일 때는 흐리게) */}
          <PadButton
            label="방어"
            sub={hud.form === "sword" ? "Shift" : "검사 전용"}
            onDown={() => set("guard", true)}
            onUp={() => set("guard", false)}
            className={`h-14 w-16 border-sky-400 bg-sky-100 text-sm text-sky-900 sm:h-16 sm:w-20 sm:text-lg ${
              hud.form === "sword" ? "" : "opacity-40"
            }`}
          />
          <PadButton
            label="점프"
            sub="Space"
            onDown={() => set("jump", true)}
            onUp={() => set("jump", false)}
            className="h-14 w-16 border-blue-400 bg-blue-100 text-sm text-blue-900 sm:h-16 sm:w-24 sm:text-lg"
          />
          <PadButton
            label="발사"
            sub="2초 꾹 = 필살기"
            onDown={() => set("fire", true)}
            onUp={() => set("fire", false)}
            className="h-14 w-20 border-orange-400 bg-orange-100 text-sm text-orange-900 sm:h-16 sm:w-32 sm:text-lg"
          />
        </div>
      </div>

      <details className="game-extra rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">
          게임 방법
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>시작 화면에서 <b>1~10단계</b> 중 원하는 단계를 골라 시작할 수 있어요.</li>
          <li>
            키보드: ← → 이동, Space/↑ 점프, X 발사, <b>Shift(또는 ↓ · S · C) 방어</b>,
            R 고른 단계부터 다시
          </li>
          <li>발사 버튼을 2초 동안 꾹 누르면 미사일 3발이 나가는 필살기!</li>
          <li>미사일은 0.3초에 한 발씩 나가요.</li>
          <li>구멍과 용암 위에 떠 있는 ⭐를 점프해서 모아요.</li>
          <li>
            적을 물리치면 10% 확률로 아군 탱크가 합류해요. 아군은 내 뒤쪽을
            지켜줘요. 데리고 다닐 수 있는 수는 <b>판마다 2대씩 늘어나요</b>
            (1단계 2대, 2단계 4대, 10단계 20대…).
          </li>
          <li>
            아군 탱크도 체력이 있어요(머리 위 5칸). 적과 부딪히거나 보스
            미사일을 맞으면 줄어들고, 다 없어지면 사라져요. 단계를 넘어가면
            체력을 10 회복해요.
          </li>
          <li>보스 앞에서 뒤돌아서면(보스 반대쪽을 보면) 아군 탱크들이 보스를 대신 쏴줘요!</li>
          <li>구멍과 용암에 빠지면 하트가 하나 줄어요. 단계를 깨면 하트가 다시 채워져요.</li>
          <li>보스는 일반 7번, 필살기 4번, 섞어서 쏘면 3번에 물리칠 수 있어요!</li>
          <li>
            🗡️ 탱크의 하트가 다 없어지면 <b>검사</b>가 나와요! 하트는 3개,
            공격력은 탱크와 똑같아요. 검사는 미사일 대신 <b>검</b>을 휘두르니까
            적에게 바짝 붙어야 해요. 검사의 필살기는 <b>거대 칼날</b>을 날려요 —
            칼날에 닿은 적은 체력과 상관없이 모두 쓰러져요! (보스는 예외)
          </li>
          <li>
            🛡️ 검사는 <b>방어</b>도 할 수 있어요 (🛡️ 버튼 또는 ↓ / Shift 키를 꾹).
            막는 동안에는 적도 보스 미사일도 하트를 깎지 못하고 튕겨나가요. 대신
            막는 동안에는 움직이거나 공격할 수 없고, 구멍과 용암은 못 막아요.
          </li>
        </ul>
      </details>
    </main>
  );
}
