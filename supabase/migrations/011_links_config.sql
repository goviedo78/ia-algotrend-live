-- 011 — Configuración editable de la página /links (single-row JSONB)
-- Permite que la página pública /links lea su config desde la DB
-- y que el admin /official/links la edite sin tocar código.

CREATE TABLE IF NOT EXISTS public.links_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- garantiza single-row
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS deny-all: solo service_role accede (server-side admin client)
ALTER TABLE public.links_config ENABLE ROW LEVEL SECURITY;

-- Seed inicial vacío (idempotente). El primer load desde el server
-- detecta config vacío y devuelve los defaults de linksData.ts hasta
-- que el admin guarde la primera vez.
INSERT INTO public.links_config (id, config)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
