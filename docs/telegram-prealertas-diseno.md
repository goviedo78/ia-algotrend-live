# Diseño de avisos de trigger y condiciones favorables · 28-10-2026

Estado: publicado y verificado en producción el 28-10-2026.
Deployment: `dpl_CTuBxeZzUvyLYfkjvQPcSKejy2e8`.
Cron existente 7501566 activo con la revisión adicional del minuto 57.
Los avisos usan PNG y texto con la paleta GONOVI. Se mantiene entrada y cierre.
La prealerta actual se emite solo si el motor completo produce una señal
provisional sobre la vela abierta, en los últimos cinco minutos, y respeta ATR,
posición abierta, frescura y continuidad de velas. No calcula ni publica precios
hipotéticos de confirmación: el análisis de rangos descrito abajo queda como
extensión futura. La ejecución real sigue usando exclusivamente velas cerradas.

El aviso de trigger confirma una transición persistida a trailing mientras
la operación sigue abierta, una vez por operación. Si el mismo procesamiento
cierra o revierte, se omite el intermedio y se explica en el cierre.
Los dos nuevos avisos tienen reserva atómica en `algotrend_telegram_notices`,
tabla con RLS y acceso solo service_role, ajena al historial de operaciones.
Un timeout ambiguo o una reserva abandonada no se reenvían automáticamente.
El ledger evita duplicados, sin prometer entrega ante caídas de red/proceso.

## Qué confirma una entrada

El cron excluye la vela abierta. Al cerrar esa vela, runAlgoTrend calcula
SuperTrend y KNN con su cierre, máximo, mínimo y los datos históricos. La vela
anterior aporta estado y referencia para cruces; no determina sola la entrada.

Un cruce KNN usa probabilidad actual > 0.85 y anterior <= 0.85. lastDir conserva
la última dirección de esos cruces. Cuando cambia SuperTrend o hay un cruce KNN,
lastStDir se actualiza si SuperTrend, lastDir y KNN > 0.85 coinciden. La señal
nueva es el cruce de lastStDir sobre/bajo cero. Por ello, no toda probabilidad
alta ni toda coincidencia de condiciones produce una entrada nueva.

Después se aplican elegibilidad operativa, duplicación por signal_time y el
filtro ATR si está habilitado. El umbral ATR es configurable. Una prealerta debe
respetar los mismos valores efectivos, sin incorporar órdenes ni escrituras
en el historial de operaciones.

## Seis familias de situaciones, simétricas para compra y venta

| Familia | Situación | Aviso propuesto |
| --- | --- | --- |
| Sin preparación | Datos insuficientes o condiciones sin candidato | Silencio |
| Tendencia preparada | SuperTrend a favor; falta KNN/estado de cruce | Solo observación interna; no inventar un precio suficiente |
| KNN preparado | KNN/estado a favor; falta SuperTrend | Prealerta solo si el motor completo valida escenarios de cierre |
| Señal provisional | La vela abierta, tomada como cierre hipotético, produce una señal nueva | Condiciones favorables; falta cierre definitivo |
| Coincidencia ya vigente | Condiciones a favor pero no hay transición nueva | Silencio: no anunciar otra entrada |
| Bloqueada | Candidato rechazado por filtro ATR o elegibilidad | No anunciar una apertura esperada |

No son seis patrones únicos de mercado: son familias de decisión. Cada una
puede darse para compra o venta. Una posición contraria abierta añade contexto
de posible reversión, sin convertirlo en otra señal ni enviar otra prealerta.

## Cuándo se puede mencionar un precio

La regla «cierra por encima de X => compra» no es generalmente válida. Cambiar
el cierre cambia RSI, variables PCA/KNN y posiblemente SuperTrend; cambiar el
máximo o mínimo también cambia ATR y bandas. Las condiciones pueden no ser
monótonas en el precio. El SuperTrend visible no es por sí solo un umbral de
entrada de todo el indicador.

Para mostrar X o un rango hay que ejecutar el MISMO motor con escenarios de
cierre de la vela actual y conservar OHLC válido (high >= max(open, close),
low <= min(open, close)). Examinar ambos lados, posibles intervalos separados
y pérdida de condiciones. El resultado debe describirse como escenario con
máximo/mínimo observados hasta ese momento, nunca como condición suficiente
inmutable. Si no se valida un nivel claro, el texto no muestra X.

Ejemplo sin precio inventado:

CONDICIONES FAVORABLES · 🟢 COMPRA
BTC · 1H
Probabilidad de señal: [valor real]%
Cierre de vela: [fecha y hora real] · CDMX
Señal sin confirmar.

Si corresponde, se añade «Posible giro de VENTA a COMPRA» o su inverso.
La imagen y el caption usan este formato breve desde el 28-10-2026.

Solo cuando haya escenarios validados:
«Si la vela cierra en [rango calculado] y se mantienen las demás condiciones,
podría confirmarse una compra. El rango puede cambiar antes del cierre».

## Aviso de trigger

El motor activa trailing con recorrido favorable >= 1% si antes no se tocó
SL/TP, según su regla de recorrido OHLC. El stop pasa a seguir al extremo a
0.3% y se elimina el TP fijo. Un mero toque del precio no sustituye esa regla.

Avisar una sola vez por operación al confirmar la transición desde TP fijo
a stop móvil, después de persistirla. No avisar por cada movimiento posterior
del stop. Si activa y cierra en el mismo procesamiento, incluir la mención en
el cierre y omitir un aviso intermedio de una operación que ya terminó.

Texto propuesto:
TRIGGER ACTIVADO · [COMPRA / VENTA]
BTC · 1H
Entrada: [precio real]
Stop móvil: [stop persistido]
La operación sigue abierta; el TP fijo deja de aplicarse.
Confirmado en vela cerrada: [fecha/hora CDMX].

No denominar beneficio garantizado al nivel del stop.

## Frecuencia, aislamiento y duplicación

El cron principal actual corre en minutos 2, 7, 17, 32 y 47: no observa cada
segundo. La última revisión previa al cierre está a 13 minutos. Se agrega el minuto 57 al mismo programador existente. El cron mantiene
su gestión de velas cerradas y registra una tarea posterior de solo lectura
para las prealertas; no se habilita trading con velas abiertas.

Persistir una reserva única por operación/activación para trigger, y por vela
para prealerta (una como máximo, no una por cada cambio de dirección). No usar
memoria del proceso serverless. Distinguir reserva, envío confirmado, rechazo
y resultado ambiguo: no reenviar automáticamente tras timeout desconocido.

Las prealertas no abren, cierran, modifican operaciones ni generan órdenes.
La confirmación sigue usando exclusivamente velas cerradas. Sin datos frescos
no se emite un aviso. No mandar anulaciones repetidas si desaparece el candidato;
el texto inicial debe expresar su carácter provisional y su vela de validez.

## Validación previa a activar

- Compras y ventas; vela abierta provisional que confirma o desaparece.
- SuperTrend solo, KNN solo, coincidencia sin transición y ATR bloqueante.
- Comparación contra el resultado real del mismo motor al cerrar cada vela.
- Escenarios de cierre con intervalos separados o sin umbral suficiente.
- Reversión con posición contraria y señales repetidas en la misma vela.
- Trigger largo/corto, activación y cierre en la misma vela o hueco del cron.
- Corridas concurrentes, reinicios, timeout ambiguo y ausencia de duplicados.
- Solo lectura en operaciones/brokers para prealertas; cero filas de prueba.

El rendimiento de las prealertas debe medirse como confirmadas/no confirmadas,
separado de la tasa de aciertos de operaciones cerradas.
