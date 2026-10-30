import React from 'react'
import { ImageResponse } from 'next/og'
import { entryPresentation } from './telegram-performance'
import { noticeLines, type SignalNotice } from './signal-notices'

export function noticeCardElement(notice: SignalNotice) {
  const direction = entryPresentation(notice.direction)
  return <div style={{ display: 'flex', width: '100%', height: '100%', padding: 44, background: '#ECEDEF', fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: '42px 56px', background: '#F8F5EF', color: '#1C223A', border: '1px solid #D9DBE0', borderRadius: 28, boxShadow: '0 12px 28px rgba(28,34,58,0.09)' }}>
      <div style={{ display: 'flex', color: '#6B7385', fontSize: 27, letterSpacing: 2 }}>{notice.kind === 'TRIGGER' ? 'TRIGGER ACTIVADO' : 'CONDICIONES FAVORABLES'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 94, marginTop: 18, paddingBottom: 18, borderBottom: `3px solid ${notice.direction === 'LONG' ? '#4FBC72' : '#F44E1C'}` }}>
        <svg width={54} height={54} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill={notice.direction === 'LONG' ? '#4FBC72' : '#DE3E3E'} /></svg>{direction.label}
      </div>
      <div style={{ display: 'flex', fontSize: 34, marginTop: 22, marginBottom: 16 }}>BTC · 1H</div>
      {noticeLines(notice).map((line, i) => <div key={i} style={{ display: 'flex', fontSize: 27, lineHeight: 1.4, marginTop: 13, color: i === 0 ? '#1C223A' : '#6B7385' }}>{line}</div>)}
    </div>
  </div>
}

export async function renderNoticeCard(notice: SignalNotice) {
  return new Uint8Array(await new ImageResponse(noticeCardElement(notice), { width: 1080, height: 820 }).arrayBuffer())
}
