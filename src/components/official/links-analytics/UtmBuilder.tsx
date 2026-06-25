'use client'

import { useMemo, useState } from 'react'
import styles from './LinksAnalytics.module.css'

// Plataformas predefinidas. La idea es que Gonzalo abra la pestaña, elija
// dónde va a pegar el link (Instagram, TikTok, etc.) y obtenga una URL lista
// para copiar con UTMs consistentes. Sin UTMs los reportes mezclan tráfico
// directo y de apps que borran el referrer.
const PRESETS: { id: string; label: string; source: string; medium: string }[] = [
  { id: 'instagram_bio', label: 'Instagram (bio)', source: 'instagram', medium: 'bio' },
  { id: 'instagram_stories', label: 'Instagram (stories)', source: 'instagram', medium: 'stories' },
  { id: 'tiktok_bio', label: 'TikTok (bio)', source: 'tiktok', medium: 'bio' },
  { id: 'tiktok_video', label: 'TikTok (video)', source: 'tiktok', medium: 'video' },
  { id: 'youtube_desc', label: 'YouTube (descripción)', source: 'youtube', medium: 'description' },
  { id: 'youtube_pinned', label: 'YouTube (comentario fijado)', source: 'youtube', medium: 'pinned_comment' },
  { id: 'twitter', label: 'Twitter / X', source: 'twitter', medium: 'tweet' },
  { id: 'whatsapp', label: 'WhatsApp', source: 'whatsapp', medium: 'chat' },
  { id: 'email', label: 'Email / newsletter', source: 'email', medium: 'newsletter' },
  { id: 'custom', label: 'Personalizado', source: '', medium: '' },
]

const BASE_URL = 'https://gonovi.app/links'

export function UtmBuilder() {
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [source, setSource] = useState(PRESETS[0].source)
  const [medium, setMedium] = useState(PRESETS[0].medium)
  const [campaign, setCampaign] = useState('')
  const [content, setContent] = useState('')
  const [copied, setCopied] = useState(false)

  function pickPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
    setPresetId(p.id)
    setSource(p.source)
    setMedium(p.medium)
  }

  const finalUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (source.trim()) params.set('utm_source', source.trim().toLowerCase())
    if (medium.trim()) params.set('utm_medium', medium.trim().toLowerCase())
    if (campaign.trim()) params.set('utm_campaign', campaign.trim().toLowerCase())
    if (content.trim()) params.set('utm_content', content.trim().toLowerCase())
    const qs = params.toString()
    return qs ? `${BASE_URL}?${qs}` : BASE_URL
  }, [source, medium, campaign, content])

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(finalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback torpe pero funcional
      const ta = document.createElement('textarea')
      ta.value = finalUrl
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      } finally {
        document.body.removeChild(ta)
      }
    }
  }

  return (
    <div className={styles.utmBox}>
      <h3 className={styles.utmTitle}>Generador de links con UTM</h3>
      <p className={styles.utmHint}>
        Instagram, TikTok y la mayoría de apps móviles borran el referrer al abrir tu link.
        Sin UTMs todo entra como &quot;directo&quot;. Generá un link por plataforma y pegalo en tu bio.
      </p>

      <label className={styles.utmField}>
        <span>Plataforma</span>
        <select
          className={styles.utmInput}
          value={presetId}
          onChange={(e) => pickPreset(e.target.value)}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.utmRow}>
        <label className={styles.utmField}>
          <span>utm_source</span>
          <input
            className={styles.utmInput}
            type="text"
            value={source}
            maxLength={60}
            placeholder="instagram"
            onChange={(e) => setSource(e.target.value)}
          />
        </label>
        <label className={styles.utmField}>
          <span>utm_medium</span>
          <input
            className={styles.utmInput}
            type="text"
            value={medium}
            maxLength={60}
            placeholder="bio"
            onChange={(e) => setMedium(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.utmRow}>
        <label className={styles.utmField}>
          <span>utm_campaign (opcional)</span>
          <input
            className={styles.utmInput}
            type="text"
            value={campaign}
            maxLength={60}
            placeholder="lanzamiento_oro15"
            onChange={(e) => setCampaign(e.target.value)}
          />
        </label>
        <label className={styles.utmField}>
          <span>utm_content (opcional)</span>
          <input
            className={styles.utmInput}
            type="text"
            value={content}
            maxLength={60}
            placeholder="video_53"
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.utmOutput}>
        <code className={styles.utmUrl}>{finalUrl}</code>
        <button
          type="button"
          className={styles.utmCopy}
          onClick={copyToClipboard}
          aria-label="Copiar URL"
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
