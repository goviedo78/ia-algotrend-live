export class BrokerPlatformError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'BrokerPlatformError'
  }
}

export function publicError(error: unknown) {
  if (error instanceof BrokerPlatformError) {
    return { status: error.status, body: { error: error.code, message: error.message } }
  }

  return {
    status: 500,
    body: { error: 'INTERNAL_ERROR', message: 'No se pudo completar la operación.' },
  }
}
