import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { riskChangeSchema } from '../../src/lib/brokers/schemas'
import { requiredMaxExposureUsd, withCoherentExposure } from '../../src/lib/brokers/risk-draft'

const root = path.resolve(import.meta.dirname, '../..')
const base = { capitalUsd: 100, riskProfile: 'CONSERVATIVE' as const, sizingMode: 'FIXED_NOTIONAL' as const, allocationPct: 90 }

test('the holder can set every risk parameter, not only capital and lot size', () => {
  const parsed = riskChangeSchema.safeParse({
    ...base,
    fixedNotionalUsd: 90,
    dailyLossLimitUsd: 40,
    maxTotalExposureUsd: 180,
    minAvailableMarginUsd: 0,
    maxOpenPositions: 3,
    maxOrdersPerMinute: 6,
    maxLeverage: 2,
  })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data?.maxOpenPositions, 3)
  assert.equal(parsed.data?.maxOrdersPerMinute, 6)
  assert.equal(parsed.data?.maxLeverage, 2)
  assert.equal(parsed.data?.minAvailableMarginUsd, 0)
})

test('omitting a parameter is allowed: the route keeps whatever the connection already had', () => {
  const parsed = riskChangeSchema.safeParse({ ...base, fixedNotionalUsd: 25 })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data?.maxOpenPositions, undefined)
  assert.equal(parsed.data?.maxLeverage, undefined)
})

test('values the engine or the database could not honour are refused at the edge', () => {
  // max_open_positions < 1 apagaría el motor con RISK_LIMITS_NOT_CONFIGURED.
  assert.equal(riskChangeSchema.safeParse({ ...base, maxOpenPositions: 0 }).success, false)
  assert.equal(riskChangeSchema.safeParse({ ...base, maxOrdersPerMinute: 0 }).success, false)
  assert.equal(riskChangeSchema.safeParse({ ...base, maxLeverage: 0.5 }).success, false)
  // Rangos que la RPC rechaza igual: mejor un 400 con mensaje que un 409 genérico.
  assert.equal(riskChangeSchema.safeParse({ ...base, maxOpenPositions: 21 }).success, false)
  assert.equal(riskChangeSchema.safeParse({ ...base, maxOrdersPerMinute: 61 }).success, false)
  assert.equal(riskChangeSchema.safeParse({ ...base, maxLeverage: 21 }).success, false)
  // Una reserva de margen en 0 es legítima: significa "usá todo el margen disponible".
  assert.equal(riskChangeSchema.safeParse({ ...base, minAvailableMarginUsd: 0 }).success, true)
  assert.equal(riskChangeSchema.safeParse({ ...base, minAvailableMarginUsd: -1 }).success, false)
  assert.equal(riskChangeSchema.safeParse({ ...base, marginReservePct: 10 }).success, true)
  assert.equal(riskChangeSchema.safeParse({ ...base, marginReservePct: 10.1 }).success, false)
  // Campos desconocidos siguen rechazados.
  assert.equal(riskChangeSchema.safeParse({ ...base, loQueSea: 1 }).success, false)
})

test('the route forwards the new parameters and falls back to the stored policy', async () => {
  const route = await readFile(path.join(root, 'src/app/api/broker-connections/[id]/risk/route.ts'), 'utf8')

  assert.match(route, /proposal_max_open_positions: maxOpenPositions/)
  assert.match(route, /proposal_max_orders_per_minute: maxOrdersPerMinute/)
  assert.match(route, /proposal_max_leverage: maxLeverage/)
  // Omitir un campo conserva el valor guardado, no lo resetea a un default.
  assert.match(route, /const maxOpenPositions = parsed\.data\.maxOpenPositions \?\? Math\.max\(1, currentPolicy\.maxOpenPositions\)/)
  assert.match(route, /const maxLeverage = parsed\.data\.maxLeverage \?\? Math\.max\(1, currentPolicy\.maxLeverage\)/)
  assert.match(route, /select\('max_open_positions, max_orders_per_minute, max_leverage, margin_reserve_pct'\)/)
  // La exposición y la reserva ahora son del titular, con el derivado sólo como respaldo.
  assert.match(route, /const maxTotalExposureUsd = parsed\.data\.maxTotalExposureUsd\s*\?\?/)
  assert.match(route, /const minAvailableMarginUsd = parsed\.data\.minAvailableMarginUsd\s*\?\?/)
  // El tope global de apalancamiento es config del dueño, no un criterio inventado.
  assert.match(route, /BROKER_MAX_ALLOWED_LEVERAGE/)
  assert.match(route, /LEVERAGE_ABOVE_PLATFORM_LIMIT/)
  // Todo queda auditado.
  assert.match(route, /maxOpenPositions, maxOrdersPerMinute, maxLeverage \} \}\)/)
})

test('the database accepts and persists the three parameters that used to be admin-only', async () => {
  const migration = await readFile(
    path.join(root, 'supabase/migrations/20260805090000_self_service_full_risk_parameters.sql'),
    'utf8',
  )

  // La firma cambió: hay que soltar la anterior o la llamada queda ambigua por sobrecarga.
  assert.match(migration, /drop function if exists public\.request_broker_risk_change\(/i)
  assert.match(migration, /proposal_max_open_positions integer/i)
  assert.match(migration, /proposal_max_orders_per_minute integer/i)
  assert.match(migration, /proposal_max_leverage numeric/i)
  // Y de verdad se escriben en la política de una conexión ya aprobada.
  assert.match(migration, /max_open_positions = proposal_max_open_positions/i)
  assert.match(migration, /max_orders_per_minute = proposal_max_orders_per_minute/i)
  assert.match(migration, /max_leverage = proposal_max_leverage/i)
  // Sigue siendo service-only.
  assert.match(migration, /grant execute on function public\.request_broker_risk_change[\s\S]*to service_role/i)
  assert.match(migration, /revoke all on function public\.request_broker_risk_change[\s\S]*from public, anon, authenticated/i)
})

test('the panel exposes every parameter and warns before an unusable combination', async () => {
  const [panel, history] = await Promise.all([
    readFile(path.join(root, 'src/components/brokers/BrokerConnectionsPanel.tsx'), 'utf8'),
    readFile(path.join(root, 'src/components/brokers/BrokerOrderHistory.tsx'), 'utf8'),
  ])

  assert.match(panel, /Exposición total máxima \(USD\)/)
  assert.match(panel, /Reserva de margen \(%\)/)
  assert.match(panel, /Posiciones simultáneas/)
  assert.match(panel, /Órdenes por minuto/)
  assert.match(panel, /label="Apalancamiento"/)
  // El resumen muestra lo que el titular puso, no un derivado del perfil.
  assert.match(panel, /const effectiveMaxExposureUsd = riskEdit\.maxTotalExposureUsd/)
  assert.match(panel, /const effectiveMarginUsd = Math\.floor\(riskEdit\.capitalUsd \* riskEdit\.marginReservePct\) \/ 100/)
  // Exposición por debajo del lotaje: se avisa y se bloquea el submit antes del 400.
  assert.match(panel, /const exposicionInsuficiente = effectiveMaxExposureUsd < effectiveNotionalUsd/)
  assert.match(panel, /disabled=\{submitting \|\| riskEdit\.capitalUsd < 100 \|\| exposicionInsuficiente\}/)
  // El umbral visible y el motor comparten el cálculo que incluye comisión y redondea hacia arriba.
  assert.match(panel, /calculateOpeningFundingRequirement/)
  assert.match(panel, /requiredAvailableMarginUsd/)
  assert.match(panel, /requiredCapitalBox/)
  // Las operaciones fallidas son contexto secundario: aparecen después de la tabla del historial.
  assert.ok(history.indexOf('className={styles.orderTable}') < history.indexOf('Operaciones que no se ejecutaron'))
})

const draft = {
  capitalUsd: 490,
  riskProfile: 'CONSERVATIVE' as const,
  allocationPct: 90,
  compoundEnabled: false,
  fixedNotionalUsd: 450,
  maxOpenPositions: 1,
  maxTotalExposureUsd: 90,
}

test('subir el lotaje arrastra la exposición total escondida en los avanzados', () => {
  // El caso real: capital 100 / lotaje 90 guardados, el titular sube el lotaje a 450 y la
  // exposición quedaba en 90, bloqueando "Guardar cambios" por un campo plegado.
  assert.equal(requiredMaxExposureUsd(draft), 450)
  assert.equal(withCoherentExposure(draft).maxTotalExposureUsd, 450)

  // Con varias posiciones simultáneas la exposición cubre una orden por cada una.
  assert.equal(withCoherentExposure({ ...draft, maxOpenPositions: 3 }).maxTotalExposureUsd, 1350)

  // Con interés compuesto manda el porcentaje del equity, no el monto fijo.
  assert.equal(withCoherentExposure({ ...draft, compoundEnabled: true }).maxTotalExposureUsd, 441)
})

test('la exposición que el titular subió a mano nunca se recorta', () => {
  const holgada = { ...draft, maxTotalExposureUsd: 5_000 }
  assert.equal(withCoherentExposure(holgada), holgada)
  assert.equal(withCoherentExposure({ ...draft, fixedNotionalUsd: 10 }).maxTotalExposureUsd, 90)
})

test('la exposición ajustada nunca queda por debajo de lo que exige el servidor', () => {
  const ajustada = withCoherentExposure({ ...draft, fixedNotionalUsd: 33.335, maxTotalExposureUsd: 10 })
  assert.ok(ajustada.maxTotalExposureUsd >= 33.335)
  assert.equal(ajustada.maxTotalExposureUsd, 33.34)
  // Un lotaje todavía sin cargar no inventa exposición.
  assert.equal(withCoherentExposure({ ...draft, fixedNotionalUsd: 0 }).maxTotalExposureUsd, 90)
})

test('el panel acompaña la exposición en vez de dejar el guardado trabado', async () => {
  const panel = await readFile(path.join(root, 'src/components/brokers/BrokerConnectionsPanel.tsx'), 'utf8')
  // Cada campo que mueve el lotaje efectivo recalcula la exposición coherente.
  for (const field of ['capitalUsd', 'fixedNotionalUsd', 'compoundEnabled', 'riskProfile', 'allocationPct', 'maxOpenPositions']) {
    assert.match(panel, new RegExp(`withCoherentExposure\\(\\{ \\.\\.\\.current, ${field}:`))
  }
  // Abrir el editor con una política vieja tampoco puede arrancar bloqueado.
  assert.match(panel, /setRiskEdit\(withCoherentExposure\(\{/)
  // El aviso que queda es el del servidor y trae el arreglo en un clic.
  assert.match(panel, /Ajustar a \{exposicionRequeridaUsd\.toFixed\(2\)\} USD/)
  // El titular ve el saldo real del broker contra el mínimo estricto.
  assert.match(panel, /const availableMarginUsd = fundingRequirements\[connection\.id\]\?\.availableMarginUsd/)
  assert.match(panel, /margenFaltanteUsd > 0/)
})
