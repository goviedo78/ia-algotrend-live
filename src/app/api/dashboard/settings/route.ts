import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Settings are stored as the LATEST event of type 'setting_change' for each key
async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('algotrend_events')
    .select('metadata')
    .eq('event_type', 'setting_change')
    .contains('metadata', { key })
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return (data[0].metadata as Record<string, string>).value ?? null
  }
  return null
}

async function setSetting(key: string, value: string) {
  await supabase.from('algotrend_events').insert({
    event_type: 'setting_change',
    metadata: { key, value },
  })
}

// GET — read current filter settings
export async function GET(req: NextRequest) {
  const token = req.cookies.get('algotrend_dash')?.value
  if (!token || token !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enabled = await getSetting('atr_filter_enabled')
  const threshold = await getSetting('atr_threshold')

  return NextResponse.json({
    atr_filter_enabled: enabled === 'true',
    atr_threshold: parseFloat(threshold || '0.40'),
  })
}

// POST — toggle filter settings
export async function POST(req: NextRequest) {
  const token = req.cookies.get('algotrend_dash')?.value
  if (!token || token !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (body.atr_filter_enabled !== undefined) {
    await setSetting('atr_filter_enabled', String(body.atr_filter_enabled))
  }
  if (body.atr_threshold !== undefined) {
    await setSetting('atr_threshold', String(body.atr_threshold))
  }

  return NextResponse.json({ ok: true })
}
