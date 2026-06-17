# ⭐ 별 모으기

할아버지가 별을 만들어 주면, 손자가 별판에 모으는 가족용 웹앱입니다.

- **`/grandpa`** (할아버지): 큰별·작은별을 만들어 저장
- **`/grandson`** (손자): 받은 별을 드래그&드롭으로 별판에 채우고, 작은별 3개 ↔ 큰별 1개로 합치기·분리

스택: **Next.js + Supabase(DB·실시간) + Vercel + GitHub**

---

## 1. Supabase 준비

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성
2. **SQL Editor** 에서 [`supabase/schema.sql`](supabase/schema.sql) 내용을 붙여넣고 실행
3. **Project Settings > API** 에서 아래 두 값 복사
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. 환경 변수

`.env.local.example` 를 복사해 `.env.local` 을 만들고 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## 3. 로컬 실행

```bash
npm install
npm run dev
```

→ http://localhost:3000

## 4. GitHub + Vercel 배포

```bash
git add -A
git commit -m "별 모으기 초기 버전"
gh repo create devforfamily --private --source=. --push   # 또는 GitHub에 직접 push
```

1. [vercel.com](https://vercel.com) 에서 **Add New > Project** → GitHub 저장소 import
2. **Environment Variables** 에 위 두 값을 똑같이 입력
3. Deploy

---

## 규칙

- 작은별 **3개** = 큰별 **1개**
- 손자 화면에서 작은별 3개를 별판에 올린 뒤 `합치기` → 큰별 1개
- 큰별을 누르면 → 작은별 3개로 분리 (빈 칸이 2개 이상 필요)
- 할아버지와 손자는 서로 다른 페이지에서 작업하며, Supabase Realtime 으로 즉시 동기화됩니다.
