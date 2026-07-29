-- Distributed broker API rate limits without storing raw IP addresses.

create table public.broker_rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  expires_at timestamptz not null,
  primary key (bucket_key, window_start)
);

create index broker_rate_limit_expiry_idx
  on public.broker_rate_limit_buckets (expires_at);

alter table public.broker_rate_limit_buckets enable row level security;

revoke all on table public.broker_rate_limit_buckets from anon, authenticated;
grant all privileges on table public.broker_rate_limit_buckets to service_role;

create or replace function public.consume_broker_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_hits integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  bucket_start timestamptz;
  current_hits integer;
begin
  if char_length(p_bucket_key) < 10 or char_length(p_bucket_key) > 180
     or p_window_seconds < 1 or p_window_seconds > 3600
     or p_max_hits < 1 or p_max_hits > 10000 then
    raise exception 'invalid rate limit parameters';
  end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.broker_rate_limit_buckets (
    bucket_key, window_start, hits, expires_at
  ) values (
    p_bucket_key,
    bucket_start,
    1,
    bucket_start + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (bucket_key, window_start)
  do update set
    hits = public.broker_rate_limit_buckets.hits + 1,
    expires_at = excluded.expires_at
  returning hits into current_hits;

  if random() < 0.01 then
    delete from public.broker_rate_limit_buckets where expires_at < now();
  end if;

  return current_hits <= p_max_hits;
end;
$$;

revoke all on function public.consume_broker_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_broker_rate_limit(text, integer, integer)
  to service_role;
