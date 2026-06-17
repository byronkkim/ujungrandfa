-- 별 모으기 v2 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
-- (기존 v1 테이블이 있으면 아래 drop이 정리합니다. 테스트 데이터만 있으니 안전합니다.)

drop table if exists public.stars cascade;
drop table if exists public.gifts cascade;

-- 할아버지가 "보내기" 할 때마다 한 줄씩 기록되는 전달 내역
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  small_count int not null default 0,
  big_count int not null default 0,
  memo text,
  created_at timestamptz not null default now()
);

-- 별 한 개 = 한 줄. slot이 null이면 손자의 "미배치 풀", 0~19면 별판에 배치됨.
create table public.stars (
  id uuid primary key default gen_random_uuid(),
  size text not null check (size in ('small', 'big')),
  slot int,
  gift_id uuid references public.gifts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 가족용 간단 앱이라 RLS는 열어둔다. (인증 없이 누구나 읽기/쓰기)
alter table public.gifts enable row level security;
alter table public.stars enable row level security;

drop policy if exists "gifts open" on public.gifts;
create policy "gifts open" on public.gifts for all using (true) with check (true);

drop policy if exists "stars open" on public.stars;
create policy "stars open" on public.stars for all using (true) with check (true);

-- 실시간(Realtime): 할아버지가 보낸 별이 손자 화면에 즉시 나타나도록.
alter publication supabase_realtime add table public.gifts;
alter publication supabase_realtime add table public.stars;
