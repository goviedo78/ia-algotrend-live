# Plataforma modular de brokers

- **Fecha base:** 2026-07-17
- **Producto:** GONOVI, con AlgoTrend como una estrategia conectable
- **Primera integración:** BingX Perpetual Futures
- **Primer mercado:** `BTC-USDT`, `1h`
- **Ejecución:** backend de `gonovi.app`, sin VPS ni webhook para el flujo interno
- **Estado live:** bloqueado hasta completar piloto Demo y reconciliación

El diagrama editable está en `2026-07-15-multi-broker-platform.mmd`. El procedimiento operativo está en `docs/broker-platform-runbook.md`.

## Objetivo

Permitir que usuarios autorizados conecten credenciales propias de brokers y reciban las operaciones generadas por estrategias de GONOVI. La implementación debe admitir nuevos brokers mediante adapters, mantener el tamaño de cada orden bajo control del servidor y proteger las credenciales aunque la base de datos sea leída sin autorización.

## Alcance inicial

- Administración de acceso, conexiones, validación, aprobación, suspensión, rotación y revocación.
- BingX Demo y Live como entornos separados.
- Binding inicial fijo: `ALGOTREND_BTC_1H / BTC-USDT / 1h`.
- Capital declarado y gestión de riesgo sugerida.
- Órdenes market de apertura y cierre `reduceOnly`.
- Registro de señales, intenciones, jobs, órdenes, fills, fees, PnL y auditoría.
- Interruptores globales para ejecución general y cuentas reales.
- Registry preparado para Binance y otros adapters futuros.

No incluye copy trading arbitrario, retiro/transferencia de fondos, P2P, Spot, administración de subcuentas ni lotes introducidos desde la señal.

## Decisión arquitectónica

El indicador y el ejecutor forman parte de la misma aplicación:

```text
cron/check
  -> calcula AlgoTrend con vela cerrada
  -> actualiza la operación de la app
  -> dispatchBrokerSignal
  -> Supabase: signal + intent + job
  -> Next.js after()
  -> worker server-only
  -> risk engine
  -> BingX adapter
  -> orden + reconciliación
```

No hay un VPS, daemon, servicio `systemd` ni llamada HTTP desde el cron hacia la propia app. El endpoint HMAC de señales existe para integraciones futuras, pero no es parte del camino normal de AlgoTrend BTC 1H.

## Compatibilidad con el bot actual

El cron conserva temporalmente la ejecución heredada mediante `safeExecuteBingxOpen/Close`. La señal modular se emite además de esa llamada para permitir una migración sin cortar la cuenta existente.

Esta convivencia crea una regla operativa estricta: una misma cuenta BingX no puede estar activa simultáneamente mediante `BINGX_API_KEY` y mediante una conexión modular. Para migrarla, primero se valida Demo, luego se desactiva `BINGX_TRADING_ENABLED` y finalmente se aprueba la conexión nueva.

## Módulos

### Control de acceso

- Supabase Auth para sesión.
- MFA AAL2 para acciones administrativas sensibles.
- Membresías separadas de roles administrativos.
- Rutas server-side que vuelven a validar identidad y autorización.
- Redirects internos validados y cuerpos JSON acotados.

### Conexiones

Cada conexión guarda broker, entorno, etiqueta, estado, referencia de cuenta, permisos confirmados y timestamps. Nunca devuelve API key, secret, ciphertext ni material criptográfico al navegador.

Estados válidos:

- `PENDING_VALIDATION`
- `PENDING_APPROVAL`
- `ACTIVE`
- `SUSPENDED`
- `VALIDATION_FAILED`
- `MANUAL_INTERVENTION_REQUIRED`
- `REVOKED`

### Credenciales

1. El navegador envía key y secret por TLS a una ruta autenticada.
2. El servidor genera una data key aleatoria.
3. Las credenciales se cifran con AES-256-GCM y AAD ligada a conexión, usuario, broker, entorno y versión.
4. La data key se cifra con RSA-OAEP-SHA256.
5. Supabase recibe sólo ciphertext, IV, auth tag, data key cifrada, AAD y versión.
6. El texto plano se descarta y nunca se registra.
7. El runtime server-side usa la clave RSA privada sólo al procesar un job.

Las claves RSA son variables privadas del servidor. No llevan prefijo `NEXT_PUBLIC_`, no se almacenan en Supabase y no aparecen en logs.

### Registry de brokers

El contrato común cubre:

- validar credenciales;
- consultar balance y margen;
- consultar posiciones;
- obtener reglas y precio del instrumento;
- configurar apalancamiento;
- enviar market order;
- buscar orden por `clientOrderId`;
- consultar fills.

El código de señales y riesgo no conoce endpoints específicos de BingX. Agregar Binance requiere un adapter y su mapeo de errores, no una segunda arquitectura.

### Señales e idempotencia

La señal canónica contiene:

```json
{
  "externalSignalId": "algotrend-btc-1h-123-open-1784300400",
  "strategyCode": "ALGOTREND_BTC_1H",
  "symbol": "BTC-USDT",
  "timeframe": "1h",
  "action": "OPEN",
  "direction": "LONG",
  "signalTime": "2026-07-17T01:00:00.000Z",
  "price": 64000
}
```

No admite `quantity`, `notional` ni `leverage`. La unicidad de estrategia más identificador externo deduplica señales. La unicidad de conexión más señal deduplica intenciones. El `clientOrderId` es determinista para reconciliar un timeout sin duplicar una orden.

### Cola y ejecución

- Supabase guarda jobs con estado, intentos, disponibilidad y lock.
- Una función service-role reclama trabajos con `FOR UPDATE SKIP LOCKED`.
- Locks antiguos se recuperan automáticamente.
- Las rutas que crean trabajos programan `safeProcessBrokerJobsInApp` con `after()`.
- El cron también drena una tanda para recuperar retries pendientes.
- Cada invocación limita batch y cantidad de tandas para respetar el runtime serverless.
- Errores ambiguos consultan la orden por `clientOrderId` antes de reintentar.
- Los jobs terminales quedan disponibles para diagnóstico y auditoría.

### Riesgo

El usuario no configura lotes. Declara capital asignado y elige un perfil:

| Perfil | Orden | Exposición | Pérdida diaria | Reserva |
| --- | ---: | ---: | ---: | ---: |
| Muy conservador | 3% | 6% | 1% | 70% |
| Conservador | 5% | 10% | 2% | 60% |
| Moderado | 8% | 16% | 3% | 50% |

Para USD 100 conservador, la propuesta es USD 5 por orden con máximo global `1x`. El administrador sólo puede reducir la propuesta. La función de aprobación vuelve a imponer esa relación en base de datos.

El motor fail-closed verifica en el momento de enviar:

- estado de conexión y política;
- símbolo permitido;
- margen y reserva;
- notional por orden;
- exposición total;
- posiciones abiertas;
- órdenes por minuto;
- pérdida diaria realizada;
- precio y reglas del instrumento;
- precisión, step y mínimo de notional.

Para abrir, `quantity = floorToStep(fixedNotionalUsd / price)`. Para cerrar, se usa la cantidad real de la posición y `reduceOnly`. Así BTC, oro u otro instrumento no comparten lotes incompatibles.

## Seguridad

### Controles preventivos

- RLS en todas las tablas públicas del módulo.
- Grants explícitos y sobres de credenciales sin acceso para `anon`/`authenticated`.
- Service role sólo en servidor.
- Cifrado autenticado y AAD.
- MFA para administración.
- Validación same-origin, límites de cuerpo y rate limit distribuido.
- API de broker con lectura y perpetuos únicamente.
- Sin permisos de retiro, transferencia, P2P, Spot o subcuentas.
- Kill switches globales y por conexión.
- Live bloqueado independientemente de Demo.

### Límite aceptado

Vercel usa salida dinámica, por lo que BingX no puede restringir la credencial a una única IP sin añadir infraestructura externa. Se acepta ese límite porque el objetivo explícito es ejecutar dentro de `gonovi.app`. La defensa compensatoria es privilegio mínimo, cifrado, MFA, rotación, límites de riesgo e interruptores fail-closed.

### Auditoría

Se registran actor, conexión, evento, resultado, metadata sanitizada, IP hasheada, user-agent hasheado y encadenamiento de hashes. Nunca se guardan API key, secret, firma completa, headers privados ni payload de credenciales.

## Datos principales

- `broker_memberships`
- `broker_connections`
- `broker_credential_envelopes`
- `broker_risk_policies`
- `broker_strategy_bindings`
- `broker_signals`
- `broker_order_intents`
- `broker_execution_jobs`
- `broker_orders`
- `broker_fills`
- `broker_position_snapshots`
- `broker_ledger_entries`
- `broker_audit_events`
- `broker_signal_nonces`
- `broker_rate_limit_buckets`

La tabla histórica `broker_worker_heartbeats` no se usa en la arquitectura serverless.

## Despliegue por etapas

### Etapa 1: código y esquema

- Aplicar migraciones.
- Configurar claves RSA server-side.
- Mantener ambos interruptores en `false`.
- Validar typecheck, lint, tests, build, schema lint y auditoría de dependencias.

### Etapa 2: Preview + BingX Demo

- Usar una API Demo nueva y de privilegio mínimo.
- Aprobar sólo BTC 1H y `1x`.
- Habilitar ejecución general únicamente en Preview.
- Verificar apertura, deduplicación, cierre, fills y fees.
- Forzar timeout/retry y confirmar ausencia de órdenes duplicadas.

### Etapa 3: observación

- Reconciliar durante al menos una semana de señales.
- Comparar app, BingX, fees y PnL neto.
- Resolver cualquier drift antes de ampliar usuarios o brokers.

### Etapa 4: Live controlado

- Requiere decisión administrativa separada.
- Mantener notional mínimo, `1x`, una estrategia y un usuario piloto.
- Desactivar el camino heredado antes de conectar la misma cuenta.
- Preparar rollback mediante kill switch y suspensión.

## Criterios de aceptación

- Una apertura/cierre del indicador crea una sola señal modular.
- Repetir una señal no duplica la orden.
- Una conexión no aprobada no opera.
- Una política deshabilitada no abre.
- Una cuenta Live no opera con el switch live apagado.
- El cierre no abre la dirección contraria.
- La cantidad se deriva en servidor desde USD y reglas reales.
- La UI nunca vuelve a mostrar secretos.
- Un usuario no lee conexiones, órdenes o auditoría de otro usuario.
- Los registros incluyen fees y PnL reconciliados.
- El cron existente sigue funcionando durante la migración.

## Verificación técnica

```bash
npm run typecheck
npm run test:brokers
npm run lint
npm run build
npx supabase db lint --linked --schema public
npm audit --omit=dev
```

La salida a producción del código y la habilitación de trading son acciones distintas. El despliegue nunca debe cambiar automáticamente `BROKER_EXECUTION_ENABLED` ni `BROKER_LIVE_EXECUTION_ENABLED`.
