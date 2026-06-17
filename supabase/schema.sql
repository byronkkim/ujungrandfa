-- 별 모으기 앱 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create table if not exists public.stars (
  id uuid primary key default gen_random_uuid(),
  size text not null check (size in ('small', 'big')),
  location text not null default 'inbox' check (location in ('inbox', 'board')),
  slot int,
  created_at timestamptz not null default now()
);

-- 가족용 간단 앱이라 RLS는 열어둔다. (인증 없이 누구나 읽기/쓰기)
alter table public.stars enable row level security;

drop policy if exists "stars open access" on public.stars;
create policy "stars open access"
  on public.stars
  for all
  using (true)
  with check (true);

-- 실시간(Realtime) 활성화: 할아버지가 만든 별이 손자 화면에 즉시 나타나도록.
alter publication supabase_realtime add table public.stars;
