import Image from 'next/image'
import { HEADER, LINKS, ECOSYSTEM_LABEL, COPYRIGHT, SPONSOR } from './linksData'
import { LinkIcon } from './LinkIcon'
import styles from './LinksPage.module.css'

export function LinksPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.logoWrap}>
            <Image
              src="/logo-gon.svg"
              alt="GONOVI"
              width={64}
              height={64}
              className={styles.logo}
              priority
            />
          </div>
          <h1 className={styles.brand}>{HEADER.brand}</h1>
          <p className={styles.subtitle}>{HEADER.subtitle}</p>
        </header>

        <aside className={styles.sponsorBanner} aria-label="Información para patrocinadores">
          <p className={styles.sponsorPitch}>{SPONSOR.pitch}</p>
          <p className={styles.sponsorDesc}>{SPONSOR.description}</p>
          <a className={styles.sponsorCta} href={SPONSOR.ctaHref}>
            {SPONSOR.ctaText}
          </a>
        </aside>

        <ul className={styles.list}>
          {LINKS.map((link) => {
            const isExternal = link.external !== false && /^https?:\/\//.test(link.href)
            return (
              <li key={link.title} className={styles.linkItem}>
                <a
                  href={link.href}
                  className={styles.linkBtn}
                  {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
                  aria-label={link.badge ? `${link.title} (${link.badge})` : link.title}
                >
                  {link.icon && (
                    <span className={styles.linkIcon}>
                      <LinkIcon name={link.icon} />
                    </span>
                  )}
                  <span className={styles.linkTitle}>{link.title}</span>
                  {link.badge && <span className={styles.badge}>{link.badge}</span>}
                </a>
              </li>
            )
          })}
        </ul>

        <p className={styles.ecosystem}>{ECOSYSTEM_LABEL}</p>
        <p className={styles.footer}>{COPYRIGHT}</p>
      </div>
    </main>
  )
}
