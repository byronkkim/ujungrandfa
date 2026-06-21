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

**🥚 이스터에그**: 할아버지가 큰별 10 + 작은별 10을 만들고, 편지에 별(⭐/🌟) 10개를 찍어 보내면 → 우주가 받은 별이 전부 초기화(편지는 남음). 구현: [`src/app/grandpa/page.tsx`](src/app/grandpa/page.tsx)의 `send()`.

---

## 코드 구조

```
src/
├─ app/
│  ├─ layout.tsx           # 루트 + 타이틀 템플릿("별 모으기 - %s")
│  ├─ page.tsx             # 시작 화면
│  ├─ grandpa/{layout,page}.tsx   # 할아버지 (타이틀: 별 모으기 - 할아버지)
│  └─ grandson/{layout,page}.tsx  # 우주/손자 (타이틀: 별 모으기 - 우주)
├─ components/
│  ├─ StarIcon.tsx         # 별 SVG (filled/empty, 반응형 className)
│  └─ ConfigBanner.tsx     # 환경변수 누락 안내
└─ lib/
   ├─ supabase.ts          # 클라이언트 + 타입 + SLOTS(별판 좌표) + 헬퍼
   └─ useGame.ts           # stars/gifts 로드 + Realtime 구독 훅
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
