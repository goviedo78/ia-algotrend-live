import { NextResponse } from 'next/server'

export function POST() {
  return NextResponse.json(
    { error: 'This client-side trading endpoint has been retired' },
    { status: 410 },
  )
}
