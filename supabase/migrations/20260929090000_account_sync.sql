-- Notes and the AI conversation follow the account, not the device.
--
-- Anonymous visitors keep notes in localStorage, as before. Once signed in,
-- notes and the chat live here, so a phone and a computer show the same thing.
--
-- Users read and write only their own rows (RLS); anon has no access at all.
-- Both tables are bounded per user, so a script calling the API directly
-- cannot grow them without limit.

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table public.notes (
  -- Client-generated, so a note created offline keeps its id when uploaded
  -- and a repeated upload of the same local note is a no-op.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  content text not null default '' check (char_length(content) <= 20000),
  category text not null default 'other' check (category in ('goals', 'portfolio', 'ideas', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_updated_idx on public.notes (user_id, updated_at desc);

-- Timestamps: an insert may carry the original times of a note written on the
-- device before signing in, but never a time in the future; every update is
-- stamped by the server, so devices with wrong clocks still agree on order.
create function public.notes_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.notes where user_id = new.user_id) >= 500 then
      raise exception 'note limit reached' using errcode = '23514';
    end if;
    new.created_at := least(coalesce(new.created_at, now()), now());
    new.updated_at := least(coalesce(new.updated_at, new.created_at), now());
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.notes_before_write() from public, anon, authenticated;

create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function public.notes_before_write();

alter table public.notes enable row level security;

create policy notes_select_own on public.notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy notes_insert_own on public.notes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notes_update_own on public.notes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notes_delete_own on public.notes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Supabase grants everything on new tables by default: start from nothing.
revoke all on public.notes from anon, authenticated;
grant select, insert, update, delete on public.notes to authenticated;

-- ---------------------------------------------------------------------------
-- AI conversation
-- ---------------------------------------------------------------------------
create table public.ai_messages (
  -- Identity, not uuid: two messages saved in one request keep their order
  -- even when their timestamps are equal.
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index ai_messages_user_created_idx on public.ai_messages (user_id, created_at desc, id desc);

-- Keeps the newest 200 messages per user. The model only ever sees the last
-- few (the API caps history), so older ones are kept for reading only.
create function public.ai_messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := least(coalesce(new.created_at, now()), now());
  return new;
end;
$$;

create function public.ai_messages_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.ai_messages m
  where m.user_id in (select distinct n.user_id from new_rows n)
    and m.id not in (
      select k.id from public.ai_messages k
      where k.user_id = m.user_id
      order by k.created_at desc, k.id desc
      limit 200
    );
  return null;
end;
$$;

revoke execute on function public.ai_messages_before_insert() from public, anon, authenticated;
revoke execute on function public.ai_messages_after_insert() from public, anon, authenticated;

create trigger ai_messages_before_insert
  before insert on public.ai_messages
  for each row execute function public.ai_messages_before_insert();

create trigger ai_messages_after_insert
  after insert on public.ai_messages
  referencing new table as new_rows
  for each statement execute function public.ai_messages_after_insert();

alter table public.ai_messages enable row level security;

create policy ai_messages_select_own on public.ai_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy ai_messages_delete_own on public.ai_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- No UPDATE: a message, once saved, is not edited.
revoke all on public.ai_messages from anon, authenticated;
grant select, insert, delete on public.ai_messages to authenticated;
