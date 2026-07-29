import 'server-only'

import type { NextRequest } from 'next/server'
import { BrokerPlatformError } from './errors'

function assertJsonContentType(request: NextRequest) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    throw new BrokerPlatformError('CONTENT_TYPE_UNSUPPORTED', 'El cuerpo debe usar application/json.', 415)
  }
}

export async function readBrokerRawJson(request: NextRequest, maxBytes = 16_384) {
  assertJsonContentType(request)
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const declaredBytes = Number(contentLength)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maxBytes) {
      throw new BrokerPlatformError('REQUEST_BODY_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande.', 413)
    }
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, 'utf8') > maxBytes) {
    throw new BrokerPlatformError('REQUEST_BODY_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande.', 413)
  }
  return rawBody
}

export async function readBrokerJson(request: NextRequest, maxBytes = 16_384): Promise<unknown> {
  const rawBody = await readBrokerRawJson(request, maxBytes)
  try {
    return JSON.parse(rawBody) as unknown
  } catch {
    throw new BrokerPlatformError('INVALID_JSON', 'El cuerpo JSON no es válido.', 400)
  }
}
