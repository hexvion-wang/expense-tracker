-- =====================================================================
-- 003_ingest.sql：讓 iPhone 捷徑「投遞」自動記帳資料
-- 使用方式：Supabase 後台 → SQL Editor → New query → 貼上整份 → Run（002 之後執行）
--
-- 安全設計：
-- * 捷徑只能呼叫 ingest() 這一個函式，只能「新增一筆待確認紀錄」，不能讀取任何資料
-- * token 在資料庫只存 SHA-256 雜湊，資料庫外洩也拿不到原本的 token
-- * 每個帳號每小時最多 60 筆自動紀錄，避免 token 外洩時被灌爆
-- * 金額、商家、分類的解讀在 App 裡進行（登入後才會處理）
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create function public.ingest(p_token text, p_text text, p_source text default 'sms')
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_id   uuid;
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  if p_source is null or p_source not in ('applepay', 'sms', 'ocr') then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  if p_text is null or char_length(btrim(p_text)) = 0 then
    raise exception 'empty text' using errcode = '22023';
  end if;

  update public.ingest_tokens
     set last_used_at = now()
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  returning user_id into v_user;

  if v_user is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;

  if (select count(*) from public.transactions
       where user_id = v_user and source <> 'manual' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many requests' using errcode = '54000';
  end if;

  insert into public.transactions (user_id, status, source, raw_text)
  values (v_user, 'pending', p_source, left(btrim(p_text), 4000))
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.ingest(text, text, text) from public;
grant execute on function public.ingest(text, text, text) to anon, authenticated;
