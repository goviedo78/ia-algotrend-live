import Image from 'next/image'
import Link from 'next/link'
import styles from './brokers.module.css'

export function BrokerBrand() {
  return (
    <Link className={styles.brand} href="/" aria-label="GONOVI, ir al inicio">
      <Image
        className={styles.brandMark}
        src="/gonovi-logo-official.png"
        alt=""
        width={30}
        height={30}
        loading="eager"
        fetchPriority="high"
        unoptimized
      />
      <span className={styles.brandLockup}>
        <strong>GONOVI</strong>
        <span>Broker Control</span>
      </span>
    </Link>
  )
}
