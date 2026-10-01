-- Módulo de sugerido de pedido: modelo de niveles del dueño (27-sep-2026).
--   B  = base (mínimo) · PD = punto de pedido · T = tope (máximo, ya existía como max_stock_units) · 0 < B < PD < T
--   CM = unidades vendidas desde la última entrega del producto → se calcula con las ventas por día.
--   EA = PD − (B + CM), con signo.
-- Cada línea del pedido guarda una copia de los niveles y de la posición del producto al momento de pedir.

-- ---------------------------------------------------------------------------
-- Niveles del producto
-- ---------------------------------------------------------------------------
alter table product_settings
  add column min_stock_units integer check (min_stock_units >= 0),
  add column reorder_point_units integer check (reorder_point_units >= 0),
  add constraint product_settings_levels_order check (
    (min_stock_units is null or reorder_point_units is null or min_stock_units < reorder_point_units)
    and (reorder_point_units is null or max_stock_units is null or reorder_point_units < max_stock_units)
    and (min_stock_units is null or max_stock_units is null or min_stock_units < max_stock_units)
  );

comment on column product_settings.min_stock_units is 'Base (B): inventario mínimo.';
comment on column product_settings.reorder_point_units is 'Punto de pedido (PD): nivel en que queda el producto tras cada entrega.';
comment on column product_settings.max_stock_units is 'Tope (T): inventario máximo.';

-- ---------------------------------------------------------------------------
-- Ventas por día (para CM). Una fila por tienda, código y día: subir otro Excel que cubra
-- los mismos días reemplaza esas cifras en vez de sumarlas dos veces.
-- ---------------------------------------------------------------------------
create table sales_daily (
  store_id uuid not null references stores(id) on delete cascade,
  barcode text not null,
  sold_on date not null,
  units_sold numeric(12,3) not null,
  product_name text,
  sales_report_id uuid references sales_reports(id) on delete set null,
  primary key (store_id, barcode, sold_on)
);

create index on sales_daily (store_id, sold_on);

alter table sales_daily enable row level security;

create policy "owner reads and writes own store rows" on sales_daily
  for all to authenticated
  using (store_id in (select id from stores where owner_user_id = (select auth.uid())))
  with check (store_id in (select id from stores where owner_user_id = (select auth.uid())));

grant all on sales_daily to anon, authenticated, service_role;

-- Reportes ya cargados que cubren un solo día: su fecha es exacta, se pasan a ventas por día.
insert into sales_daily (store_id, barcode, sold_on, units_sold, product_name, sales_report_id)
select lines.store_id,
       lines.barcode,
       (reports.period_starts_at at time zone 'America/Bogota')::date,
       lines.units_sold,
       lines.product_name,
       reports.id
from sales_report_lines as lines
join sales_reports as reports on reports.id = lines.sales_report_id
where (reports.period_starts_at at time zone 'America/Bogota')::date
    = (reports.period_ends_at at time zone 'America/Bogota')::date
on conflict (store_id, barcode, sold_on) do nothing;

-- ---------------------------------------------------------------------------
-- Copia de los niveles y la posición en cada línea del pedido
-- ---------------------------------------------------------------------------
alter table purchase_order_lines
  add column min_stock_units integer,
  add column reorder_point_units integer,
  add column max_stock_units integer,
  add column moved_units numeric(12,3),
  add column estimated_stock numeric(12,3),
  add column units_above_base numeric(12,3);

comment on column purchase_order_lines.units_above_base is 'EA = PD − (B + CM) al momento de pedir, con signo.';

-- ---------------------------------------------------------------------------
-- Modo de niveles
-- ---------------------------------------------------------------------------
alter table sales_reports drop constraint if exists sales_reports_replenishment_mode_check;
alter table sales_reports
  add constraint sales_reports_replenishment_mode_check
  check (replenishment_mode in ('replenish_sold', 'fill_to_target', 'fill_to_base', 'levels'));
