-- Cada tarjeta puede tener su propia URL de redirección
ALTER TABLE public.nfc_card_names
  ADD COLUMN IF NOT EXISTS redirect_url TEXT;
