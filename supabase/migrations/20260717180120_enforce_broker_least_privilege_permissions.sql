alter table public.broker_connections
  add constraint broker_connections_least_privilege_permissions
  check (
    permissions_confirmed @> '{
      "read": true,
      "perpetualTrading": true,
      "spot": false,
      "withdrawal": false,
      "universalTransfer": false,
      "subaccounts": false,
      "p2p": false
    }'::jsonb
  ) not valid;

alter table public.broker_connections
  validate constraint broker_connections_least_privilege_permissions;
