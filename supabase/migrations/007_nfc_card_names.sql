-- Mapeo de card_id corto → nombre legible para el dashboard NFC
CREATE TABLE IF NOT EXISTS public.nfc_card_names (
  card_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS deny-all: solo service_role (dashboard server-side)
ALTER TABLE public.nfc_card_names ENABLE ROW LEVEL SECURITY;
