-- Pago de cada pedido al proveedor: cuánto se ha pagado, cuánto queda pendiente y si ya está saldado.
-- Solo se guarda lo pagado; lo pendiente y "saldado" los calcula la base para que nunca se contradigan.

alter table purchase_orders
  add column paid_amount integer not null default 0,
  add column paid_at timestamptz,
  add constraint purchase_orders_paid_amount_range check (paid_amount >= 0 and paid_amount <= total_cost),
  add column pending_amount integer generated always as (total_cost - paid_amount) stored,
  add column is_settled boolean generated always as (paid_amount >= total_cost) stored;

comment on column purchase_orders.paid_amount is 'Pesos ya pagados al proveedor (0 a total_cost).';
comment on column purchase_orders.paid_at is 'Cuándo quedó saldado; null mientras haya saldo pendiente.';
comment on column purchase_orders.pending_amount is 'Pendiente por pagar = total_cost − paid_amount.';
comment on column purchase_orders.is_settled is 'true cuando el pedido ya fue saldado.';
