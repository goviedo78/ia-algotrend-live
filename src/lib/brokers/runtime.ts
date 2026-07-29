function cleanRuntimeEnvValue(value: string | undefined) {
  return value?.replace(/\\n/g, '').trim().toLowerCase() ?? ''
}

export function runtimeFlag(name: string) {
  return cleanRuntimeEnvValue(process.env[name]) === 'true'
}

export function brokerExecutionMode() {
  return {
    executionEnabled: runtimeFlag('BROKER_EXECUTION_ENABLED'),
    liveExecutionEnabled: runtimeFlag('BROKER_LIVE_EXECUTION_ENABLED'),
    legacyExecutionEnabled: runtimeFlag('BINGX_LEGACY_EXECUTION_ENABLED'),
  }
}
