-- Tracking de visitas y clicks en /links
-- Patrón inspirado en 006_nfc_analytics.sql: IP hasheada con NFC_HASH_SALT,
-- geo desde headers Vercel, RLS habilitado sin policies (deny-all para
-- anon/authenticated, service_role bypass para insert/read server-side).

CREATE TABLE IF NOT EXISTS public.link_views (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID,                              -- uuid persistido en localStorage del visitante
  ip_hash TEXT,                                 -- sha256(ip + NFC_HASH_SALT) — NO la IP cruda
  user_agent TEXT,                              -- truncado a 500 chars
  country TEXT,                                 -- x-vercel-ip-country
  city TEXT,                                    -- x-vercel-ip-city
  region TEXT,                                  -- x-vercel-ip-region
  latitude TEXT,                                -- x-vercel-ip-latitude
  longitude TEXT,                               -- x-vercel-ip-longitude
  browser_language TEXT,                        -- primer Accept-Language
  referer TEXT,                                 -- document.referrer del visitante
  utm_source TEXT,                              -- ?utm_source=instagram
  utm_medium TEXT,                              -- ?utm_medium=bio
  utm_campaign TEXT,                            -- ?utm_campaign=launch
  utm_content TEXT,
  utm_term TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS link_views_created_idx
  ON public.link_views (created_at DESC);
CREATE INDEX IF NOT EXISTS link_views_session_idx
  ON public.link_views (session_id);
CREATE INDEX IF NOT EXISTS link_views_source_idx
  ON public.link_views (utm_source, created_at DESC);

ALTER TABLE public.link_views ENABLE ROW LEVEL SECURITY;
-- (Sin policies → anon/authenticated bloqueados. Solo service_role accede.)


CREATE TABLE IF NOT EXISTS public.link_clicks (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID,
  link_index INT,                               -- posición en el array al momento del click (0-based)
  link_title TEXT,                              -- truncado a 120 chars (max del sanitizer)
  link_href TEXT,                               -- truncado a 500 chars
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  latitude TEXT,
  longitude TEXT,
  browser_language TEXT,
  referer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS link_clicks_created_idx
  ON public.link_clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS link_clicks_title_idx
  ON public.link_clicks (link_title, created_at DESC);
CREATE INDEX IF NOT EXISTS link_clicks_session_idx
  ON public.link_clicks (session_id);
CREATE INDEX IF NOT EXISTS link_clicks_source_idx
  ON public.link_clicks (utm_source, created_at DESC);

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
-- (Sin policies → anon/authenticated bloqueados. Solo service_role accede.)
