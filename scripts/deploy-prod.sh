#!/usr/bin/env bash
set -euo pipefail

echo "==> Verificando TypeScript"
npm run typecheck

echo "==> Verificando lint"
npm run lint

echo "==> Desplegando PRODUCCION en Vercel"
vercel deploy --prod --yes

echo "==> Verificando alias publico"
html="$(curl -fsS https://gonovi.app)"
printf '%s' "$html" | grep -q '<title>GONOVI · Inicio'
if printf '%s' "$html" | grep -q 'Próximamente'; then
  echo "ERROR: gonovi.app sigue mostrando Proximamente." >&2
  exit 1
fi
echo "OK: gonovi.app apunta al deployment production y muestra la home publica."
