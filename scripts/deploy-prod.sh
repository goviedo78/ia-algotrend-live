#!/usr/bin/env bash
set -euo pipefail

echo "==> Verificando TypeScript"
npm run typecheck

echo "==> Verificando lint"
npm run lint

echo "==> Desplegando PRODUCCION en Vercel"
vercel deploy --prod --yes

echo "==> Verificando alias publico"
curl -fsS https://gonovi.app | grep -q '<title>GONOVI · Próximamente'
echo "OK: gonovi.app apunta al deployment production y mantiene Proximamente."
