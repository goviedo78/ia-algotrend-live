import type { BrokerCode } from '../domain'
import { BrokerPlatformError } from '../errors'
import { BingxAdapter } from './bingx'
import type { BrokerAdapter, BrokerAdapterFactoryInput } from './types'

type AdapterFactory = (input: BrokerAdapterFactoryInput) => BrokerAdapter

const factories: Partial<Record<BrokerCode, AdapterFactory>> = {
  BINGX: (input) => new BingxAdapter(input),
}

export function createBrokerAdapter(broker: BrokerCode, input: BrokerAdapterFactoryInput) {
  const factory = factories[broker]
  if (!factory) {
    throw new BrokerPlatformError('BROKER_NOT_IMPLEMENTED', 'Este broker todavía no está habilitado.', 422)
  }
  return factory(input)
}
