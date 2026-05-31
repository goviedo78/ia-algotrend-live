'use client'

import { useState } from 'react'
import { InfoTooltip } from '@/components/official/InfoTooltip'
import { NfcLocalTime } from '@/components/official/analytics/NfcLocalTime'
import { deleteScans } from '@/app/official/analytics/nfc/actions'
import s from '@/app/official/analytics/nfc/nfc.module.css'

interface NfcScan {
  id: string
  card_id: string
  ip_hash: string | null
  user_agent: string | null
  country: string | null
  city: string | null
  region: string | null
  latitude: string | null
  longitude: string | null
  browser_language: string | null
  device_cookie_id: string | null
  referer: string | null
  created_at: string
}

interface Props {
  scans: NfcScan[]
  nameByCard: Record<string, string>
  pin: string
}

function parseUserAgent(ua: string | null): { device: string; browser: string; system: string; summary: string } {
  if (!ua) return { device: '—', browser: '—', system: '—', summary: 'Sin datos' }
  let device = 'PC'
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Macintosh/i.test(ua)) device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else if (/Linux/i.test(ua)) device = 'Linux'

  let browser = 'Otro'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'

  let system = 'Sistema no detectado'
  const iosMatch = ua.match(/OS ([\d_]+)/i)
  const androidMatch = ua.match(/Android\s+([\d.]+)/i)
  const macMatch = ua.match(/Mac OS X ([\d_]+)/i)
  const windowsMatch = ua.match(/Windows NT ([\d.]+)/i)

  if ((device === 'iPhone' || device === 'iPad') && iosMatch) {
    system = `iOS ${iosMatch[1].replaceAll('_', '.').split('.').slice(0, 2).join('.')}`
  } else if (androidMatch) {
    system = `Android ${androidMatch[1].split('.').slice(0, 2).join('.')}`
  } else if (macMatch) {
    system = `macOS ${macMatch[1].replaceAll('_', '.').split('.').slice(0, 2).join('.')}`
  } else if (windowsMatch) {
    system = windowsMatch[1] === '10.0' ? 'Windows 10/11' : `Windows ${windowsMatch[1]}`
  } else if (/Linux/i.test(ua)) {
    system = 'Linux'
  }

  return { device, browser, system, summary: `${device} · ${browser} · ${system}` }
}

export function NfcScanTable({ scans, nameByCard, pin }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const toggleSelectAll = () => {
    if (selectedIds.size === scans.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(scans.map(s => s.id)))
    }
  }

  const toggleSelect = (id: string, e?: React.ChangeEvent<HTMLInputElement>) => {
    e?.stopPropagation()
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`¿Estás seguro de que querés borrar ${selectedIds.size} registros?`)) return
    
    setIsDeleting(true)
    try {
      await deleteScans(Array.from(selectedIds), pin)
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Error al borrar', err)
      alert('Error al borrar registros')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={s.tableWrapper}>
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.8rem 1.25rem',
          margin: '0.5rem 0 1rem 0',
          background: 'rgba(28, 34, 58, 0.75)',
          border: '1px solid rgba(244, 78, 28, 0.3)',
          borderTop: '1px solid rgba(244, 78, 28, 0.5)',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
          position: 'sticky',
          top: '1rem',
          zIndex: 20,
          animation: 'fadeInDown 0.3s ease-out'
        }}>
          <span style={{ fontSize: '0.9rem', color: '#E5D4B6', fontWeight: 600, letterSpacing: '0.02em' }}>
            <span style={{ color: '#f44e1c', marginRight: '0.3rem' }}>{selectedIds.size}</span>
            seleccionados
          </span>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              background: 'linear-gradient(135deg, #f44e1c 0%, #d83a10 100%)',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1.2rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: isDeleting ? 'wait' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(244, 78, 28, 0.3)',
              transition: 'all 0.2s ease',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}
          >
            {isDeleting ? 'Borrando...' : 'Eliminar'}
          </button>
        </div>
      )}
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.th} style={{ width: '40px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={scans.length > 0 && selectedIds.size === scans.length}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer' }}
              />
            </th>
            <th className={s.th}>
              Tarjeta
              <InfoTooltip
                title="ID Físico de la Tarjeta"
                body="Es el identificador grabado en el chip NFC de la tarjeta real (ej. b1, vip7). Corresponde a la ruta corta en la URL (gonovi.app/x/b1). Si le asignaste un nombre arriba, ves el nombre en lugar del código. Pasá el mouse para ver el código físico original."
                example="Grabaste la URL /x/b1 en tu tarjeta negra. Al escanearla, aquí aparecerá 'b1'."
                align="left"
              />
            </th>
            <th className={s.th}>
              Fecha
              <InfoTooltip
                title="Fecha y hora del escaneo"
                body="Convertida a la hora local de tu navegador automáticamente. Pasá el mouse sobre el valor para ver la hora UTC original (la que está guardada en la base)."
                example="Si escanean a las 20:15 hora Argentina y vos abrís el dashboard desde Madrid, ves '01:15' (hora Madrid)."
                align="left"
              />
            </th>
            <th className={`${s.th} ${s.hideMobileCollapse}`}>
              Ubicación
              <InfoTooltip
                title="Ubicación aproximada por IP"
                body="Vercel detecta país, ciudad y región según la IP. Precisión típica: 10-50 km en zonas urbanas, peor en zonas rurales. NO es la calle exacta — para eso habría que pedir permiso GPS al visitante (rompe lo discreto del NFC). Hacé clic en el pin 📍 para abrir Google Maps con la lat/lon aproximada."
                example="Buenos Aires, AR (Argentina) — radio ~15 km. El pin te lleva al barrio aproximado, no a la calle."
                align="left"
              />
            </th>
            <th className={`${s.th} ${s.hideMobileCollapse}`}>
              Idioma
              <InfoTooltip
                title="Idioma del navegador"
                body="El primer idioma configurado en el navegador del visitante. Sirve para saber de qué país viene aunque la IP esté en otro lado (VPN, viaje, etc.)."
                example="es-AR = español argentino · en-US = inglés EEUU · pt-BR = portugués Brasil · es-ES = español España."
                align="left"
              />
            </th>
            <th className={`${s.th} ${s.hideMobileCollapse}`}>
              Dispositivo
              <InfoTooltip
                title="Tipo de dispositivo y navegador"
                body="Detectado a partir del User Agent. La sigla de 8 caracteres es el inicio del ID único de cookie — útil para saber si dos escaneos vienen del mismo navegador. Pasá el mouse para ver el ID completo."
                example="iPhone · Safari · a3f7b9c2 = un iPhone usando Safari. Si volvés a ver a3f7b9c2 en otra fila = misma persona escaneó de nuevo."
                align="left"
              />
            </th>
            <th className={`${s.th} ${s.hideMobileCollapse}`}>
              Resumen
              <InfoTooltip
                title="Resumen técnico"
                body="Versión corta del dispositivo, navegador y sistema. El texto completo queda oculto y solo aparece como ayuda técnica al pasar el mouse."
                example="iPhone · Safari · iOS 18.2"
                align="right"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => {
            const ua = scan.user_agent || ''
            const { device, browser, system, summary } = parseUserAgent(ua)
            const deviceShort = scan.device_cookie_id ? scan.device_cookie_id.substring(0, 8) : 'N/A'

            const locationParts = [scan.city, scan.region, scan.country]
              .filter(Boolean)
              .map(part => {
                try { return decodeURIComponent(part as string) }
                catch { return part }
              })
            const locationLabel = locationParts.join(', ') || 'Desconocido'
            const mapsUrl =
              scan.latitude && scan.longitude
                ? `https://www.google.com/maps?q=${scan.latitude},${scan.longitude}&z=11`
                : null

            const cardLabel = nameByCard[scan.card_id]
            const isSelected = selectedIds.has(scan.id)
            const isExpanded = expandedIds.has(scan.id)

            return (
              <tr 
                key={scan.id} 
                className={`${s.row} ${!isExpanded ? s.collapsed : ''}`} 
                style={isSelected ? { background: 'rgba(244,78,28,0.05)' } : {}}
                onClick={() => toggleExpand(scan.id)}
              >
                <td className={`${s.td} ${s.tdCheckbox}`} style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => toggleSelect(scan.id, e)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td data-label="Tarjeta" className={`${s.td} ${s.tdAlwaysVisible}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        title={cardLabel ? `Código físico: ${scan.card_id}` : undefined}
                        className={s.cardBadge}
                      >
                        {cardLabel ?? scan.card_id}
                      </span>
                      <span className={s.mobileSummaryText}>
                        <NfcLocalTime iso={scan.created_at} />
                      </span>
                    </div>
                    <span className={s.expandIcon} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                      ▼
                    </span>
                  </div>
                </td>
                <td data-label="Fecha" style={{ whiteSpace: 'nowrap' }} className={`${s.td} ${s.hideMobileCollapse}`}>
                  <NfcLocalTime iso={scan.created_at} />
                </td>
                <td data-label="Ubicación" className={`${s.td} ${s.hideMobileCollapse}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span>{locationLabel}</span>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir en Google Maps"
                        style={{
                          color: '#ff8a3d',
                          textDecoration: 'none',
                          marginLeft: '0.5rem',
                          fontSize: '0.85rem',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        📍
                      </a>
                    )}
                  </div>
                </td>
                <td data-label="Idioma" className={`${s.td} ${s.hideMobileCollapse} ${s.hideMobileDesktop}`}>{scan.browser_language || '—'}</td>
                <td data-label="Dispositivo" className={`${s.td} ${s.hideMobileCollapse} ${s.hideMobileDesktop}`} title={scan.device_cookie_id || ''}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>
                      {device} · {browser}
                    </span>
                    <code style={{ opacity: 0.55, fontSize: '0.7rem' }}>{deviceShort}</code>
                  </div>
                </td>
                <td data-label="Resumen" className={`${s.td} ${s.hideMobileCollapse}`} title={ua || undefined}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{summary}</span>
                    <span style={{ display: 'block', opacity: 0.5, fontSize: '0.68rem', marginTop: '0.15rem' }}>
                      {system === '—' ? 'sin detalle técnico' : 'detalle al pasar mouse'}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {scans.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
          No hay escaneos registrados aún.
        </div>
      )}
    </div>
  )
}
