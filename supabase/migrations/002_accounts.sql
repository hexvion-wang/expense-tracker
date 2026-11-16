-- =====================================================================
-- 002_accounts.sql：資產帳戶、餘額校正、規則與交易連結帳戶
-- 使用方式：Supabase 後台 → SQL Editor → 貼上整份內容 → Run（001 之後執行）
-- =====================================================================

-- 防呆：不允許出現 10 碼以上連續數字（避免誤存完整銀行帳號、信用卡號）
create function public.has_long_number(t text) returns boolean
language sql immutable as $$
  select coalesce(regexp_replace(t, '[\s-]', '', 'g') ~ '\d{10,}', false)
$$;

-- ---------- 資產帳戶 ----------
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 30 and not public.has_long_number(name)),
  type            text not null default 'bank' check (type in ('bank', 'credit_card', 'e_wallet', 'cash', 'other')),
  institution     text check (char_length(institution) <= 50 and not public.has_long_number(institution)),
  last4           text check (last4 ~ '^[0-9]{4}$'), -- 只存末 4 碼
  opening_balance numeric(14, 2) not null default 0,
  note            text check (char_length(note) <= 200 and not public.has_long_number(note)),
  sort_order      int not null default 0,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

-- ---------- 餘額校正（例如：薪水入帳、繳卡費、對帳差額） ----------
create table public.account_adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid not null,
  amount      numeric(14, 2) not null, -- 正數＝增加、負數＝減少
  note        text check (char_length(note) <= 200 and not public.has_long_number(note)),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

-- ---------- 交易與規則可指定帳戶 ----------
alter table public.transactions add column account_id uuid,
  add foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id);
create index transactions_account_idx on public.transactions (account_id) where account_id is not null;

alter table public.rules add column account_id uuid,
  add foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id);

-- ---------- 帳戶目前餘額（security_invoker：查詢時套用呼叫者的 RLS） ----------
create view public.account_balances with (security_invoker = true) as
select
  a.id,
  a.opening_balance
    + coalesce((select sum(j.amount) from public.account_adjustments j where j.account_id = a.id), 0)
    - coalesce((select sum(t.amount) from public.transactions t
                where t.account_id = a.id and t.status = 'confirmed' and t.amount is not null), 0)
    as balance
from public.accounts a;

-- ---------- RLS ----------
alter table public.accounts            enable row level security;
alter table public.account_adjustments enable row level security;

create policy "own accounts" on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own adjustments" on public.account_adjustments
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- view 不開放給未登入者
revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;
