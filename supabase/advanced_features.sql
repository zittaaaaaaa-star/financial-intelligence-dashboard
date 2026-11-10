-- Run once in Supabase SQL Editor to enable personal watchlists and alert rules.
-- These tables are user-scoped; RLS prevents users from reading or modifying another user's records.

create table if not exists public.research_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('ticker', 'company', 'product_code', 'cusip')),
  symbol text not null,
  label text,
  created_at timestamptz not null default now(),
  constraint research_watchlist_user_item_unique unique (user_id, item_type, symbol)
);

create index if not exists research_watchlist_user_created_idx
  on public.research_watchlist(user_id, created_at desc);

alter table public.research_watchlist enable row level security;

drop policy if exists "Users can read their own watchlist" on public.research_watchlist;
create policy "Users can read their own watchlist"
  on public.research_watchlist for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can add to their own watchlist" on public.research_watchlist;
create policy "Users can add to their own watchlist"
  on public.research_watchlist for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can remove from their own watchlist" on public.research_watchlist;
create policy "Users can remove from their own watchlist"
  on public.research_watchlist for delete to authenticated
  using (user_id = auth.uid());

create table if not exists public.research_alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null default '*',
  min_unique_insiders integer not null default 3 check (min_unique_insiders >= 2),
  min_total_value numeric not null default 0 check (min_total_value >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint research_alert_rules_user_ticker_unique unique (user_id, ticker)
);

create index if not exists research_alert_rules_user_enabled_idx
  on public.research_alert_rules(user_id, enabled);

alter table public.research_alert_rules enable row level security;

drop policy if exists "Users can read their own alert rules" on public.research_alert_rules;
create policy "Users can read their own alert rules"
  on public.research_alert_rules for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create their own alert rules" on public.research_alert_rules;
create policy "Users can create their own alert rules"
  on public.research_alert_rules for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own alert rules" on public.research_alert_rules;
create policy "Users can update their own alert rules"
  on public.research_alert_rules for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own alert rules" on public.research_alert_rules;
create policy "Users can delete their own alert rules"
  on public.research_alert_rules for delete to authenticated
  using (user_id = auth.uid());
