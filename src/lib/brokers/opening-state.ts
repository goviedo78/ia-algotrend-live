import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { loadBrokerAdapter } from './adapter-loader'
import { riskPolicyFromRow } from './dto'
import { dailyLossStatus } from './daily-loss'
import { BrokerPlatformError } from './errors'
import { managedSizingCapitalUsd, planOpeningNotional } from './sizing'

/** Read-only snapshot shared by estimates, missed openings and retry preflight. */
export async function loadConnectionOpeningState(connectionId: string) {
  const admin = createAdminClient()
  const [{ adapter }, policyResult, runtimeResult] = await Promise.all([
    loadBrokerAdapter(connectionId),
    admin.from('broker_risk_policies').select('*').eq('connection_id', connectionId).maybeSingle(),
    admin.rpc('get_broker_risk_runtime', { target_connection_id: connectionId }),
  ])
  if (policyResult.error || runtimeResult.error) throw policyResult.error || runtimeResult.error
  const policy = riskPolicyFromRow(policyResult.data)
  if (!policy) throw new BrokerPlatformError('RISK_POLICY_MISSING', 'La conexión no tiene política de riesgo.', 409)
  const [balance, rates] = await Promise.all([adapter.getBalance(), adapter.getCommissionRates()])
  const runtime = Array.isArray(runtimeResult.data) ? runtimeResult.data[0] : runtimeResult.data
  const connectionNetPnlUsd = Number(runtime?.lifetime_net_pnl_usd ?? 0)
  const sizingCapitalUsd = managedSizingCapitalUsd(policy.declaredCapitalUsd, connectionNetPnlUsd, balance.equity)
  const dailyNetPnlUsd = Number(runtime?.daily_net_pnl_usd ?? 0)
  if (![sizingCapitalUsd, balance.availableMargin, dailyNetPnlUsd, connectionNetPnlUsd, rates.taker].every(Number.isFinite)) {
    throw new BrokerPlatformError('RISK_ACCOUNT_EQUITY_INVALID', 'No se pudo calcular el capital real de la cuenta.', 422)
  }
  return {
    policy,
    sizingCapitalUsd,
    accountEquityUsd: balance.equity,
    connectionNetPnlUsd,
    availableMarginUsd: balance.availableMargin,
    takerFeeRate: rates.taker,
    plan: planOpeningNotional({ policy, sizingCapitalUsd, availableMarginUsd: balance.availableMargin, takerFeeRate: rates.taker }),
    dailyLoss: dailyLossStatus(policy, sizingCapitalUsd, dailyNetPnlUsd),
  }
}
