# ⭐ 별 모으기 (ujungrandfa)

할아버지가 별과 편지를 보내면, 손자("우주")가 우주 하늘 별판에 별을 모으는 가족용 웹앱.

**라이브**: https://ujungrandfa.vercel.app
- 👴 할아버지: https://ujungrandfa.vercel.app/grandpa
- 🌌 우주(손자): https://ujungrandfa.vercel.app/grandson

스택: **Next.js 16 (App Router) + Supabase(DB·Realtime) + Vercel + GitHub**

---

## 기능

**할아버지 (`/grandpa`)**
- `큰별 보내기`/`작은별 보내기`로 보낼 별을 쌓고, 편지(이모티콘 원터치 입력)를 적어 **📨 보내기**
- 보낼 때마다 **전달 기록**에 "○월 ○일 · 별 N개와 함께 + 편지" 저장
- 우주가 20칸을 다 채우면 "우주가 모든 별을 모았습니다" + **🔄 초기화하기** 버튼

**우주/손자 (`/grandson`)**
- 받은 별을 우주 하늘의 빈 별(큰별 10 + 작은별 10) 자리에 **드래그&드롭**으로 배치 (크기 매칭)
- 배치한 별도 다시 끌어 **이동**하거나 "받은 별" 트레이로 끌어 **빼기** 가능
- **✨ 합치기**(미배치 작은별 3 → 큰별 1) / **✂️ 나누기**(미배치 큰별 1 → 작은별 3)
- 할아버지의 편지가 별과 함께 표시됨
- 20칸 모두 채우면 **🎉 축하합니다!**

**규칙**: 작은별 3개 = 큰별 1개. 두 페이지는 Supabase Realtime으로 즉시 동기화.

**🎮 탱크 게임 (`/game`)** — 우주가 주문한 사이드스크롤 플랫폼 게임 (DB 없이 캔버스만 사용)
- 탱크로 이동/점프, 좌우로 미사일 발사(0.3초에 한 발). 발사 버튼을 **2초 꾹** 누르면 3연발 **필살기**
- 적을 물리치면 **10% 확률**로 아군 탱크 합류. 아군은 나를 따라다니며 **내 뒤쪽만** 사격, 서로 겹침
- 데리고 다닐 수 있는 아군 수는 **판마다 2대씩 늘어남**(1단계 2 → 2단계 4 → … 5단계에서 최대 10대). 상단에 `🚙 현재/최대`로 표시
- 아군 탱크도 **체력 20**: 적·보스와 부딪히면 1(0.5초에 한 번), 보스 미사일은 3씩 깎이고 0이 되면 격파되어 사라진다. 머리 위에 **체력 5칸**(한 칸 = 4)을 항상 표시하고 남은 양에 따라 파랑→노랑→빨강으로 바뀐다. **단계를 넘어가면 체력을 10 회복**(최대 20까지)
- 아군 미사일도 보스에게 데미지(1). 내 일반 공격(4)보다 약해서 아래 보스 격파 횟수 규칙은 그대로. 보스를 등지고 서면 아군이 보스를 쏴준다
- 지형: 평지 / 계단 / 구멍 / 용암 (구멍·용암은 점프로 넘고, 그 위의 ⭐를 주우면 점수)
- 보스: **일반 7번 / 필살기 4번 / 둘을 섞으면 3번**에 격파 (다른 종류를 연달아 맞히면 콤보 3배 데미지)
- 단계가 오르면 보스 체력·적 체력·적 수가 늘고, 단계를 깨면 하트가 다시 채워지며 아군은 데려감
- 🗡️ **검사**: 탱크의 하트가 다 없어지면 게임 오버 대신 검사로 변신(하트 3). 일반 공격력·발사 간격은 탱크와 동일하지만 미사일 대신 **검을 휘두르는 근접 공격**이라 붙어야 한다. 검사까지 쓰러지면 게임 오버
- 검사는 **방어**도 가능 (🛡️ 버튼 / ↓·S·C·Shift 꾹). 막는 동안 적 접촉과 보스 미사일을 피해 없이 튕겨내지만, 이동·공격이 봉인되고 구멍·용암은 못 막는다. 탱크는 방어 불가
- 검사의 필살기는 **날아가는 거대 칼날**: 닿은 일반 적은 체력과 상관없이 즉사하고 칼날은 뚫고 계속 나아간다. **보스는 예외**로 즉사하지 않고 필살기 한 번만큼(7)만 깎이므로 위 격파 횟수 규칙은 그대로
- 키보드(← → / Space / X / Shift)와 화면 터치 버튼 모두 지원, 소리는 웹오디오로 합성(음소거 가능)
- **스마트폰 가로 화면 지원**: 화면 모서리에 고정된 반투명 컨트롤러(왼쪽 = 좌우 이동, 오른쪽 = 방어·점프·공격), 가로일 때 캔버스가 화면 높이에 맞춰 커지고 부가 UI는 숨김(`globals.css`의 `@media (orientation: landscape)`), 세로로 들면 "가로로 돌리세요" 안내, 상단 `⛶` 전체화면 버튼
- 시작 화면에서 **1~10단계 중 원하는 단계를 골라 시작** (고르면 배경도 그 단계로 미리 바뀜). 게임 오버 후 `단계 고르기`로 다시 선택, `R`키는 고른 단계부터 재시작

**🥚 이스터에그**: 할아버지가 큰별 10 + 작은별 10을 만들고, 편지에 별(⭐/🌟) 10개를 찍어 보내면 → 우주가 받은 별이 전부 초기화(편지는 남음). 구현: [`src/app/grandpa/page.tsx`](src/app/grandpa/page.tsx)의 `send()`.

---

## 코드 구조

```
src/
├─ app/
│  ├─ layout.tsx           # 루트 + 타이틀 템플릿("별 모으기 - %s")
│  ├─ page.tsx             # 시작 화면
│  ├─ grandpa/{layout,page}.tsx   # 할아버지 (타이틀: 별 모으기 - 할아버지)
│  ├─ grandson/{layout,page}.tsx  # 우주/손자 (타이틀: 별 모으기 - 우주)
│  └─ game/{layout,page}.tsx      # 탱크 게임 화면 + 키보드/터치 조작 (타이틀: 별 모으기 - 탱크 게임)
├─ components/
│  ├─ StarIcon.tsx         # 별 SVG (filled/empty, 반응형 className)
│  └─ ConfigBanner.tsx     # 환경변수 누락 안내
└─ lib/
   ├─ supabase.ts          # 클라이언트 + 타입 + SLOTS(별판 좌표) + 헬퍼
   ├─ useGame.ts           # stars/gifts 로드 + Realtime 구독 훅
   └─ tankGame.ts          # 탱크 게임 엔진(캔버스 2D, React 밖 순수 로직) + 효과음
supabase/schema.sql        # gifts + stars 테이블, RLS(공개), Realtime
```

DB: `gifts`(전달기록·편지), `stars`(size, slot=배치위치/null=미배치풀, gift_id). 별판 좌표는 `lib/supabase.ts`의 `SLOTS` 상수(20개).

---

## 셋업 (새 환경에서)

1. **Supabase**: 새 프로젝트 → **SQL Editor**에 [`supabase/schema.sql`](supabase/schema.sql) 실행
2. **환경변수** (`.env.local.example` → `.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...   # anon public 키 (service_role 금지!)
   ```
3. 로컬: `npm install && npm run dev` → http://localhost:3000

## 배포 / 운영 (현재 셋업)

- **자동 배포**: `main`에 push → Vercel이 Production 자동 빌드. Production Branch = `main`.
- **Vercel 환경변수**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록됨 (변경 시 재배포 필요 — `NEXT_PUBLIC_*`는 빌드 타임에 박힘).
- **⚠️ 함정 (해결됨)**: Vercel 프로젝트 **Framework Preset이 비어있으면**(`null`) 빌드는 성공해도 모든 경로가 `NOT_FOUND`. 반드시 **Next.js**로 설정. (Settings → Build & Deployment)
- **초기화**: 앱의 완료 후 `초기화하기` 버튼, 또는 `stars`/`gifts` 테이블 전체 삭제.

---

## 핸드오프 메모

- GitHub: https://github.com/byronkkim/ujungrandfa (브랜치 `main`)
- 토큰(`GITHUB_TOKEN`, `VERCEL_TOKEN`)은 로컬 `.env.local`에만 있고 git에는 안 올라감(`.gitignore`).
- 보안: 개발 중 Supabase `service_role` 키가 한 번 노출된 적 있음 → 민감하면 Supabase에서 키 rotate 권장. 앱은 **anon 키만** 사용.
