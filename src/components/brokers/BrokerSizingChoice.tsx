'use client'

import type { SizingChoice } from '@/lib/brokers/sizing'
import { BrokerFieldLabel } from './BrokerFieldHelp'
import styles from './brokers.module.css'

const CHOICES: { value: SizingChoice; title: string; detail: string }[] = [
  { value: 'FULL_BALANCE', title: 'Todo el saldo disponible', detail: 'Cada entrada usa lo que tengas libre en Futuros, descontada la comisión.' },
  { value: 'FIXED', title: 'Monto fijo', detail: 'Siempre el mismo importe en USD. Si no alcanza el saldo, no abre.' },
  { value: 'PERCENT', title: 'Porcentaje del saldo', detail: 'Una parte del saldo, que crece o baja con tus resultados.' },
]

export function SizingChoiceField({ name, value, onChange }: { name: string; value: SizingChoice; onChange: (value: SizingChoice) => void }) {
  return (
    <fieldset className={styles.fullWidth} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={{ padding: 0, marginBottom: 7 }}>
        <BrokerFieldLabel label="Tamaño de cada operación" tooltip="Cuánto usa el bot en cada apertura. Nunca transfiere fondos: opera con el saldo de Futuros de esta API." example="Si la cuenta es sólo para esta estrategia, elegí Todo el saldo." />
      </legend>
      <div className={styles.sizingChoices} role="radiogroup">
        {CHOICES.map((choice) => (
          <label className={styles.sizingChoice} key={choice.value}>
            <input type="radio" name={name} value={choice.value} checked={value === choice.value} onChange={() => onChange(choice.value)} />
            <strong>{choice.title}</strong>
            <span>{choice.detail}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function sizingSummary(choice: SizingChoice, amount: { percent?: number; fixedUsd?: number }, leverage: number) {
  const lev = `${Math.max(1, leverage)}x`
  if (choice === 'FULL_BALANCE') return `Todo el saldo · ${lev}`
  if (choice === 'PERCENT') return `${amount.percent ?? 0}% del saldo · ${lev}`
  return `$${(amount.fixedUsd ?? 0).toFixed(2)} fijo · ${lev}`
}
