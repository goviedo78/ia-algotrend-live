-- El corte diario en porcentaje es elección del titular, igual que el de USD: el techo
-- histórico de 3% bloqueaba el día entero después de una sola pérdida en "Todo el saldo".
-- Sólo se amplía el rango permitido; ninguna política existente cambia de valor.
alter table public.broker_risk_policies
  drop constraint if exists broker_risk_policies_daily_loss_limit_pct_check;
alter table public.broker_risk_policies
  add constraint broker_risk_policies_daily_loss_limit_pct_check
  check (daily_loss_limit_pct between 0 and 100);
