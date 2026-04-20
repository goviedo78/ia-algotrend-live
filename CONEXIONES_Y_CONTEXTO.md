# 🧠 Contexto del Sistema: IA AlgoTrend (Fusion Engine Live)

Este documento contiene la memoria técnica de todo lo que construimos. **Está diseñado para ser copiado y pegado en Claude, Codex u otra IA** para que tenga contexto instantáneo y pueda hacer modificaciones o extender la aplicación sin romper lo existente.

---

## 🏗 Arquitectura General

- **App:** Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Modo:** PWA (Progressive Web App) con Service Worker para notificaciones Push e instalación.
- **Hosting:** Vercel (Edge/Serverless functions)
- **Base de Datos:** Supabase (PostgreSQL) `algotrend_trades` tabla
- **Motor Financiero:** `src/lib/algotrend.ts` (Implementación en TypeScript de un algoritmo KNN adaptativo con CHOP Index, RSI, MA y Volatilidad ATR, originalmente portado de un script de Pine Script v6 de TradingView).

---

## 🔌 Conexiones y Variables de Entorno (.env.local)

Para levantar o modificar este ecosistema, estas son las integraciones actuales configuradas en el `.env.local` de Vercel:

| Servicio | Variables requeridas / Key | Propósito |
| :--- | :--- | :--- |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY` | DB para almacenar operaciones (trades), precios de entrada, SL, TP y ganancias (PnL). |
| **VAPID (Push)** | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`<br>`VAPID_PRIVATE_KEY` | Generación de notificaciones Push nativas en el navegador/celular del cliente. |
| **Cron Job** | Cron en `cron-job.org` apuntando a `/api/cron/check` | Ejecuta la revisión de señales del motor cada hora exacta (minuto `00`). |
| **Webhook TV** | `WEBHOOK_SECRET` | Token de seguridad para recibir señales POST desde alertas directas de TradingView en `/api/webhook/tradingview`. |
| **Telegram** | `TELEGRAM_BOT_TOKEN`<br>`TELEGRAM_CHAT_ID` | Notificaciones automáticas de logs y señales con emojis y formato en HTML (`src/lib/telegram.ts`). |
| **Emails** | `RESEND_API_KEY`<br>`ALERT_EMAIL` | Notificaciones por correo electrónico al abrir/cerrar operaciones vía Resend API (`src/lib/email.ts`). |
| **Mercado** | Bitstamp API REST/WS (Público) | Origen de datos (Precio BTC) vía REST (1h) y WebSocket (tiempo real) para la UI. |

---

## 📂 Archivos Clave del Core (Para la IA)

Si vas a pedirle a una IA que modifique algo, decile que analice estos archivos primero:

1. **El Motor IA (`src/lib/algotrend.ts`)**: Mantiene la paridad estricta numérica con TradingView. Calcula las probabilidades KNN. **Atención IA:** _No modificar las matemáticas de normalización `ta_stdev` o el `f_chop` (CHOP Index) sin validar contra la salida original de Pine._
2. **El Cron (`src/app/api/cron/check/route.ts`)**: Se ejecuta cada hora. Construye las velas usando Bitstamp API, ignora la vela abierta actual (`if t.hour == now.hour`) para evitar repainting, y si hay señal activa (Probabilidad >= `PRESET.probThreshold`), dispara orden en DB. También maneja el Trailing Stop.
3. **El Webhook (`src/app/api/webhook/tradingview/route.ts`)**: Plan B. Recibe señales duras desde TradingView. Convierte payloads de Pine Script en aperturas/cierres de trades.
4. **Dashboard Principal (`src/components/Dashboard.tsx`)**: Se conecta al WebSocket de Bitstamp, lee el motor en tiempo real y pinta la vista usando Tailwind oscuro (`#0F172A`).
5. **Cálculo de Rendimientos (`src/lib/db.ts`)**: La función `getStats()` usa **rendimientos compuestos** (multiplicando `1 + (pnl_pct / 100)`) tomando una base ficticia de $10,000 USD para el panel de rendimiento.

---

## 🛠 Modificaciones Frecuentes (Prompt patterns para enviar a otra IA)

Copia este bloque junto con lo que quieras modificar:

> **Para la IA:** Actúa como un experto en Next.js App Router, Trading algorítmico y Tailwind. Este proyecto se llama IA AlgoTrend. Tienes el contexto del sistema arriba.
> 
> MISIÓN: [Describe lo que quieres cambiar aquí. Ejemplo: "Modificar la lógica de Trailing Stop en el archivo de cron para que sea más agresivo", o "Arreglar la tabla TradeTable porque no se ven bien los colores"]
> 
> RESTRICCIONES: Modifica sólo lo necesario. Nunca cambies el cálculo base del motor matemático en algotrend.ts. Mantén el estilo Dark Mode de Tailwind. 

---

## ✅ Hitos Logrados (Progreso guardado)
- 100% de alineación entre el motor de Typescript y TradingView (Pine Script).
- Implementación de Trailing Stop asíncrono.
- Alertas multicanal: Push Web, Telegram, y Email (Lazy loaded para evitar crash en build-time).
- Rendimiento Compuesto corregido para reportar porcentajes reales de portafolio base.
- Botón "Instalar App" para soporte PWA, con fallback nativo en iOS Safari.
