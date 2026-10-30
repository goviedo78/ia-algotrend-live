# Telegram · AlgoTrend BTC/USD 1H

## Prealerta resumida — 28-10-2026

Se acorta «Condiciones favorables» en caption e imagen: dirección, BTC 1H,
probabilidad de señal, fecha/hora de cierre y «Señal sin confirmar».
Solo si corresponde, se añade «Posible giro de VENTA a COMPRA» o su inverso.
Se eliminan explicaciones repetidas del motor. La imagen pasa de 1080×1120
a 1080×820. No cambia cuándo se emite ni la lógica de confirmación.
Publicado con `npm run deploy:prod`: `dpl_EdsVZf45twLwBNuhPXt7ouBHzmjc`,
READY, target production y alias `https://gonovi.app`; landing completa verificada.
62 pruebas de motor/Telegram aprobadas; TypeScript, lint y build correctos.


## Avisos nuevos autorizados — 28-10-2026

Además de entradas y cierres, se implementan:
- TRIGGER ACTIVADO: una sola vez por operación al persistirse el stop móvil.
  Solo se envía si la operación continúa abierta; si se cierra/revierte en la
  misma corrida, el cierre informa el motivo sin un intermedio obsoleto.
- CONDICIONES FAVORABLES: candidato de compra/venta del motor completo sobre
  vela abierta, pendiente de cierre, sujeto a KNN, tendencia y filtros.
  Se revisa al minuto 57 y vence al cierre horario. Máximo una prealerta por
  vela y destino. No anuncia un precio de confirmación sin validación.

Ambos usan imagen y caption. Las prealertas no abren ni cierran operaciones,
no despachan órdenes y no alteran la tasa de aciertos/PnL. Reserva privada
atómica por aviso para evitar duplicados concurrentes y tras reinicios.
Las revisiones reales de trigger siguen confirmándose con velas cerradas;
no se anuncia un toque intravela como activación definitiva.
La reversión conserva CIERRE primero y luego ENTRADA, si pasa los filtros.
Diseño y alcance detallados: `docs/telegram-prealertas-diseno.md`.

Desplegado con `npm run deploy:prod`: `dpl_CTuBxeZzUvyLYfkjvQPcSKejy2e8`,
READY, target production y alias `https://gonovi.app`; landing completa verificada.
190 pruebas aprobadas: 62 motor/Telegram y 128 brokers. TypeScript, lint y build
correctos; permanece una advertencia previa en scratch. Cron existente 7501566
activo y validado con minutos 2, 7, 17, 32, 47 y 57. El bot conserva permiso de
publicación. Migración 20261028173842 aplicada: RLS activo, sin policies públicas,
sin permisos anon/authenticated y con acceso service_role. Se verificó la clave
única con transacción revertida; no quedaron registros de prueba ni se crearon
operaciones de prueba. Los envíos de Telegram de las pruebas fueron simulados.


## Motivo de cierre sin avisos intermedios — 28-10-2026

Se mantiene el flujo de solo entrada y cierre para evitar mensajes adicionales.
El cierre añade una línea «Motivo» en imagen y caption: Stop loss (SL), Take
profit (TP), Stop móvil (trigger activado) o Cambio de señal. Los resultados,
precios, duración y resumen de cinco operaciones conservan el formato aprobado.
La imagen de cierre mide 1080×1660 para alojar la nueva línea sin comprimirla.
Validado con 54 pruebas de motor/Telegram, TypeScript, lint y build.
Publicado mediante `npm run deploy:prod`: `dpl_7RwWmQcp5oBSeT6iLtDc58cMEKQK`,
READY, target production, alias `https://gonovi.app` y landing completa comprobada.
No se enviaron ejemplos al canal ni se invocó el cron manualmente.

El trigger del motor activa el trailing tras un recorrido favorable del 1%;
no es por sí mismo una orden de cierre. La evidencia de trailing se transporta
hasta la notificación incluso si se activa y cierra dentro de una sola vela o
un hueco de ejecución del cron. Esto no cambia precios, reglas, motivos internos
SL/TP/SIGNAL, órdenes ni datos guardados. No se infiere trailing por PnL positivo.
Cuando no hay evidencia del replay, se identifica por TP nulo y stop que protege
la entrada. No se reconstruyen ni modifican operaciones históricas.


## Aperturas con riesgo y probabilidad — 28-10-2026

Se amplía el formato de entrada previamente aprobado para incluir los datos
que ya recibe la app: SL (Stop loss), TP (Objetivo), ATR porcentual y probabilidad
de señal. Aparecen en imagen (1080×900) y caption, también en el fallback de texto.
Se conservan dirección, BTC 1H, precio de entrada y fecha/hora CDMX.
TP nulo se muestra como «Stop móvil»; valores ausentes o inválidos como «—».
La probabilidad de señal no es la tasa de aciertos del historial. El cron convierte
su valor 0–1 a porcentaje; el webhook opcional ya lo recibe en puntos porcentuales.
Los cierres conservan su formato anterior. No se modifican operaciones ni órdenes,
ni se envían simulaciones al canal como parte de este cambio.

Verificación local: 51 pruebas de motor/Telegram aprobadas, TypeScript correcto,
y revisión visual de PNG sintético generado sin acceder a la base de datos.
La primera ejecución de las regresiones falló con el formato anterior.
Publicado con `npm run deploy:prod`: `dpl_84cb1vFrvEuLdcB9EsC7dFoACtV9`,
READY, target production y alias `https://gonovi.app`. Build y lint correctos
(una advertencia previa en scratch). El primer intento de Vercel devolvió
«Not authorized»; el segundo completó la publicación con la misma cuenta.


## Formato aprobado y auditoría de las pruebas — 26-10-2026

El usuario aprobó el formato actual y pidió conservarlo y desplegarlo:

- Entrada: `ENTRADA · 🟢 COMPRA` o `ENTRADA · 🔴 VENTA`, BTC 1H, precio de
  entrada y fecha/hora CDMX. Imagen clara con la paleta GONOVI y sombras suaves.
- Cierre: `CIERRE · ✅ OPERACIÓN GANADORA (+0.72%)` o resultado correspondiente,
  precio de entrada, precio de cierre, duración y una sola línea de resumen:
  `Últimas 5 operaciones: aciertos 80% · PNL acumulado +3.21% en 15 días.`
  El caption no repite marca, fechas, operaciones individuales ni condiciones
  que ya aparecen en la imagen. La imagen conserva la duración precisa del
  período y el bloque acumulado diferenciado con subrayado bronce.
- Cero y datos ausentes mantienen clasificación neutral. El acumulado es
  compuesto sobre las últimas cinco cerradas; no se cuentan abiertas.

Auditoría de solo lectura a las 17:06 CDMX: **107 operaciones**, último ID **371**;
**0** abiertas, **0** entradas en la fecha de las pruebas, **0** operaciones
posteriores al primer envío de simulación y **0** registros con ID temporal 0.
El cierre histórico #371 conserva exactamente precios, fechas y PnL anteriores.
Los scripts de envío no llaman a funciones de escritura de operaciones,
brokers ni cron. Los cierres de prueba reutilizaron datos históricos; las
entradas fueron objetos temporales. No se borraron operaciones históricas.
Evidencia local: `output/telegram-simulation-audit.json`; los recibos privados
se conservan en `.broker-secrets/telegram-*.json`.

Verificación: 48 pruebas de motor/Telegram, 128 de brokers y 9 de autenticación.
La regresión de simulaciones ejecuta el renderer real con datos congelados y
verifica que el único tráfico externo sea el envío a Telegram; no altera el
historial. El programador existente `7501566` está activo y sin deriva, sin
crear otro ni invocarlo manualmente. No se enviarán nuevas pruebas como parte
de esta validación final. Despliegue final completado con `npm run deploy:prod`:
`dpl_4cBhYKCPdQr7NxzTrxsNavcu8i2m`, READY, target production y
`Aliased: https://gonovi.app`. Comprobación posterior correcta de landing pública
completa; TypeScript y lint sin errores (advertencia previa en un scratch ajeno).
Total: **185 pruebas aprobadas**. El formato aprobado queda activo para los
siguientes eventos reales; los envíos de prueba no se convierten en operaciones.

## Caption breve y precios de entrada/cierre — 26-10-2026

Formato publicado con ambos precios en imagen y caption. La entrada conserva
dirección, BTC 1H, precio de entrada y fecha/hora. El cierre empieza directamente
por `CIERRE · ✅ OPERACIÓN GANADORA (+0.72%)` (o la clasificación correspondiente),
seguido de entrada, cierre y duración. Debajo, una sola línea: últimas cinco,
aciertos y PNL acumulado en días enteros transcurridos; para períodos menores
de un día se muestran horas/minutos. Imagen conserva fechas, precisión horaria,
desglose por operación y condiciones del compuesto; no se duplican en el caption.
Precio desconocido/no positivo/no finito se representa como «—».
47 pruebas pasan; regresiones nuevas fallaron antes de la implementación.
Publicado con `npm run deploy:prod`: `dpl_FE9MmHXpRrpmk2ZiuEnZLEcsTUDt`, READY,
target production y `Aliased: https://gonovi.app`; landing completa verificada.

El ejemplo anterior (`message_id=10`) no pudo editarse: Telegram devolvió HTTP
400 MESSAGE_ID_INVALID. Se publicó un solo reemplazo histórico de prueba,
`message_id=11`, https://t.me/gonovi_canal/11, con entrega confirmada, precios
$81,757.85 → $81,166.22 y resultado +0.72% en 8 h. No se alteró el historial
ni se ejecutaron órdenes. Recibo privado:
`.broker-secrets/telegram-positive-close-short-text-20261026.json`.

## Símbolos de dirección y resultado — publicados el 26-10-2026

Próximos avisos: ENTRADA · 🟢 COMPRA / ENTRADA · 🔴 VENTA; CIERRE ·
✅ OPERACIÓN GANADA si `pnl_pct > 0`, ❌ OPERACIÓN PERDIDA si es negativo,
⚪ OPERACIÓN SIN CAMBIO si es cero y ⚪ RESULTADO NO DISPONIBLE si falta/no es
finito. Se decide por PnL, nunca por motivo: un stop móvil con PnL positivo es
ganador. Se mantienen porcentajes, duración, cinco cerradas, acumulado y período.
Caption, texto alternativo e imágenes comparten la clasificación. Las imágenes
dibujan símbolos SVG equivalentes, sin descargar assets de emoji. Las filas del
historial incorporan dirección y símbolo de resultado junto al porcentaje.
46 pruebas pasan; casos nuevos fallaron antes de implementar. PNG generado y
revisado, tipos y lint correctos. Publicado con `npm run deploy:prod`, deployment
`dpl_8BjfQSFJGZ7R5oSsT1RAH3XQYKYY`, READY, target production y
`Aliased: https://gonovi.app`; landing pública completa verificada.
No se enviaron pruebas nuevas al canal para esta configuración.

Prueba de COMPRA sin marca de demo, solicitada explícitamente por el usuario
(canal sin comunidad todavía), 26-10-2026 16:24 CDMX: un único PNG con el
renderer de producción y su caption exacto, `ENTRADA · COMPRA`, `BTC · 1H`,
`26 oct 2026, 16:24 · CDMX`. Entrega confirmada, `message_id=8`:
https://t.me/gonovi_canal/8. Solo fixture transitorio de visualización, sin
consultas/escrituras en base, sin ejecución del cron ni llamadas a brokers.
Recibo privado `.broker-secrets/telegram-simulated-buy-20261026.json` marca
`simulation=true` y previene repetir la prueba. No constituye una señal del motor.

## Demo pública solicitada por el usuario — 26-10-2026

Publicado un álbum de tres imágenes en `@gonovi_canal`, usando el bot dedicado:
COMPRA, VENTA y CIERRE con historial/acumulado. Telegram confirmó `message_id`
5, 6 y 7, grupo `14344426684251177`: https://t.me/gonovi_canal/5.
Imágenes marcadas «DEMO · NO ES UNA SEÑAL REAL», con texto de presentación que
explica los formatos y que el cierre usa historial pasado. No se generaron
operaciones ni se disparó el cron para esta demostración. Identidad del bot,
canal y permiso de publicación verificados antes del envío. Un único envío de
álbum, sin reintentos. Recibo privado en
`.broker-secrets/telegram-public-demo-20261026.json`; caption local en
`output/telegram-demo-caption.txt`.

## Plantilla de imagen — publicada en producción

Rediseño limpio de producto (26-10-2026): aplicado a COMPRA, VENTA, CIERRE y
RESUMEN con la dirección visual del usuario y las skills frontend-design y
apple-design. Fondo gris neutro claro #ECEDEF, superficies derivadas del crema,
sombras suaves, jerarquía tipográfica y sin efectos luminosos. Paleta GONOVI v2
verificada en `src/styles/brand-tokens.css`: navy #1C223A, crema #E5D4B6,
bronce #C9A87A, acero #3A3F4D y pulse #F44E1C. Rampas oficiales para contraste
accesible: good-deep #1A3024, pulse-700 #D43D10 y bronze-deep #9A7E54;
verde #4FBC72 en el resultado acumulado sobre navy. El bloque inferior conserva
el subrayado y su diferenciación. Se conservan la entrada mínima, las métricas
y su cálculo. Las imágenes siguen renderizadas desde código con datos reales.
45 pruebas correctas, tipos/lint correctos y cuatro variantes inspeccionadas.
Publicado con `npm run deploy:prod`: `dpl_6jy9eQ2s62b1MbQFjwmH8425hcX1`, READY,
target production, `Aliased: https://gonovi.app`; landing completa verificada.
La presentación local usa una cuadrícula asimétrica con las cuatro imágenes.
Exportación 8K verificada visualmente: `output/telegram-design-presentation-8k.png`
(7680×4320). Las alertas individuales conservan sus tamaños para Telegram.
No se publicaron nuevas muestras en el canal para este rediseño.

Realce visual del acumulado (26-10-2026): desde PNL acumulado hasta el pie se
agrupan los datos en un fondo navy más claro, con borde superior y subrayado
del título en bronce. Vistas de cierre y resumen regeneradas y revisadas sin
recortes; cuatro pruebas del renderizador, TypeScript y lint correctos.
Publicado mediante `npm run deploy:prod`, deployment
`dpl_14Qqq81Frdx1E1vpxb912smQUVcM`, READY, target production,
`Aliased: https://gonovi.app`; verificación de landing completa correcta.
No se enviaron mensajes de prueba al canal para este ajuste visual.

### Ajuste de formato del 26-10-2026

La nueva versión simplifica las entradas a **ENTRADA · COMPRA/VENTA**, BTC 1H y
fecha/hora CDMX, en PNG 1080×640. No muestra precios, stop, objetivo, ID,
estadísticas ni pie de rendimiento. Caption y alternativa de texto respetan el
mismo contenido mínimo. La entrada tampoco consulta la base por el historial.

El cierre muestra CIERRE, porcentaje de esa operación y duración exacta en días,
horas y minutos. Debajo incluye las últimas cinco operaciones cerradas (incluye
el cierre recién confirmado una sola vez), después PnL acumulado compuesto y
duración del período, tasa de aciertos y fechas del conjunto. Se conservan la
identidad y las condiciones del cálculo en el cierre. Sin precios/stop/objetivo
ni motivo de salida. Se mantienen los límites de entrega y la prevención de
duplicados. Regresiones de imagen, caption y texto alternativo: 45 pruebas pasan;
tipos y lint de archivos tocados correctos. Ejemplos locales regenerados y
revisados visualmente. Ajuste publicado con `npm run deploy:prod`: deployment
`dpl_ZM2D5QJBwuDm9yQJUGtjDUnkuFzz`, READY, target production y
`Aliased: https://gonovi.app`; comprobación pública de landing completa correcta.
Se aplicará a los siguientes eventos reales; no se enviaron nuevas pruebas al canal.

La ampliación siguiente fue aprobada por el usuario y publicada mediante
`npm run deploy:prod`, deployment `dpl_E3aZGGZYNoprf8zKpqrTuC9GKWPA`, estado READY,
target production y alias `https://gonovi.app`. La landing completa respondió
HTTP 200 después del despliegue. Telegram confirmó un resumen histórico real en
PNG, `message_id=4`, https://t.me/gonovi_canal/4 (177679 bytes de imagen fuente).
Recibo privado: `.broker-secrets/telegram-image-summary-receipt.json`. No se
publicaron ejemplos de entradas/salidas ni se fabricaron señales reales.

El proceso no depende de la computadora del usuario ni de mantener este chat
abierto: cron-job.org llama al motor alojado en Vercel en los minutos UTC
02, 07, 17, 32 y 47 de cada hora. El motor registra entradas/cierres confirmados,
consulta el historial, genera el PNG en el servidor y lo sube por la API del bot
al canal oficial. El programador existente `7501566` se verificó activo y sin
deriva de configuración. Las alertas siguen la evaluación de velas BTC 1H del
motor; no se añade una evaluación tick a tick. El VPS de PilotControl no participa.

- `telegram-card.tsx` genera un PNG con `next/og`, sin navegador ni servicios de
  imágenes externos: 1080×640 para entradas, 1080×1500 para resumen y 1080×1620 para cierres.
- Identidad GONOVI / AlgoTrend BTC 1H DEMO en cierres/resumen. La entrada es
  mínima: ENTRADA, COMPRA/VENTA, BTC 1H y hora; cierre: CIERRE, duración y
  resultado de esa operación, seguido por el historial y el acumulado.
- La sección de resultados usa las cinco últimas operaciones **cerradas**.
  La operación abierta aparece como evento aparte. Se consultan seis registros
  para cubrir la operación abierta única del motor y las cinco cerradas.
- PnL compuesto: `(producto(1 + pnl_pct/100) - 1) × 100`, con reinversión teórica
  del 100%, antes de comisiones, slippage y apalancamiento. No usa el PnL de una
  cuenta real ni inventa un capital.
- Tasa de aciertos: ganadoras / cerradas. Un resultado cero no cuenta como
  ganador; las abiertas no entran en el denominador. Si falta un resultado no
  se inventa el porcentaje.
- Período: apertura más antigua hasta último cierre del conjunto, incluyendo
  las esperas entre operaciones; duración transcurrida en días y horas,
  sin redondear hacia arriba. Fechas y horas en America/Mexico_City (CDMX).
- Datos reales de la vista previa: +3,21% compuesto en **15 días y 15 h**, 80%
  de aciertos (4/5), del 06-10-2026 19:00 al 22-10-2026 10:00 CDMX.
- `sendPhoto` sube el PNG directamente por multipart y agrega un caption breve
  con el mismo cálculo. Se conserva el destino y tema configurados. Si la
  generación falla antes del envío o Telegram rechaza explícitamente la imagen
  (400/413), se envía texto una vez. Timeout ambiguo, 403 o 429 no disparan un
  segundo mensaje. No se agregaron reintentos automáticos.
- Vistas previas locales en `output/telegram-card-summary.png` y
  `output/telegram-card-close-preview.png`; inspección visual sin controlar PC.
  Suite ampliada: 45 pruebas de motor, métricas, generación real PNG y entrega.
- Ejemplos de diseño en `output/telegram-example-buy.png`,
  `output/telegram-example-sell.png` y `output/telegram-example-close.png`,
  todos marcados «EJEMPLO · NO ES UNA SEÑAL» y sin envíos al canal. Las entradas
  usan precios ilustrativos y conservan las cinco operaciones cerradas reales
  para mostrar la distribución de la plantilla.

Estado (26-10-2026): bot exclusivo `@AlgoTrendOficial_bot` (AlgoTrend), verificado
por `getMe`. El usuario confirmó su canal oficial `@gonovi_canal`, título
«GonOvi YouTube», ID `-1002032430311`, y agregó el bot. `getChat` confirmó la
identidad y `getChatMember` confirmó `administrator` y `can_post_messages=true`.
Token y destino guardados en `.env.local` ignorado por Git (permisos 600) y como
secretos de Production de Vercel. No se modificó auto-publicador ni PilotControl,
ni se registraron webhooks de Telegram.

Entrega real confirmada por Telegram: resumen inicial histórico de cinco
operaciones cerradas, `message_id=3`: https://t.me/gonovi_canal/3. Recibo privado
local en `.broker-secrets/telegram-initial-summary-receipt.json` para evitar
repetir el envío. El mensaje identifica el historial como resumen y no como señal
nueva. El cron BTC existente (`7501566`) pasó la comprobación de solo lectura,
sin deriva y activo en `https://gonovi.app/api/cron/check`.

Producción entregada con `npm run deploy:prod`: deployment
`dpl_E3aZGGZYNoprf8zKpqrTuC9GKWPA`, `readyState=READY`, `target=production`,
`Aliased: https://gonovi.app`. El control posterior confirmó la landing pública
completa de GONOVI. Las próximas entradas/salidas del cron usan las credenciales
dedicadas; todavía no se observó una señal nueva posterior a este despliegue.

El primer intento de producción falló en el resolver de Google Fonts de
Turbopack (`next/font/google queries have exactly one entry`). `vercel.json` usa
`npm run build -- --webpack`, la alternativa documentada por Next.js, para
compilar sin cambiar las fuentes ni el diseño. El segundo intento completó
compilación, TypeScript, generación de páginas y publicación.

## Configuración independiente

Variables privadas del servidor para las señales:

```dotenv
ALGOTREND_TELEGRAM_BOT_TOKEN=
ALGOTREND_TELEGRAM_CHAT_ID=
# Opcional: tema exclusivo de un supergrupo con foro habilitado.
ALGOTREND_TELEGRAM_THREAD_ID=
```

`TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` quedan para avisos de infraestructura.
Las señales no usan esas credenciales como alternativa. Usar un bot dedicado a
AlgoTrend para separar su identidad y permisos de los de PilotControl.
No registrar ni sustituir el webhook de otro bot, ni consumir sus actualizaciones.
Los endpoints antiguos `/api/telegram/setup` y `/api/telegram/notify` no configuran
estas variables ni activan las señales; no pasar tokens por query strings.

Antes de activar: identificar el bot con `getMe`, comprobar su webhook con
`getWebhookInfo`, confirmar el destino con el usuario y comprobar sus permisos.
Para chat privado, el usuario debe haber iniciado la conversación con el bot.
Para canal, el bot necesita permiso de publicación; para un tema, confirmar
también su identificador. Nunca elegir destinatarios de PilotControl por defecto.

## Avisos

Cada entrada o salida incluye un mensaje HTML con GONOVI / AlgoTrend, identidad
DEMO BTC/USD 1H, dirección, ID, fecha UTC y precios. La salida muestra el motivo y
el porcentaje cerrado. Se avisan también los cierres por señal contraria del cron.
El webhook TradingView conserva su interruptor actual: no se habilita al activar
Telegram.

En ese mismo mensaje se incluyen hasta las cinco operaciones más recientes de
`algotrend_trades`, ordenadas por apertura y luego ID. El evento confirmado
reemplaza una versión anterior de la misma operación para evitar datos obsoletos.
No se agregan operaciones para completar cinco si no hay suficientes.

Las cerradas usan su `pnl_pct` guardado. Las abiertas usan el precio y la hora del
evento como referencia, con signo invertido para SHORT. Es una foto al emitir la
alerta: los mensajes anteriores no se actualizan ni constituyen un ticker vivo.
No se inventa un capital ni se presenta la demo como resultado de una cuenta real.

La consulta del historial se cancela a los 2 segundos; si falla se envía el evento
con «Historial temporalmente no disponible». Telegram tiene un plazo de 3 segundos.
Se comprueba tanto HTTP como `ok` de la API y se registra el estado sin credenciales.
Un envío ambiguo no se reintenta automáticamente para evitar mensajes duplicados.
No hay bandeja persistente de entregas: un fallo de envío requiere revisión y no
se considera entrega confirmada.

## Verificación y entrega

Pruebas: `npm run test:engine` (30 pasan), `npm run typecheck` y `npm run lint`
(sin errores; advertencia previa en `scratch/history_query.ts`). Las pruebas
nuevas de Telegram fallaron antes de implementar y pasan después. Se verificó
la lectura del historial real y la entrega del resumen inicial; no se fabricaron
operaciones ni se ejecutó el cron manualmente para probar una señal.

Después de confirmar bot/destino y guardar las variables privadas en el entorno
correcto, usar el protocolo de despliegue del proyecto (`npm run deploy:prod`)
y comprobar los aliases y una entrega real. No declarar activación con pruebas
simuladas ni con un deployment preview.

Referencias: [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage),
[cancelación de consultas Supabase](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal).
