'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { LinkIcon, type IconName } from '@/components/links/LinkIcon'
import { saveConfigAction } from '@/app/official/links/actions'
import type { LinksConfig } from '@/lib/links-config'
import styles from './LinksAdmin.module.css'

type LinkRow = LinksConfig['links'][number]

const ICON_OPTIONS: IconName[] = [
  'chart', 'chart-pro', 'bot', 'layers',
  'youtube', 'play', 'mail', 'whatsapp',
  'grid', 'instagram', 'tiktok', 'globe',
]

const COLOR_PRESETS = [
  { hex: '#F44E1C', name: 'Pulse' },
  { hex: '#C9A87A', name: 'Bronze' },
  { hex: '#FF0000', name: 'YouTube' },
  { hex: '#25D366', name: 'WhatsApp' },
  { hex: '#E1306C', name: 'Instagram' },
  { hex: '#00f2fe', name: 'TikTok' },
  { hex: '#4FBC72', name: 'Green' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#A8AABA', name: 'Muted' },
]

interface Props {
  pin: string
  initialConfig: LinksConfig
}

export function LinksAdmin({ pin, initialConfig }: Props) {
  const [config, setConfig] = useState<LinksConfig>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [previewBust, setPreviewBust] = useState(0)
  const dragIndexRef = useRef<number | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig),
    [config, initialConfig]
  )

  // Si el usuario cierra/recarga con cambios sin guardar
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function updateLink(index: number, patch: Partial<LinkRow>) {
    setConfig((prev) => ({
      ...prev,
      links: prev.links.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }))
  }

  function addLink() {
    setConfig((prev) => ({
      ...prev,
      links: [
        ...prev.links,
        { title: 'Nuevo link', href: '#', external: true, icon: 'globe', hidden: false },
      ],
    }))
  }

  function deleteLink(index: number) {
    if (!confirm(`¿Borrar "${config.links[index].title}"?`)) return
    setConfig((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }))
  }

  function moveLink(from: number, to: number) {
    if (from === to) return
    setConfig((prev) => {
      const list = [...prev.links]
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return { ...prev, links: list }
    })
  }

  function onDragStart(index: number) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      dragIndexRef.current = index
      e.dataTransfer.effectAllowed = 'move'
    }
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function onDrop(index: number) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const from = dragIndexRef.current
      dragIndexRef.current = null
      if (from === null) return
      moveLink(from, index)
    }
  }

  function handleSave() {
    setSaveStatus('idle')
    setErrorMsg(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('pin', pin)
      fd.append('config', JSON.stringify(config))
      const res = await saveConfigAction(fd)
      if (res?.ok) {
        setSaveStatus('saved')
        setPreviewBust((n) => n + 1)
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
        setErrorMsg(res?.error ?? 'Error desconocido')
      }
    })
  }

  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>
        <div>
          <h1 className={styles.title}>Editor de /links</h1>
          <p className={styles.subtitle}>
            Cambios en vivo: tocá Guardar y se ven en <code>gonovi.app/links</code> al refrescar.
          </p>
        </div>
        <button
          type="button"
          className={`${styles.saveBtn} ${isDirty ? styles.saveBtnDirty : ''}`}
          onClick={handleSave}
          disabled={!isDirty || isPending}
        >
          {isPending ? 'Guardando…' : isDirty ? 'Guardar cambios' : saveStatus === 'saved' ? '✓ Guardado' : 'Sin cambios'}
        </button>
      </header>

      {saveStatus === 'error' && (
        <div className={styles.errorBanner}>Error: {errorMsg}</div>
      )}

      <div className={styles.split}>
        <section className={styles.editorPanel}>
          {/* HEADER */}
          <details className={styles.group} open>
            <summary className={styles.groupSummary}>Header</summary>
            <div className={styles.groupBody}>
              <Field label="Marca (brand)">
                <input
                  className={styles.input}
                  type="text"
                  value={config.header.brand}
                  maxLength={80}
                  onChange={(e) =>
                    setConfig({ ...config, header: { ...config.header, brand: e.target.value } })
                  }
                />
              </Field>
              <Field label="Subtítulo">
                <textarea
                  className={styles.textarea}
                  value={config.header.subtitle}
                  maxLength={280}
                  onChange={(e) =>
                    setConfig({ ...config, header: { ...config.header, subtitle: e.target.value } })
                  }
                  rows={2}
                />
              </Field>
            </div>
          </details>

          {/* SPONSOR */}
          <details className={styles.group}>
            <summary className={styles.groupSummary}>Banner Sponsor</summary>
            <div className={styles.groupBody}>
              <Field label="Pitch (título)">
                <input
                  className={styles.input}
                  type="text"
                  value={config.sponsor.pitch}
                  maxLength={160}
                  onChange={(e) =>
                    setConfig({ ...config, sponsor: { ...config.sponsor, pitch: e.target.value } })
                  }
                />
              </Field>
              <Field label="Descripción">
                <textarea
                  className={styles.textarea}
                  value={config.sponsor.description}
                  maxLength={320}
                  onChange={(e) =>
                    setConfig({ ...config, sponsor: { ...config.sponsor, description: e.target.value } })
                  }
                  rows={3}
                />
              </Field>
              <Field label="Texto del CTA">
                <input
                  className={styles.input}
                  type="text"
                  value={config.sponsor.ctaText}
                  maxLength={80}
                  onChange={(e) =>
                    setConfig({ ...config, sponsor: { ...config.sponsor, ctaText: e.target.value } })
                  }
                />
              </Field>
              <Field label="Link del CTA (mailto:, https://, wa.me/, /ruta)">
                <input
                  className={styles.input}
                  type="text"
                  value={config.sponsor.ctaHref}
                  maxLength={500}
                  onChange={(e) =>
                    setConfig({ ...config, sponsor: { ...config.sponsor, ctaHref: e.target.value } })
                  }
                />
              </Field>
            </div>
          </details>

          {/* LINKS */}
          <details className={styles.group} open>
            <summary className={styles.groupSummary}>
              Links ({config.links.length})
            </summary>
            <div className={styles.groupBody}>
              {config.links.map((link, index) => (
                <div
                  key={index}
                  className={`${styles.linkCard} ${link.hidden ? styles.linkCardHidden : ''}`}
                  draggable
                  onDragStart={onDragStart(index)}
                  onDragOver={onDragOver}
                  onDrop={onDrop(index)}
                >
                  <div className={styles.linkCardHeader}>
                    <span className={styles.dragHandle} title="Arrastrá para reordenar">≡</span>
                    <span className={styles.linkCardIndex}>#{index + 1}</span>
                    <button
                      type="button"
                      className={styles.toggleBtn}
                      onClick={() => updateLink(index, { hidden: !link.hidden })}
                    >
                      {link.hidden ? '👁‍🗨 Oculto' : '👁 Visible'}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => deleteLink(index)}
                      aria-label={`Borrar ${link.title}`}
                    >
                      Borrar
                    </button>
                  </div>

                  <Field label="Título">
                    <input
                      className={styles.input}
                      type="text"
                      value={link.title}
                      maxLength={120}
                      onChange={(e) => updateLink(index, { title: e.target.value })}
                    />
                  </Field>

                  <Field label="URL (https://..., mailto:, wa.me/, /ruta)">
                    <input
                      className={styles.input}
                      type="text"
                      value={link.href}
                      maxLength={500}
                      onChange={(e) => updateLink(index, { href: e.target.value })}
                    />
                  </Field>

                  <div className={styles.row}>
                    <Field label="Icono">
                      <select
                        className={styles.input}
                        value={link.icon ?? ''}
                        onChange={(e) =>
                          updateLink(index, { icon: (e.target.value || undefined) as IconName | undefined })
                        }
                      >
                        <option value="">(sin icono)</option>
                        {ICON_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      {link.icon && (
                        <span className={styles.iconPreview} style={{ color: link.color ?? 'var(--ink-muted)' }}>
                          <LinkIcon name={link.icon} />
                        </span>
                      )}
                    </Field>
                    <Field label="Color (icono)">
                      <div className={styles.colorRow}>
                        <input
                          className={styles.colorPicker}
                          type="color"
                          value={link.color ?? '#A8AABA'}
                          onChange={(e) => updateLink(index, { color: e.target.value })}
                        />
                        <input
                          className={styles.input}
                          type="text"
                          value={link.color ?? ''}
                          placeholder="#A8AABA"
                          maxLength={9}
                          onChange={(e) => updateLink(index, { color: e.target.value || undefined })}
                        />
                      </div>
                      <div className={styles.presetRow}>
                        {COLOR_PRESETS.map((p) => (
                          <button
                            key={p.hex}
                            type="button"
                            className={styles.presetChip}
                            style={{ background: p.hex }}
                            title={p.name}
                            onClick={() => updateLink(index, { color: p.hex })}
                            aria-label={`Color ${p.name}`}
                          />
                        ))}
                      </div>
                    </Field>
                  </div>

                  <Field label="Badge (opcional, ej: PRO)">
                    <input
                      className={styles.input}
                      type="text"
                      value={link.badge ?? ''}
                      maxLength={24}
                      onChange={(e) => updateLink(index, { badge: e.target.value || undefined })}
                    />
                  </Field>
                </div>
              ))}

              <button type="button" className={styles.addBtn} onClick={addLink}>
                + Agregar link
              </button>
            </div>
          </details>

          {/* FOOTER (ecosystem + copyright) */}
          <details className={styles.group}>
            <summary className={styles.groupSummary}>Footer</summary>
            <div className={styles.groupBody}>
              <Field label="Ecosystem (texto del separador con · medio)">
                <input
                  className={styles.input}
                  type="text"
                  value={config.ecosystemLabel}
                  maxLength={200}
                  onChange={(e) => setConfig({ ...config, ecosystemLabel: e.target.value })}
                />
              </Field>
              <Field label="Copyright">
                <input
                  className={styles.input}
                  type="text"
                  value={config.copyright}
                  maxLength={80}
                  onChange={(e) => setConfig({ ...config, copyright: e.target.value })}
                />
              </Field>
            </div>
          </details>
        </section>

        <section className={styles.previewPanel}>
          <div className={styles.previewLabel}>
            <span>Preview</span>
            <button
              type="button"
              className={styles.previewRefreshBtn}
              onClick={() => setPreviewBust((n) => n + 1)}
              title="Refrescar preview"
            >
              ↻
            </button>
          </div>
          <iframe
            key={previewBust}
            src={`/links?preview=${previewBust}`}
            className={styles.previewFrame}
            title="Preview /links"
          />
          <p className={styles.previewHint}>
            El preview muestra lo guardado. Tocá <strong>Guardar cambios</strong> para verlo actualizado.
          </p>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}
