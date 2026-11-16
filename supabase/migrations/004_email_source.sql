-- =====================================================================
-- 004_email_source.sql：新增「Email」來源（Gmail 自動記帳用）
-- 使用方式：Supabase 後台 → SQL Editor → New query → 貼上整份 → Run（003 之後執行）
-- =====================================================================

alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'applepay', 'sms', 'ocr', 'email'));

-- 與 003 相同，只是多接受 'email'
create or replace function public.ingest(p_token text, p_text text, p_source text default 'sms')
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
  if p_source is null or p_source not in ('applepay', 'sms', 'ocr', 'email') then
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
