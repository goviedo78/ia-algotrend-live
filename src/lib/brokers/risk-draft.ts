import type { RiskProfile } from './domain'
import { deriveRiskSuggestion } from './risk-profiles'

export type RiskDraftSizing = {
  capitalUsd: number
  riskProfile: RiskProfile
  allocationPct: number
  compoundEnabled: boolean
  fixedNotionalUsd: number
  maxOpenPositions: number
  maxTotalExposureUsd: number
}

// El lotaje que realmente se va a enviar: con interés compuesto manda el porcentaje del equity,
// con monto fijo manda el número exacto que cargó el titular.
export function draftNotionalUsd(draft: RiskDraftSizing) {
  const notionalUsd = draft.compoundEnabled
    ? deriveRiskSuggestion(draft.capitalUsd, draft.riskProfile, draft.allocationPct).suggestedNotionalPerOrderUsd
    : draft.fixedNotionalUsd
  return Number.isFinite(notionalUsd) && notionalUsd > 0 ? notionalUsd : 0
}

// La exposición total no es un techo de la plataforma: es coherencia interna. El motor rechaza
// abrir cuando `exposición acumulada + orden > exposición total`, así que para aprovechar las
// posiciones simultáneas permitidas tiene que cubrir una orden por cada una.
export function requiredMaxExposureUsd(draft: RiskDraftSizing) {
  const notionalUsd = draftNotionalUsd(draft)
  if (notionalUsd <= 0) return 0
  return Math.ceil(notionalUsd * Math.max(1, draft.maxOpenPositions) * 100) / 100
}

// El campo vive plegado en "Ajustes avanzados": si no acompañara al lotaje, un número que el
// titular nunca vio dejaría el formulario sin poder guardarse. Sólo sube, nunca recorta.
export function withCoherentExposure<T extends RiskDraftSizing>(draft: T): T {
  const required = requiredMaxExposureUsd(draft)
  return draft.maxTotalExposureUsd >= required ? draft : { ...draft, maxTotalExposureUsd: required }
}
