-- Shelfie schema: run this once in Supabase → SQL Editor → New query → Run

create table if not exists public.grids (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug        text not null unique,
  category    text not null check (category in ('albums', 'artists', 'movies', 'games')),
  title       text not null default 'My grid',
  config      jsonb not null default '{}'::jsonb,
  items       jsonb not null default '[]'::jsonb,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists grids_user_id_idx on public.grids (user_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists grids_touch on public.grids;
create trigger grids_touch before update on public.grids
  for each row execute function public.touch_updated_at();

alter table public.grids enable row level security;

drop policy if exists "read public or own grids" on public.grids;
create policy "read public or own grids" on public.grids
  for select using (is_public or auth.uid() = user_id);

drop policy if exists "insert own grids" on public.grids;
create policy "insert own grids" on public.grids
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own grids" on public.grids;
create policy "update own grids" on public.grids
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own grids" on public.grids;
create policy "delete own grids" on public.grids
  for delete to authenticated using (auth.uid() = user_id);

-- Storage bucket for custom cover uploads (public read, owner-only write into <user_id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "covers public read" on storage.objects;
create policy "covers public read" on storage.objects
  for select using (bucket_id = 'covers');

drop policy if exists "covers owner upload" on storage.objects;
create policy "covers owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "covers owner delete" on storage.objects;
create policy "covers owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
