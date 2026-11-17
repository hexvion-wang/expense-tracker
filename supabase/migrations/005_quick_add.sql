-- =====================================================================
-- 005_quick_add.sql：iPhone 動作按鈕「快速記帳」
-- 使用方式：Supabase 後台 → SQL Editor → New query → 貼上整份 → Run（004 之後執行）
--
-- 新增兩個給捷徑呼叫的函式（用同一套捷徑 token）：
-- * quick_options(token)：取得分類與帳戶的「名稱」做成選單（不含任何金額、餘額或紀錄）
-- * quick_add(token, 金額, 分類, 帳戶)：直接新增一筆正式紀錄
-- =====================================================================

alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'applepay', 'sms', 'ocr', 'email', 'quick'));

-- 內部用：驗證 token 並回傳使用者（不開放給外部直接呼叫）
create function public.token_user_(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  update public.ingest_tokens set last_used_at = now()
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  returning user_id into v;
  if v is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  return v;
end;
$$;
revoke all on function public.token_user_(text) from public, anon, authenticated;

-- 內部用：帳戶在選單上的顯示名稱，例如「💵 錢包」
create function public.account_label_(p_type text, p_name text) returns text
language sql immutable set search_path = '' as $$
  select (case p_type when 'bank' then '🏦' when 'credit_card' then '💳' when 'e_wallet' then '📱'
                      when 'cash' then '💵' else '🗂️' end) || ' ' || p_name
$$;
revoke all on function public.account_label_(text, text) from public, anon, authenticated;

-- 選單內容：只有名稱
create function public.quick_options(p_token text) returns json
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  v := public.token_user_(p_token);
  return json_build_object(
    'categories', coalesce((select json_agg(c.icon || ' ' || c.name order by c.sort_order, c.name)
                              from public.categories c where c.user_id = v), '[]'::json),
    'accounts', (jsonb_build_array('不指定') || coalesce(
                   (select jsonb_agg(public.account_label_(a.type, a.name) order by a.sort_order, a.name)
                      from public.accounts a where a.user_id = v and not a.archived), '[]'::jsonb))::json
  );
end;
$$;
revoke all on function public.quick_options(text) from public;
grant execute on function public.quick_options(text) to anon, authenticated;

-- 快速新增一筆正式紀錄
create function public.quick_add(p_token text, p_amount numeric, p_category text, p_account text default null)
returns json
language plpgsql security definer set search_path = '' as $$
declare
  v uuid;
  v_cat uuid; v_cat_label text;
  v_acc uuid; v_acc_label text;
  v_amount numeric;
begin
  v := public.token_user_(p_token);

  v_amount := round(p_amount, 2);
  if v_amount is null or v_amount <= 0 or v_amount >= 100000000 then
    raise exception '金額要大於 0' using errcode = '22023';
  end if;

  select c.id, c.icon || ' ' || c.name into v_cat, v_cat_label
    from public.categories c
   where c.user_id = v and (c.name = btrim(p_category) or c.icon || ' ' || c.name = btrim(p_category))
   limit 1;
  if v_cat is null then
    raise exception '找不到分類：%', left(coalesce(p_category, ''), 30) using errcode = '22023';
  end if;

  if p_account is not null and btrim(p_account) not in ('', '不指定') then
    select a.id, public.account_label_(a.type, a.name) into v_acc, v_acc_label
      from public.accounts a
     where a.user_id = v and not a.archived
       and (a.name = btrim(p_account) or public.account_label_(a.type, a.name) = btrim(p_account))
     limit 1;
    if v_acc is null then
      raise exception '找不到帳戶：%', left(p_account, 30) using errcode = '22023';
    end if;
  end if;

  if (select count(*) from public.transactions
       where user_id = v and source <> 'manual' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many requests' using errcode = '54000';
  end if;

  insert into public.transactions (user_id, amount, category_id, account_id, source, status)
  values (v, v_amount, v_cat, v_acc, 'quick', 'confirmed');

  return json_build_object('ok', true, 'message',
    '✅ 已記帳 ' || v_cat_label || ' NT$' || rtrim(to_char(v_amount, 'FM999,999,999,990.99'), '.')
    || coalesce('（' || v_acc_label || '）', ''));
end;
$$;
revoke all on function public.quick_add(text, numeric, text, text) from public;
grant execute on function public.quick_add(text, numeric, text, text) to anon, authenticated;
