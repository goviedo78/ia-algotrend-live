import { createHmac, timingSafeEqual } from 'node:crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerRawJson } from '@/lib/brokers/request'
import { brokerSignalSchema } from '@/lib/brokers/schemas'
import { dispatchBrokerSignal } from '@/lib/brokers/signals'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function verifySignature(rawBody: string, timestamp: string, nonce: string, signature: string) {
  const secret = process.env.BROKER_SIGNAL_WEBHOOK_SECRET
  if (!secret) throw new BrokerPlatformError('SIGNAL_AUTH_NOT_CONFIGURED', 'La autenticación de señales no está configurada.', 503)
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300_000) {
    throw new BrokerPlatformError('SIGNAL_TIMESTAMP_INVALID', 'La señal está fuera de la ventana permitida.', 401)
  }
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw new BrokerPlatformError('SIGNAL_SIGNATURE_INVALID', 'Firma de señal inválida.', 401)
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${nonce}.${rawBody}`).digest()
  const provided = Buffer.from(signature, 'hex')
  if (provided.byteLength !== expected.byteLength || !timingSafeEqual(provided, expected)) {
    throw new BrokerPlatformError('SIGNAL_SIGNATURE_INVALID', 'Firma de señal inválida.', 401)
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceBrokerRateLimit('signal_ingest', requestIdentifier(request))
    const rawBody = await readBrokerRawJson(request, 8_192)
    const timestamp = request.headers.get('x-broker-timestamp') ?? ''
    const nonce = request.headers.get('x-broker-nonce') ?? ''
    const signature = request.headers.get('x-broker-signature') ?? ''
    verifySignature(rawBody, timestamp, nonce, signature)
    const parsed = brokerSignalSchema.safeParse(JSON.parse(rawBody))
    if (!parsed.success) throw new BrokerPlatformError('SIGNAL_INVALID', 'Formato de señal inválido.', 400)

    const result = await dispatchBrokerSignal(parsed.data, { nonce, request })
    after(() => safeProcessBrokerJobsInApp({
      batchSize: 50,
      maxBatches: 4,
      concurrency: 20,
      timeBudgetMs: 24_000,
    }).then(() => undefined))
    return NextResponse.json({ ok: true, ...result }, { status: 202 })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
