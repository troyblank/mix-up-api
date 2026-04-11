-- Run in Supabase: SQL Editor → New query → Paste → Run.
-- Lists and list items are normalized (one row per item) for simple SQL admin (delete/update by id).

create table if not exists public.lists (
  id text primary key,
  name text not null,
  type text not null check (type in ('pick', 'list'))
);

create index if not exists lists_type_idx on public.lists (type);

create table if not exists public.list_items (
  id text primary key,
  list_id text not null references public.lists (id) on delete cascade,
  name text not null,
  sort_order integer not null
);

create index if not exists list_items_list_id_idx on public.list_items (list_id);
