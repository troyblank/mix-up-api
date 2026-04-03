-- Run this in Supabase: SQL Editor → New query → Paste → Run.
-- Stores lists created via the createNewList GraphQL mutation.

create table if not exists public.lists (
  id text primary key,
  name text not null,
  type text not null check (type in ('pick', 'list')),
  items jsonb not null default '[]'::jsonb
);

create index if not exists lists_type_idx on public.lists (type);
