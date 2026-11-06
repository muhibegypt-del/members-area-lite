create schema if not exists private;

create table private.member_emails (
  email text primary key check (email = lower(trim(email)) and email <> '')
);

alter table private.member_emails enable row level security;
revoke all on private.member_emails from public, anon, authenticated;

create function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.member_emails
    where email = lower(trim(event #>> '{user,email}'))
  ) then
    return '{}'::jsonb;
  end if;

  return '{"error":{"http_code":403,"message":"Use the email address you joined the book club with."}}'::jsonb;
end;
$$;

revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

create function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join private.member_emails m on m.email = lower(trim(u.email))
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

revoke execute on function private.is_member() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

create function public.member_has_access()
returns boolean
language sql
stable
set search_path = ''
as $$ select private.is_member(); $$;

revoke execute on function public.member_has_access() from public, anon;
grant execute on function public.member_has_access() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$')
);

create table public.texts (
  id text primary key,
  title text not null,
  subtitle text not null,
  position integer not null default 0,
  drive_folder_id text unique
);

create table public.sittings (
  id text primary key check (id ~ '^[A-Za-z0-9_-]+$'),
  text_id text not null references public.texts(id) on delete cascade,
  title text not null,
  recorded_on date not null
);

create table public.resources (
  id bigint generated always as identity primary key,
  text_id text not null references public.texts(id) on delete cascade,
  title text not null,
  url text not null check (url ~ '^https://[^[:space:]]+$')
);

create table public.watched (
  member_id uuid references public.profiles(id) on delete cascade,
  sitting_id text references public.sittings(id) on delete cascade,
  primary key (member_id, sitting_id)
);

alter table public.profiles enable row level security;
alter table public.texts enable row level security;
alter table public.sittings enable row level security;
alter table public.resources enable row level security;
alter table public.watched enable row level security;

revoke all on public.profiles, public.texts, public.sittings, public.resources, public.watched from anon, authenticated;
grant select on public.profiles, public.texts, public.sittings, public.resources, public.watched to authenticated;
grant insert on public.profiles, public.watched to authenticated;
grant delete on public.watched to authenticated;

create policy own_profile on public.profiles for all to authenticated
  using ((select private.is_member()) and id = (select auth.uid()))
  with check ((select private.is_member()) and id = (select auth.uid()));
create policy read_texts on public.texts for select to authenticated
  using ((select private.is_member()));
create policy read_sittings on public.sittings for select to authenticated
  using ((select private.is_member()));
create policy read_resources on public.resources for select to authenticated
  using ((select private.is_member()));
create policy own_progress on public.watched for all to authenticated
  using ((select private.is_member()) and member_id = (select auth.uid()))
  with check ((select private.is_member()) and member_id = (select auth.uid()));
