'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { LinkIcon, type IconName } from '@/components/links/LinkIcon'
import { IconDisplay } from '@/components/links/IconDisplay'
import { saveConfigAction } from '@/app/official/links/actions'
import type { LinksConfig, CustomIcon } from '@/lib/links-config'
import styles from './LinksAdmin.module.css'

type LinkRow = LinksConfig['links'][number]

const BUILT_IN_ICONS: IconName[] = [
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
  const dragIndexRef = useRef<number | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function refreshPreview() {
    const iframe = iframeRef.current
    if (!iframe) return
    // Cambiar src con timestamp fuerza al browser a hacer nueva request
    // (evita cache HTTP) y al servidor a re-render (force-dynamic en /links).
    iframe.src = `/links?preview=${Date.now()}`
  }

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

  // ── Custom icons helpers ─────────────────────────────────
  function addCustomIcon(icon: CustomIcon) {
    setConfig((prev) => ({
      ...prev,
      customIcons: [...(prev.customIcons ?? []), icon],
    }))
  }

  function deleteCustomIcon(id: string) {
    const inUse = config.links.some((l) => l.icon === id)
    const msg = inUse
      ? `El icono "${id}" está usándose en algún link. ¿Borrar igualmente?`
      : `¿Borrar el icono "${id}"?`
    if (!confirm(msg)) return
    setConfig((prev) => ({
      ...prev,
      customIcons: (prev.customIcons ?? []).filter((ic) => ic.id !== id),
      // Si estaba en uso, lo quitamos del link también
      links: prev.links.map((l) => (l.icon === id ? { ...l, icon: undefined } : l)),
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
        refreshPreview()
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
                        <optgroup label="Built-in">
                          {BUILT_IN_ICONS.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </optgroup>
                        {(config.customIcons?.length ?? 0) > 0 && (
                          <optgroup label="Custom (subidos por vos)">
                            {(config.customIcons ?? []).map((ic) => (
                              <option key={ic.id} value={ic.id}>{ic.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {link.icon && (
                        <span className={styles.iconPreview} style={{ color: link.color ?? 'var(--ink-muted)' }}>
                          <IconDisplay name={link.icon} customIcons={config.customIcons} />
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

          {/* CUSTOM ICONS */}
          <details className={styles.group}>
            <summary className={styles.groupSummary}>
              Iconos custom ({config.customIcons?.length ?? 0})
            </summary>
            <div className={styles.groupBody}>
              <CustomIconsManager
                icons={config.customIcons ?? []}
                onAdd={addCustomIcon}
                onDelete={deleteCustomIcon}
              />
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
              onClick={refreshPreview}
              title="Refrescar preview"
            >
              ↻
            </button>
          </div>
          <iframe
            ref={iframeRef}
            src="/links"
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

// ── Custom icons manager (upload + lista) ─────────────────
const RESERVED_IDS = new Set([
  'chart', 'chart-pro', 'bot', 'layers', 'youtube', 'play',
  'mail', 'whatsapp', 'grid', 'instagram', 'tiktok', 'globe',
])

function CustomIconsManager({
  icons,
  onAdd,
  onDelete,
}: {
  icons: CustomIcon[]
  onAdd: (icon: CustomIcon) => void
  onDelete: (id: string) => void
}) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function validateLocal(): string | null {
    if (!id.trim()) return 'Falta el ID'
    if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(id)) {
      return 'ID inválido: solo minúsculas, números y guiones (ej: "gumroad", "discord")'
    }
    if (RESERVED_IDS.has(id)) return `"${id}" ya es un icono built-in. Usá otro ID.`
    if (icons.some((ic) => ic.id === id)) return `Ya existe un icono custom con ID "${id}"`
    if (!name.trim()) return 'Falta el nombre legible'
    if (!svg.trim()) return 'Falta el SVG'
    if (!/^<svg[\s>]/i.test(svg.trim())) return 'El SVG debe empezar con <svg'
    if (!/<\/svg>\s*$/i.test(svg.trim())) return 'El SVG debe terminar con </svg>'
    if (svg.length > 12000) return 'SVG demasiado grande (max ~12KB sin sanitizar)'
    return null
  }

  function handleAdd() {
    setError(null)
    const err = validateLocal()
    if (err) {
      setError(err)
      return
    }
    onAdd({ id: id.trim(), name: name.trim(), svg: svg.trim() })
    setId('')
    setName('')
    setSvg('')
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      setError('Solo se aceptan archivos .svg')
      return
    }
    if (file.size > 12000) {
      setError(`Archivo demasiado grande (${(file.size / 1024).toFixed(1)} KB). Max 12KB.`)
      return
    }
    const text = await file.text()
    setSvg(text)
    setError(null)
    // Auto-sugerir id si está vacío
    if (!id) {
      const stem = file.name.replace(/\.svg$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      setId(stem.substring(0, 32))
    }
    if (!name) {
      setName(file.name.replace(/\.svg$/i, ''))
    }
  }

  return (
    <>
      <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: '0 0 0.5rem' }}>
        Subí un SVG line-art con <code>stroke=&quot;currentColor&quot;</code> para que herede el color
        que elegís en cada link. Ver <a
          href="https://simpleicons.org"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)' }}
        >simpleicons.org</a> (logos de marcas) o <a
          href="https://lucide.dev"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)' }}
        >lucide.dev</a> (genéricos line-art).
      </p>

      {error && (
        <div
          style={{
            background: 'rgba(244,78,28,0.12)',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            padding: '0.55rem 0.8rem',
            borderRadius: '7px',
            fontSize: '0.78rem',
            marginBottom: '0.5rem',
          }}
        >
          {error}
        </div>
      )}

      <Field label="ID (kebab-case, ej: gumroad)">
        <input
          className={styles.input}
          type="text"
          value={id}
          maxLength={32}
          placeholder="gumroad"
          onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        />
      </Field>

      <Field label="Nombre legible">
        <input
          className={styles.input}
          type="text"
          value={name}
          maxLength={40}
          placeholder="Gumroad"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="SVG (pegar acá o arrastrar archivo)">
        <textarea
          className={styles.textarea}
          value={svg}
          rows={6}
          placeholder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">...</svg>'
          onChange={(e) => setSvg(e.target.value)}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
          onDragOver={(e) => e.preventDefault()}
        />
      </Field>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />
        <button
          type="button"
          className={styles.addBtn}
          style={{ marginTop: 0, flex: 1 }}
          onClick={() => fileInputRef.current?.click()}
        >
          📁 Elegir archivo SVG
        </button>
        <button
          type="button"
          className={styles.addBtn}
          style={{ marginTop: 0, background: 'var(--primary)', color: 'var(--background)', borderStyle: 'solid', borderColor: 'var(--primary)', flex: 1 }}
          onClick={handleAdd}
        >
          + Agregar icono
        </button>
      </div>

      {svg && (
        <div style={{ marginTop: '0.5rem', padding: '0.7rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '7px', display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40, color: 'var(--foreground)', background: 'rgba(229,212,182,0.05)', borderRadius: '7px' }}>
            <span
              style={{ display: 'inline-block', width: 24, height: 24, lineHeight: 0 }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
            Preview crudo (sin sanitizar). El servidor lo limpiará al guardar.
          </span>
        </div>
      )}

      {icons.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Tus iconos custom
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {icons.map((ic) => (
              <div
                key={ic.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                  padding: '0.55rem 0.7rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '7px',
                }}
              >
                <span style={{ display: 'inline-grid', placeItems: 'center', width: 32, height: 32, color: 'var(--foreground)' }}>
                  <span style={{ display: 'inline-block', width: 20, height: 20, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: ic.svg }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ic.name}</div>
                  <code style={{ fontSize: '0.7rem', color: 'var(--ink-dim)' }}>{ic.id}</code>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(ic.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(244,78,28,0.4)',
                    color: 'var(--primary)',
                    borderRadius: '6px',
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Borrar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
