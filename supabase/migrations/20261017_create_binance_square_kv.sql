-- Run once in Supabase Dashboard -> SQL Editor for this project.
-- Stores only article IDs and job state; never store API keys here.
create table if not exists public.binance_square_kv (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.binance_square_kv enable row level security;
-- No anon/authenticated policies are intentionally created. The server uses a secret/service-role key.
