-- Tracking de escaneos de tarjetas NFC físicas
CREATE TABLE IF NOT EXISTS public.nfc_analytics (
  id BIGSERIAL PRIMARY KEY,
  card_id TEXT NOT NULL,                       -- código corto: b1, 01, vip7
  ip_hash TEXT,                                -- sha256(ip + salt) — NO la IP cruda
  user_agent TEXT,                             -- truncado a 500 chars en el insert
  country TEXT,                                -- x-vercel-ip-country
  city TEXT,                                   -- x-vercel-ip-city
  region TEXT,                                 -- x-vercel-ip-region
  latitude TEXT,                               -- x-vercel-ip-latitude
  longitude TEXT,                              -- x-vercel-ip-longitude
  browser_language TEXT,                       -- Accept-Language (primer valor)
  device_cookie_id UUID,                       -- uuid persistido en cookie
  referer TEXT,                                -- por si lo escanean desde otra app
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nfc_analytics_card_created_idx
  ON public.nfc_analytics (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nfc_analytics_created_idx
  ON public.nfc_analytics (created_at DESC);
CREATE INDEX IF NOT EXISTS nfc_analytics_device_idx
  ON public.nfc_analytics (device_cookie_id);

-- RLS: SOLO service_role escribe/lee. anon/authenticated: nada.
ALTER TABLE public.nfc_analytics ENABLE ROW LEVEL SECURITY;
-- (Sin policies para anon/authenticated → acceso 0. El dashboard usa service_role server-side.)