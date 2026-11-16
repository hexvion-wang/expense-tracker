-- =====================================================================
-- 001_init.sql：記帳 App 的資料表與權限（RLS）
-- 使用方式：在 Supabase 後台 → SQL Editor → 貼上整份內容 → Run
-- 這份 SQL 不含任何金鑰或個人資料，可以安全地放在公開 repo。
-- =====================================================================

-- ---------- 分類 ----------
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 30),
  icon           text not null default '📦',
  monthly_budget numeric(12, 2) check (monthly_budget >= 0),
  sort_order     int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id) -- 讓其他表可以用 (category_id, user_id) 確保分類屬於同一個使用者
);

-- ---------- 自動分類規則 ----------
create table public.rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match_type    text not null default 'contains' check (match_type in ('contains', 'regex')),
  pattern       text not null check (char_length(pattern) between 1 and 200),
  category_id   uuid not null,
  note_template text check (char_length(note_template) <= 100),
  priority      int  not null default 0,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

-- ---------- 交易紀錄 ----------
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount      numeric(12, 2) check (amount >= 0),
  currency    text not null default 'TWD' check (currency ~ '^[A-Z]{3}$'),
  merchant    text check (char_length(merchant) <= 200),
  note        text check (char_length(note) <= 500),
  category_id uuid,
  source      text not null default 'manual' check (source in ('manual', 'applepay', 'sms', 'ocr')),
  status      text not null default 'confirmed' check (status in ('confirmed', 'pending')),
  raw_text    text check (char_length(raw_text) <= 4000),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  -- 已確認的交易一定要有金額；解析失敗的「待確認」交易可以先沒有
  check (status = 'pending' or amount is not null),
  -- 分類被刪除時，只把 category_id 清空，交易本身保留
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at desc);

-- ---------- 捷徑用的個人 token（只存雜湊，不存明碼） ----------
create table public.ingest_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash   text not null unique,
  label        text not null default 'iPhone 捷徑' check (char_length(label) <= 50),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

-- ---------- RLS：每個人只能存取自己的資料 ----------
alter table public.categories    enable row level security;
alter table public.rules         enable row level security;
alter table public.transactions  enable row level security;
alter table public.ingest_tokens enable row level security;

create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rules" on public.rules
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- token 只能新增、查看、刪除，不能修改
create policy "own tokens select" on public.ingest_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own tokens insert" on public.ingest_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own tokens delete" on public.ingest_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
