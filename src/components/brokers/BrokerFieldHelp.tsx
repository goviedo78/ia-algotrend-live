import { CircleHelp } from 'lucide-react'
import styles from './brokers.module.css'

export function BrokerFieldLabel({
  label,
  tooltip,
  example,
}: {
  label: string
  tooltip: string
  example?: string
}) {
  return (
    <>
      <span className={styles.fieldLabel}>
        {label}
        <span className={styles.tooltipWrap}>
          <span className={styles.tooltipButton} tabIndex={0} aria-label={`Ayuda sobre ${label}`}>
            <CircleHelp size={14} />
          </span>
          <span className={styles.tooltip} role="tooltip">{tooltip}</span>
        </span>
      </span>
      {example && <small className={styles.fieldExample}>{example}</small>}
    </>
  )
}
