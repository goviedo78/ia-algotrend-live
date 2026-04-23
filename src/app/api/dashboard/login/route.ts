import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    const expected = process.env.DASHBOARD_PASSWORD || '0102*'

    if (password !== expected) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('algotrend_dash', password, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    return response
  } catch (err) {
    console.error('[dashboard/login]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
