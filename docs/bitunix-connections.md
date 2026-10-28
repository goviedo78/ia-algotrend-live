# Bitunix como alternativa en Conexiones

Preparación del 28-10-2026. La integración usa el backend existente de Vercel, sin VPS,
pasarela, IP fija ni servicios pagos adicionales. Cada cuenta conserva una conexión,
credenciales cifradas, aprobación, política de riesgo, órdenes y contabilidad propios.
No hay transferencia automática entre BingX y Bitunix ni fallback de órdenes entre brokers.

## Alcance

- Bitunix: BTC 1H, futuros USDT y entorno LIVE. DEMO se rechaza en formulario, API,
  constructor del adaptador y base de datos. No se presenta una cuenta real como simulada.
- Oro sigue disponible en BingX. El contrato `NCCOGOLD2USD-USDT` no se asume equivalente
  a `XAUUSDT` de Bitunix: requiere verificar instrumento y estrategia por separado.
- BingX conserva su adaptador, hosts Demo/Real, firma, switches, lotaje y ruta legacy.
- La API de cada usuario debe ser exclusiva, con lectura y trading de futuros, sin
  retiros, transferencias, Spot ni subcuentas. Vercel usa salida dinámica: esta versión
  requiere que la clave permita solicitudes sin restricción de IP.
- Validar lectura no prueba el permiso de trading. No se envía una orden para validarlo.

## Protección de ejecución

`BITUNIX_EXECUTION_ENABLED` está desactivado cuando no existe o no vale `true`.
Permite consultar saldo, posiciones, modo de posición y reglas, pero bloquea cambios
de apalancamiento y órdenes. La aprobación y reactivación administrativa de Bitunix
también quedan bloqueadas, evitando activar bindings que carguen la cola durante la prueba.

Para operar se necesitan **además** los controles existentes
`BROKER_EXECUTION_ENABLED`, `BROKER_LIVE_EXECUTION_ENABLED`, la aprobación administrativa
y una política/binding activos. No cambiar esos controles para probar Bitunix: también
afectan a BingX. No cambiar credenciales o conexiones BingX existentes.

Antes de habilitar ejecución real, revocar el par que tuvo una copia en una captura local
de Codex y cargar una credencial nueva mediante Conexiones. Las claves por usuario
se cifran mediante el mecanismo de sobres existente; no se agregan claves compartidas
a variables globales, código fuente ni archivos del repositorio.

## Contrato con la API

El único destino es `https://fapi.bitunix.com`, sin redirects ni hosts configurables.
La firma doble SHA256 usa nonce nuevo y timestamp por solicitud, los parámetros GET
ordenados en ASCII y exactamente el JSON enviado para POST. Los errores no incluyen
mensajes crudos del broker ni headers de autenticación.

Los símbolos se traducen en el adaptador (`BTC-USDT` → `BTCUSDT`); las señales y la
contabilidad mantienen el símbolo de la estrategia. Las aperturas usan cantidad base
redondeada hacia abajo a la precisión real del contrato. El importe ejecutado puede
diferir del objetivo por esa precisión y por el precio de mercado; se contabilizan fills reales.

En ONE_WAY los cierres usan el lado opuesto y `reduceOnly`. En HEDGE Bitunix requiere
el lado original, `tradeSide=CLOSE` y el `positionId` exacto; el adaptador identifica una
única posición de esa dirección y rechaza cantidades insuficientes o coincidencias ambiguas.
No cambia el modo de posición ni usa close-all. La capa compartida conserva el control
de cantidad propia por conexión.

Las órdenes conservan el `clientId` determinista de la intención. La recuperación consulta
ese identificador, sólo interpreta `20007` como ausencia y trata el duplicado `30042`
como recuperable mediante la cola existente. No reintenta internamente un POST ambiguo.
Los IDs int64 se conservan como texto; un número fuera del rango seguro se rechaza.

Las ejecuciones se filtran por orden, símbolo y clientId cuando está disponible, se
deduplican y paginan con un máximo de diez páginas. Al superar ese máximo se falla
explícitamente; no se devuelve una contabilidad parcial como completa. Se requieren
precio, cantidad, comisión, PnL y timestamp válidos. El campo `price` de una orden no
se usa como precio promedio ejecutado: ese valor se obtiene de los fills.

La documentación de futuros no publica una consulta de comisión por cuenta. Se reserva
la tarifa estándar VIP0 de 0,06% taker (0,02% maker), conservadora respecto de descuentos
VIP, y la interfaz la identifica como estimación. La contabilidad usa la comisión real.
Revisar la tarifa publicada antes de habilitar dinero real si cambió desde esta preparación.

## Pruebas y capacidad

```sh
npm run test:brokers
npm run test:auth
npm run test:engine
npm run typecheck
npm run lint
npm run broker:check:bitunix
```

La última orden es exclusivamente de lectura. Lee el par local desde
`~/.config/gonovi/secrets/bitunix.txt` (API key primero, secret después), sin mostrarlo,
pasarlo por argumentos de proceso ni imprimir saldos o posiciones. El transporte del probe
bloquea cualquier método distinto de GET y cualquier origen distinto de Bitunix.

La migración se verifica en PostgreSQL aislado ejecutando, en orden, los tres archivos:

1. `tests/brokers/bitunix-migration-setup.sql` (sólo en una base descartable).
2. `supabase/migrations/20261028182224_add_bitunix_broker.sql`.
3. `tests/brokers/bitunix-migration-assert.sql`.

Se preservan filas BingX/Binance, RLS y grants; se acepta Bitunix LIVE/BTC y se rechaza
DEMO, oro no validado y brokers desconocidos. La migración no crea tablas ni amplía
permisos ni modifica funciones de señales o de la cola.

Las pruebas simulan 50 cuentas con datos privados separados y 50 lectores simultáneos
que comparten una consulta pública por instancia. Contratos se cachean cinco minutos;
precios de ejecución 500 ms y precios de pantalla cinco segundos, en caches exclusivos
de Bitunix y sin mezclar brokers. Las caches no son globales entre instancias Vercel.
Esto no certifica 50 cuentas reales operando ni límites agregados por IP; los límites
del broker y errores 429/10005/10006 siguen sujetos a la cola y reintentos acotados existentes.

## Publicación y primera operación

Esta preparación no aplica la migración remota, publica Vercel ni activa trading.
Antes de publicar, revisar el diff y las pruebas; aplicar únicamente la migración nueva
al proyecto Supabase correcto, sin arrastrar migraciones ajenas pendientes. Publicar
la aplicación validada con `npm run deploy:prod`, según el protocolo del proyecto,
y verificar la landing pública completa en `https://gonovi.app`.

Registrar una conexión Bitunix nueva, confirmar validación y conservarla pendiente de
aprobación. La primera operación y su cierre real necesitan autorización del titular,
capital/lotaje explícitos, credenciales nuevas y seguimiento de intención, orden, fills,
fees y PnL. No crear órdenes de prueba ni habilitar el switch sólo para comprobar lectura.
Una caída de Bitunix no debe redirigir sus órdenes a BingX.

## Fuentes oficiales consultadas

- [Firma](https://www.bitunix.com/api-docs/futures/common/sign.html).
- [Cuenta](https://www.bitunix.com/api-docs/futures/account/get_single_account.html),
  [posiciones](https://www.bitunix.com/api-docs/futures/position/get_pending_positions.html).
- [Reglas de contratos](https://www.bitunix.com/api-docs/futures/market/get_trading_pairs.html),
  [órdenes](https://www.bitunix.com/api-docs/futures/trade/place_order.html),
  [consulta por clientId](https://www.bitunix.com/api-docs/futures/trade/get_order_detail.html),
  [fills](https://www.bitunix.com/api-docs/futures/trade/get_history_trades.html).
- [Errores](https://www.bitunix.com/api-docs/futures/ErrorCode/error_code.html),
  [tarifas publicadas](https://www.bitunix.com/service/handling-fee).
