'use client'

import { useMemo, useSyncExternalStore } from 'react'
import allScenarios from '@/data/official/trading-lab-scenarios'
import s from './analytics-dashboard.module.css'

const STORAGE_KEY = 'gonovi_scenario_counts'

type ScenarioCounts = Record<string, number>

function readScenarioCounts(): ScenarioCounts {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .map(([id, value]) => [id, value as number])
    )
  } catch {
    return {}
  }
}

function getSnapshot() {
  return JSON.stringify(readScenarioCounts())
}

function getServerSnapshot() {
  return '{}'
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('gonovi_scenario_counts_updated', onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('gonovi_scenario_counts_updated', onStoreChange)
  }
}

export function ScenarioCountsTable() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const counts = useMemo(() => JSON.parse(snapshot) as ScenarioCounts, [snapshot])

  const rows = useMemo(() => {
    const titles = new Map(allScenarios.map((scenario) => [scenario.id, scenario.title]))

    return Object.entries(counts)
      .map(([id, count]) => ({
        count,
        id,
        title: titles.get(id) ?? 'Escenario no encontrado en data actual',
      }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  }, [counts])

  return (
    <div className={`${s.tableCard} ${s.fullWidthCard}`}>
      <div className={s.tableHeaderRow}>
        <div>
          <h2 className={s.sectionTitle}>Apariciones Trading Lab</h2>
          <p className={s.sectionSub}>
            Lectura local del navegador admin usando <code>{STORAGE_KEY}</code>.
          </p>
        </div>
        <button
          type="button"
          className={s.refreshButton}
          onClick={() => window.dispatchEvent(new Event('gonovi_scenario_counts_updated'))}
        >
          Actualizar
        </button>
      </div>

      {rows.length > 0 ? (
        <table className={s.table}>
          <thead>
            <tr>
              <th>ID escenario</th>
              <th>Título</th>
              <th className={s.tdRight}>Apariciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><code>{row.id}</code></td>
                <td>{row.title}</td>
                <td className={s.tdRight}>{row.count.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={s.emptyNote}>
          Todavía no hay apariciones registradas en este navegador. Abrí el Trading Lab y avanzá escenarios para empezar a medir la aleatoriedad local.
        </p>
      )}
    </div>
  )
}
