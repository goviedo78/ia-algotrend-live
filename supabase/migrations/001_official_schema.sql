-- Official GONOVI schema foundation.
-- Local migration file only. Does not touch existing live desks unless applied.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  market text,
  timeframe text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  gumroad_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  customer_email text,
  tradingview_username text,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'revoked', 'expired')),
  activated_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  customer_email text,
  provider text not null default 'manual' check (provider in ('manual', 'gumroad', 'stripe', 'crypto')),
  provider_order_id text,
  currency text not null default 'USD',
  amount numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  module text not null default 'backtesting',
  market text not null,
  timeframe text not null,
  title text not null,
  context text,
  difficulty text not null default 'inicial' check (difficulty in ('inicial', 'intermedio', 'avanzado')),
  candles jsonb not null default '[]'::jsonb,
  reveal_from integer,
  expected_bias text check (expected_bias in ('long', 'short', 'skip')),
  lesson text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid references public.learning_scenarios(id) on delete set null,
  visitor_id text,
  session_id text,
  decision text check (decision in ('long', 'short', 'skip')),
  entry numeric,
  stop_loss numeric,
  take_profit numeric,
  result_r numeric,
  is_correct boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text,
  session_id text,
  event_type text not null,
  page_path text,
  product_slug text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text,
  website_url text,
  contact_email text,
  status text not null default 'lead' check (status in ('lead', 'active', 'paused', 'archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_status on public.products(status);
create index if not exists idx_licenses_product_id on public.licenses(product_id);
create index if not exists idx_licenses_tradingview_username on public.licenses(tradingview_username);
create index if not exists idx_orders_product_id on public.orders(product_id);
create index if not exists idx_orders_provider_order_id on public.orders(provider_order_id);
create index if not exists idx_learning_scenarios_module_active on public.learning_scenarios(module, is_active);
create index if not exists idx_learning_attempts_scenario_id on public.learning_attempts(scenario_id);
create index if not exists idx_learning_attempts_visitor_id on public.learning_attempts(visitor_id);
create index if not exists idx_analytics_events_created_at on public.analytics_events(created_at desc);
create index if not exists idx_analytics_events_event_type on public.analytics_events(event_type);
create index if not exists idx_partners_status on public.partners(status);

alter table public.products enable row level security;
alter table public.licenses enable row level security;
alter table public.orders enable row level security;
alter table public.learning_scenarios enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.analytics_events enable row level security;
alter table public.partners enable row level security;
