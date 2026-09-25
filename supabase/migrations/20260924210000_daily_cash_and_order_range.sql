-- Regla del dueño (2026-09-24):
-- 1) La plata de cada pedido sale de la caja del día; el segundo pedido usa lo que quedó después del primero.
-- 2) Cada pedido va de $20.000 a $250.000 (mismo rango para todos, editable por proveedor).
-- 3) Nuevo modo de reposición: rellenar la base (base − stock).

-- ---------------------------------------------------------------------------
-- Rango por pedido en el proveedor
-- ---------------------------------------------------------------------------
alter table suppliers
  add column maximum_order_amount integer default 250000 check (maximum_order_amount >= 0);

alter table suppliers alter column minimum_order_amount set default 20000;

update suppliers set minimum_order_amount = 20000 where minimum_order_amount = 0;
update suppliers set maximum_order_amount = 250000 where maximum_order_amount is null;

-- ---------------------------------------------------------------------------
-- daily_cash: efectivo en caja al empezar el día, uno por tienda y fecha.
-- Lo gastado se calcula con los pedidos confirmados ese día (purchase_orders.total_cost).
-- ---------------------------------------------------------------------------
create table daily_cash (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  cash_date date not null,
  opening_amount integer not null check (opening_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, cash_date)
);

alter table daily_cash enable row level security;

create policy "owner reads and writes own store rows" on daily_cash
  for all to authenticated
  using (store_id in (select id from stores where owner_user_id = (select auth.uid())))
  with check (store_id in (select id from stores where owner_user_id = (select auth.uid())));

grant all on daily_cash to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Modo fill_to_base en los ajustes del reporte
-- ---------------------------------------------------------------------------
alter table sales_reports drop constraint if exists sales_reports_replenishment_mode_check;
alter table sales_reports
  add constraint sales_reports_replenishment_mode_check
  check (replenishment_mode in ('replenish_sold','fill_to_target','fill_to_base'));
